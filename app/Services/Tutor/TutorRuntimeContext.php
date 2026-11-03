<?php

namespace App\Services\Tutor;

use App\Models\TutorConversation;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\ValidationException;

class TutorRuntimeContext
{
    private const SNAPSHOT_FIELDS = ['page', 'task', 'notes', 'progress', 'voice'];

    private const TASK_FIELDS = ['topic', 'text', 'instructions', 'lessonBlockId', 'format', 'completed'];

    public function handle(int $userId, string $action, array $payload, ?string $tutorPreset = null): array
    {
        $data = Validator::make($payload, [
            'conversation_id' => 'required|integer|min:1',
            'after_id' => 'sometimes|integer|min:0',
            'revision' => 'required_if:action,context.save|integer|min:0',
            'state' => 'required_if:action,context.save|array:summary,summary_through_id,lesson_context,tool_interactions,last_compression,parameter_snapshot,journal_version',
            'state.summary' => 'nullable|string|max:12000',
            'state.summary_through_id' => 'sometimes|integer|min:0',
            'state.lesson_context' => 'nullable|array',
            'state.tool_interactions' => 'sometimes|array|max:20',
            'state.last_compression' => 'nullable|array',
            'state.parameter_snapshot' => 'sometimes|nullable|array',
            'state.journal_version' => 'sometimes',
            'client_key' => 'required_if:action,context.message|string|max:120|regex:/^[a-zA-Z0-9_:-]+$/',
            'role' => 'required_if:action,context.message|in:user,assistant,tool,system',
            'text' => 'required_if:action,context.message|string|max:100000',
            'metadata' => 'nullable|array',
        ])->validate();
        $this->ensure($this->jsonBytes($data['state'] ?? []) <= 65536, 'state', 'Контрольная точка превышает 64 КиБ.');
        $this->ensure($this->jsonBytes($data['metadata'] ?? []) <= 65536, 'metadata', 'Метаданные превышают 64 КиБ.');
        if (array_key_exists('journal_version', $data['state'] ?? [])) {
            $this->ensure($data['state']['journal_version'] === 1, 'state.journal_version', 'Поддерживается версия журнала 1.');
        }
        if (isset($data['state']['parameter_snapshot'])) {
            $this->validateSnapshot($data['state']['parameter_snapshot'], 'state.parameter_snapshot');
            $data['state']['parameter_snapshot'] = $this->snapshotForWire($data['state']['parameter_snapshot']);
        }
        if (($data['metadata']['kind'] ?? null) === 'state_delta') {
            $this->validateDelta($data['metadata'], $data['role'] ?? null);
            $data['metadata'] = $this->deltaForWire($data['metadata']);
        }

        // A gateway session selects the owner; incoming user IDs are never trusted.
        $result = DB::transaction(function () use ($userId, $action, $data) {
            $conversation = TutorConversation::query()->where('user_id', $userId)
                ->lockForUpdate()->findOrFail($data['conversation_id']);
            if ($action === 'context.message') {
                $message = $conversation->messages()->firstOrCreate(['client_key' => $data['client_key']], [
                    'user_id' => $userId, 'role' => $data['role'], 'original_text' => $data['text'],
                    'source' => 'tutor_gateway', 'metadata' => $data['metadata'] ?? [],
                ]);
                abort_unless($message->role === $data['role'] && $message->original_text === $data['text'], 409);
                if (($message->metadata['kind'] ?? null) === 'state_delta' || ($data['metadata']['kind'] ?? null) === 'state_delta') {
                    // Retrying the same key must not silently accept a different event.
                    abort_unless($this->canonical($message->metadata ?? []) === $this->canonical($data['metadata'] ?? []), 409);
                }
                $conversation->touch();

                return ['message_id' => $message->id, '_index' => $message->wasRecentlyCreated
                    && in_array($message->role, ['user', 'assistant'], true)
                    && ($message->metadata['longMemoryEnabled'] ?? false) === true];
            }
            if ($action === 'context.save') {
                abort_unless($conversation->context_revision === $data['revision'], 409, 'Tutor context changed in another session.');
                $state = $data['state'];
                $state['summary'] = (string) ($state['summary'] ?? '');
                $through = $state['summary_through_id'] ?? 0;
                abort_if($through < ($conversation->runtime_context['summary_through_id'] ?? 0), 409);
                abort_if($through > 0 && ! $conversation->messages()->whereKey($through)->exists(), 422);
                abort_if($through > 0 && trim($state['summary'] ?? '') === '', 422);
                $conversation->runtime_context = $state;
                if ($state['summary'] !== '') $conversation->summary = $state['summary'];
                $conversation->context_revision++;
                $conversation->save();

                return ['revision' => $conversation->context_revision];
            }

            $state = $conversation->runtime_context ?? [];
            if (isset($state['parameter_snapshot'])) {
                $state['parameter_snapshot'] = $this->snapshotForWire($state['parameter_snapshot']);
            }
            $after = max($state['summary_through_id'] ?? 0, $data['after_id'] ?? 0);
            $messages = $conversation->messages()->where('id', '>', $after)->orderBy('id')->limit(101)->get();

            return [
                'revision' => $conversation->context_revision,
                'state' => $state,
                'has_more' => $messages->count() > 100,
                'messages' => $messages->take(100)->map(fn ($m) => [
                    'id' => $m->id, 'role' => $m->role, 'text' => $m->original_text ?? '',
                    'metadata' => ($m->metadata['kind'] ?? null) === 'state_delta' ? $this->deltaForWire($m->metadata) : $m->metadata,
                    'createdAt' => $m->created_at->toISOString(),
                ])->values()->all(),
            ];
        });
        if ($action === 'context.message') {
            if ($result['_index'] ?? false) {
                $message = \App\Models\TutorMessage::findOrFail($result['message_id']);
                app(\App\Services\Credits\CreditContext::class)->run($userId,
                    fn () => app(OpenAiEmbeddingService::class)->embedTutorMessage($message, $message->metadata['embeddingModel'] ?? null, 1536), 'memory', $tutorPreset);
            }
            unset($result['_index']);
        }
        return $result;
    }

