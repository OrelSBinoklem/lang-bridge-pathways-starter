<?php

namespace App\Services\Tutor;

use App\Models\AppSetting;
use Illuminate\Support\Facades\{DB, Schema, Validator};
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AiProfiles
{
    private array $inspectionGraphs = [];

    public function inspectionGraph(string $id): ?array
    {
        return $this->inspectionGraphs[$id] ?? app(ServiceWorkflows::class)->defaultGraphForRole($id);
    }
    public function defaults(): array
    {
        $profiles = json_decode(file_get_contents(resource_path('ai-studio/profiles.json')), true, 512, JSON_THROW_ON_ERROR);
        foreach (['examiner', 'translation', 'reference'] as $id) $profiles[$id]['model'] = config('services.openai.exam_model', 'gpt-5.4');
        $profiles['exam_stt_primary']['model'] = config('services.openai.exam_transcription_primary', 'gpt-transcribe');
        $profiles['exam_stt_secondary']['model'] = config('services.openai.exam_transcription_secondary', 'gpt-4o-transcribe');
        $profiles['examiner_en']['model'] = config('services.openai.exam_model', 'gpt-5.4');
        $profiles['exam_stt_en_primary']['model'] = config('services.openai.exam_transcription_primary', 'gpt-transcribe');
        $profiles['exam_stt_en_secondary']['model'] = config('services.openai.exam_transcription_secondary', 'gpt-4o-transcribe');
        $profiles['dialogue_summary']['maxOutputTokens'] = 0;
        return $profiles;
    }

    public function override(string $id): ?array
    {
        return app(ServiceWorkflows::class)->activeConfig($id) ?? $this->legacyOverride($id);
    }

    public function legacyOverride(string $id): ?array
    {
        if (! Schema::hasTable('app_settings')) return null;
        $value = AppSetting::where('key', 'ai_profile_'.$id)->value('value');
        return $value ? json_decode($value, true, 512, JSON_THROW_ON_ERROR) : null;
    }

    public function all(): array
    {
        $result = [];
        foreach ($this->defaults() as $id => $profile) {
            $config = array_intersect_key($profile, array_flip(['model', 'reasoning', 'maxOutputTokens', 'prompts']));
            $saved = $this->override($id);
            $result[$id] = $profile + ['id' => $id, 'defaults' => $config, 'config' => array_replace($config, array_intersect_key($saved ?? [], $config)),
                'customized' => $saved !== null, 'revision' => $this->revision($saved),
                'fixedInstructions' => in_array($id, ['examiner', 'translation'], true) ? \App\Services\Language\LatvianReferences::instructions() : null,
                'inheritedModel' => $id === 'daily_summary' ? config('services.openai.context_summary_model', 'gpt-5.4') : null];
        }
        return $result;
    }

    public function runtime(): array
    {
        $result = [];
        foreach ($this->defaults() as $id => $_profile) if (($value = $this->override($id)) !== null) $result[$id] = $value;
        return $result;
    }

    public function save(string $id, array $input): array
    {
        if (array_diff(array_keys($input), ['config', 'expected_revision'])) throw ValidationException::withMessages(['request' => 'Неизвестные поля запрещены.']);
        $config = $this->validateConfig($id, $input['config'] ?? []);
        $data = Validator::make($input, ['expected_revision' => 'required|string|max:70'])->validate();
        $data['config'] = $config;
        $this->persist($id, $data);
        return $this->all();
    }

    public function validateConfig(string $id, array $config): array
    {
        $profile = $this->defaults()[$id] ?? null;
        abort_unless($profile, 404);
        $models = array_keys(json_decode(file_get_contents(base_path('frontend/src/config/tutor-reasoning.json')), true, 512, JSON_THROW_ON_ERROR));
        $allowed = $profile['kind'] === 'stt' ? ['gpt-transcribe', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'] : [...$models, 'inherit'];
        $data = Validator::make(['config' => $config], ['config' => 'required|array:model,reasoning,maxOutputTokens,prompts',
            'config.model' => ['required', Rule::in($allowed)], 'config.reasoning' => ['required', Rule::in(['inherit', 'none', 'low', 'medium', 'high', 'xhigh', 'max'])],
            'config.maxOutputTokens' => 'required|integer|min:0|max:16000', 'config.prompts' => 'required|array|min:1|max:8', 'config.prompts.*' => 'required|string|max:16000'])->validate();
        $data['config']['maxOutputTokens'] = (int) $data['config']['maxOutputTokens'];
        if ($profile['kind'] === 'stt' && ($data['config']['reasoning'] !== 'inherit' || $data['config']['maxOutputTokens'] !== 0)) throw ValidationException::withMessages(['config' => 'У распознавания нет настроек мышления и токенов ответа.']);
        $reasoning = json_decode(file_get_contents(base_path('frontend/src/config/tutor-reasoning.json')), true, 512, JSON_THROW_ON_ERROR);
        if ($profile['kind'] === 'llm' && $data['config']['model'] !== 'inherit' && $data['config']['reasoning'] !== 'inherit' && !in_array($data['config']['reasoning'], $reasoning[$data['config']['model']] ?: ['none'], true)) throw ValidationException::withMessages(['config.reasoning' => 'Этот режим мышления недоступен у выбранной модели.']);
        return $data['config'];
    }

    private function persist(string $id, array $data): void
    {
        abort_unless(app(ServiceWorkflows::class)->activeConfig($id) === null, 409, 'Настройки этого вызова задаёт активная схема. Измените её узел модели.');
        abort_unless(Schema::hasTable('app_settings'), 503, 'Хранилище настроек недоступно.');
        DB::transaction(function () use ($id, $data) {
            // A first save also locks a real row, so concurrent initial editors cannot overwrite one another.
            DB::table('app_settings')->insertOrIgnore(['key' => 'ai_profile_'.$id, 'value' => 'null', 'created_at' => now(), 'updated_at' => now()]);
            $row = AppSetting::where('key', 'ai_profile_'.$id)->lockForUpdate()->first();
            $current = $row?->value ? json_decode($row->value, true, 512, JSON_THROW_ON_ERROR) : null;
            abort_unless(hash_equals($this->revision($current), $data['expected_revision']), 409, 'Настройки изменились. Обновите их перед сохранением.');
            AppSetting::updateOrCreate(['key' => 'ai_profile_'.$id], ['value' => json_encode($data['config'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
        });
    }

    private function revision(?array $value): string { return hash('sha256', json_encode($value, JSON_THROW_ON_ERROR)); }

    /** No saved overrides means byte-for-byte the old request. Rubrics/tools/schema stay owned by the service. */
    public function apply(string $id, array $body, array $variables = []): array
    {
        $config = $this->override($id);
        // Keep the graph that produced this call even if another admin activates a new version mid-request.
        $this->inspectionGraphs[$id] = $config['_workflowGraph'] ?? null;
        if ($config === null) return $body;
        return $this->applyConfig($body, $config, $variables);
    }

    public function applyConfig(array $body, array $config, array $variables = []): array
    {
        if ($config['model'] !== 'inherit') $body['model'] = $config['model'];
        if (isset($body['input'])) {
            if ($config['reasoning'] !== 'inherit') $body['reasoning'] = ['effort' => $config['reasoning']];
            if ($config['maxOutputTokens'] > 0) $body['max_output_tokens'] = $config['maxOutputTokens'];
            $catalog = json_decode(file_get_contents(base_path('frontend/src/config/tutor-reasoning.json')), true, 512, JSON_THROW_ON_ERROR);
            $efforts = $catalog[$body['model']] ?? [];
            if (!$efforts || $efforts === ['none']) unset($body['reasoning']);
            elseif (isset($body['reasoning']['effort']) && $efforts && !in_array($body['reasoning']['effort'], $efforts, true)) $body['reasoning']['effort'] = $efforts[0];
            $prompts = array_map(function ($text) use ($variables) {
                foreach ($variables as $key => $value) $text = str_replace('{{'.$key.'}}', (string) $value, $text);
                return ['role' => 'developer', 'content' => $text];
            }, $config['prompts']);
            $body['input'] = [...$prompts, ...array_values(array_filter($body['input'], fn ($item) => ($item['role'] ?? '') !== 'developer'))];
            if (isset($config['assembly'])) $body['input'] = ServiceContext::assemble($config['assembly'], $body['input'], $variables);
        } else $body['prompt'] = implode("\n", $config['prompts']);
        return $body;
    }
}