    private function validateSnapshot(array $snapshot, string $path): void
    {
        $this->plainJson($snapshot, $path);
        $this->map($snapshot, self::SNAPSHOT_FIELDS, $path);
        $this->ensure($this->jsonBytes($snapshot) <= 24576, $path, 'Снимок параметров превышает 24 КиБ.');
        foreach ($snapshot as $field => $value) {
            $this->validateSnapshotField($field, $value, $path.'.'.$field, legacyTask: true);
        }
    }

    private function validateDelta(array $metadata, mixed $role): void
    {
        $path = 'metadata';
        $this->ensure($role === 'system', 'role', 'Событие параметров должно иметь роль system.');
        $this->plainJson($metadata, $path);
        $this->map($metadata, ['kind', 'changes', 'event_version'], $path);
        $this->ensure(($metadata['event_version'] ?? null) === 1, $path.'.event_version', 'Поддерживается версия события 1.');
        $changes = $metadata['changes'] ?? null;
        $this->ensure(is_array($changes) && array_is_list($changes) && count($changes) >= 1 && count($changes) <= 16,
            $path.'.changes', 'Событие должно содержать от 1 до 16 изменений.');
        $allowedPaths = [...self::SNAPSHOT_FIELDS, ...array_map(fn ($key) => 'task.'.$key, self::TASK_FIELDS)];
        $seen = [];
        $values = [];
        foreach ($changes as $index => $change) {
            $changePath = $path.'.changes.'.$index;
            $this->map($change, ['path', 'value'], $changePath);
            $field = $change['path'] ?? null;
            $this->ensure(in_array($field, $allowedPaths, true), $changePath.'.path', 'Неизвестный путь параметра.');
            $this->ensure(! isset($seen[$field]), $changePath.'.path', 'Путь параметра повторяется.');
            $this->ensure(array_key_exists('value', $change), $changePath.'.value', 'Нужно значение параметра, включая null.');
            if (str_starts_with($field, 'task.')) {
                $this->validateTaskField(substr($field, 5), $change['value'], $changePath.'.value');
            } else {
                $this->validateSnapshotField($field, $change['value'], $changePath.'.value');
            }
            $seen[$field] = true;
            $values[$field] = $change['value'];
        }
        $this->ensure(! isset($seen['task']) || array_filter(array_keys($seen), fn ($field) => str_starts_with($field, 'task.')) === [],
            $path.'.changes', 'Нельзя одновременно изменять task целиком и отдельные поля task.');
        $this->ensure($this->jsonBytes($values) <= 24576, $path.'.changes', 'Изменения параметров превышают 24 КиБ.');
    }

    /** Snapshot data never writes course progress, memory notes or lesson completion. */
    private function validateSnapshotField(string $field, mixed $value, string $path, bool $legacyTask = false): void
    {
        if ($field === 'page') {
            $this->text($value, 2000, $path);
        } elseif ($field === 'task' && $value !== null) {
            $this->map($value, self::TASK_FIELDS, $path);
            foreach ($value as $key => $item) {
                $this->validateTaskField($key, $item, $path.'.'.$key, $legacyTask);
            }
        } elseif ($field === 'notes') {
            $this->ensure(is_array($value) && array_is_list($value) && count($value) <= 8, $path, 'Допустимо до 8 заметок.');
            foreach ($value as $index => $note) {
                $notePath = $path.'.'.$index;
                $this->map($note, ['id', 'category', 'key', 'content', 'importance', 'last_seen_at'], $notePath);
                foreach (['category' => 80, 'key' => 120, 'content' => 600, 'last_seen_at' => 64] as $key => $max) {
                    if (array_key_exists($key, $note)) {
                        $this->text($note[$key], $max, $notePath.'.'.$key);
                    }
                }
                if (isset($note['id'])) {
                    $this->ensure(is_int($note['id']) && $note['id'] > 0, $notePath.'.id', 'Нужен положительный ID заметки.');
                }
                if (isset($note['importance'])) {
                    $this->ensure(is_int($note['importance']) && $note['importance'] >= 1 && $note['importance'] <= 5,
                        $notePath.'.importance', 'Важность заметки должна быть от 1 до 5.');
                }
            }
        } elseif ($field === 'progress' && $value !== null) {
            $this->map($value, null, $path);
            foreach ($value as $key => $item) {
                $this->ensure(is_string($key) && preg_match('/\A[a-zA-Z][a-zA-Z0-9_.:-]{0,79}\z/D', $key) === 1,
                    $path, 'Неверное имя параметра прогресса.');
                $this->ensure($item === null || is_scalar($item), $path.'.'.$key, 'Значение прогресса должно быть скалярным.');
            }
        } elseif ($field === 'voice' && $value !== null) {
            $this->map($value, ['voice', 'gender', 'russian_self_reference'], $path);
            foreach (['voice' => 100, 'gender' => 32, 'russian_self_reference' => 300] as $key => $max) {
                if (array_key_exists($key, $value)) {
                    $this->text($value[$key], $max, $path.'.'.$key);
                }
            }
        }
    }

    private function validateTaskField(string $field, mixed $value, string $path, bool $legacy = false): void
    {
        $limits = ['topic' => 200, 'text' => 4000, 'instructions' => 4000];
        if (isset($limits[$field])) {
            // Previously normalized checkpoints may have null instead of an empty
            // string. New deltas preserve exact strings through the raw JSON route.
            $this->ensure(is_string($value) || ($legacy && $value === null), $path, 'Нужен текст задания.');
            $this->text($value, $limits[$field], $path);
        } elseif ($field === 'lessonBlockId') {
            $this->ensure($value === null || (is_int($value) && $value >= ($legacy ? 0 : 1)), $path, 'Нужен положительный ID задания или null.');
        } elseif ($field === 'format') {
            $this->ensure(in_array($value, ['writing', 'speaking'], true), $path, 'Неизвестный формат задания.');
        } elseif ($field === 'completed') {
            $this->ensure(is_bool($value), $path, 'Нужно логическое значение.');
        }
    }

    private function plainJson(mixed $value, string $path, int $depth = 0): void
    {
        $this->ensure($depth <= 8, $path, 'Слишком глубокая структура параметров.');
        if (is_array($value)) {
            foreach ($value as $key => $item) {
                $this->ensure(! in_array($key, ['__proto__', 'constructor', 'prototype'], true), $path, 'Недопустимый ключ параметра.');
                $this->plainJson($item, $path.'.'.$key, $depth + 1);
            }
        } else {
            $this->ensure($value === null || is_scalar($value), $path, 'Допустимы только JSON-данные.');
            $this->ensure(! is_float($value) || is_finite($value), $path, 'Число должно быть конечным.');
        }
    }

    private function map(mixed $value, ?array $keys, string $path): void
    {
        // Laravel decodes both an empty object and an empty list as [].
        $this->ensure(is_array($value) && ($value === [] || ! array_is_list($value)), $path, 'Нужен объект параметров.');
        if ($keys !== null) {
            $this->ensure(array_diff(array_keys($value), $keys) === [], $path, 'Неизвестные поля параметров запрещены.');
        }
    }

    private function text(mixed $value, int $max, string $path): void
    {
        $this->ensure($value === null || (is_string($value) && mb_strlen($value) <= $max), $path, 'Неверный текст или превышен лимит символов.');
    }

    private function jsonBytes(mixed $value): int
    {
        try {
            return strlen(json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        } catch (\JsonException) {
            throw ValidationException::withMessages(['state' => 'Допустимы только корректные JSON-данные.']);
        }
    }

    /** Restore empty map shapes lost by Eloquent's associative JSON casts. */
    private function fieldForWire(string $field, mixed $value): mixed
    {
        return $value === [] && in_array($field, ['task', 'progress', 'voice'], true) ? (object) [] : $value;
    }

    private function snapshotForWire(array $snapshot): array|object
    {
        foreach ($snapshot as $field => $value) {
            $snapshot[$field] = $this->fieldForWire($field, $value);
        }

        return $snapshot === [] ? (object) [] : $snapshot;
    }

    private function deltaForWire(array $metadata): array
    {
        foreach ($metadata['changes'] ?? [] as $index => $change) {
            if (is_array($change) && isset($change['path']) && array_key_exists('value', $change)) {
                $metadata['changes'][$index]['value'] = $this->fieldForWire($change['path'], $change['value']);
            }
        }

        return $metadata;
    }

    private function canonical(mixed $value): mixed
    {
        if ($value instanceof \stdClass) {
            $value = (array) $value;
        }
        if (is_array($value)) {
            if (! array_is_list($value)) {
                ksort($value);
            }
            foreach ($value as $key => $item) {
                $value[$key] = $this->canonical($item);
            }
        }

        return $value;
    }

    private function ensure(bool $condition, string $path, string $message): void
    {
        if (! $condition) {
            throw ValidationException::withMessages([$path => $message]);
        }
    }
}
