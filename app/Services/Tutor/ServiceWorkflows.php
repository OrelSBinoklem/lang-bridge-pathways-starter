<?php

namespace App\Services\Tutor;

use App\Models\AppSetting;
use Illuminate\Support\Facades\{DB, Schema};
use Illuminate\Validation\ValidationException;

/** Functional workflows. Role nodes are bound to existing service entry points, not arbitrary code. */
class ServiceWorkflows
{
    public const SCHEMES = [
        'exams' => ['name' => 'Экзамены', 'roles' => ['examiner', 'exam_stt_primary', 'exam_stt_secondary']],
        'english_exams' => ['name' => 'Экзамены · английский', 'roles' => ['examiner_en', 'exam_stt_en_primary', 'exam_stt_en_secondary']],
        'translation' => ['name' => 'Проверка перевода', 'roles' => ['translation']],
        'memory' => ['name' => 'Память диалогов', 'roles' => ['dialogue_summary', 'daily_summary']],
        'references' => ['name' => 'Латышские справочники', 'roles' => ['reference']],
    ];

    private function state(string $scheme): array
    {
        abort_unless(isset(self::SCHEMES[$scheme]), 404);
        $raw = Schema::hasTable('app_settings') ? AppSetting::where('key', 'ai_workflow_'.$scheme)->value('value') : null;
        return $raw ? json_decode($raw, true, 512, JSON_THROW_ON_ERROR) : ['versions' => [], 'head' => null, 'active' => null];
    }

    public function all(): array
    {
        $result = [];
        foreach (self::SCHEMES as $id => $definition) {
            $state = $this->state($id);
            $result[$id] = ['id' => $id, ...$definition, ...$state, 'revision' => $this->revision($state), 'default_graph' => $this->defaultGraph($id)];
        }
        return $result;
    }

    public function defaultGraph(string $scheme): array
    {
        $profiles = app(AiProfiles::class); $defaults = $profiles->defaults(); $nodes = $edges = [];
        foreach (self::SCHEMES[$scheme]['roles'] as $lane => $role) {
            $profile = $defaults[$role]; $config = array_replace(array_intersect_key($profile, array_flip(['model', 'reasoning', 'maxOutputTokens', 'prompts'])), $profiles->legacyOverride($role) ?? []);
            $y = $lane * 1000; $prefix = $role.'__';
            $node = function ($id, $type, $x, $offset, $data) use (&$nodes, $prefix, $y) { $nodes[] = ['id' => $prefix.$id, 'type' => $type, 'position' => ['x' => $x, 'y' => $y + $offset], 'data' => $data]; };
            $edge = function ($from, $to, $port = 'in') use (&$edges, $prefix) { $edges[] = ['id' => $prefix.$from.'_'.$to.'_'.$port, 'source' => $prefix.$from, 'target' => $prefix.$to, 'sourceHandle' => 'out', 'targetHandle' => $port]; };
            $node('event', 'event', 0, 80, ['role' => $role, 'title' => $profile['kind'] === 'stt' ? 'Аудиоответ на экзамене' : ($role === 'examiner' ? 'Отправлен экзамен на проверку' : $profile['name'])]);
            $node('source', 'source', 350, count($config['prompts']) * 180 + 40, ['role' => $role, 'source' => 'request', 'title' => $profile['kind'] === 'stt' ? 'Запись ученика · файл остаётся в сервисе' : ($role === 'examiner' ? 'Задания, рубрики, ответы и расшифровки' : 'Данные вызова сервиса')]);
            foreach ($config['prompts'] as $i => $text) {
                $node('prompt'.$i, 'prompt', 350, $i * 180, ['role' => $role, 'text' => $text]);
                $edge('event', 'prompt'.$i); $edge('prompt'.$i, 'context', 'in1');
            }
            $inputs = array_map(fn ($n) => ['id' => 'in'.$n, 'label' => $n === 1 ? 'Инструкции' : ($n === 2 ? 'Данные' : 'Дополнительно '.$n), 'key' => $n === 1 ? 'instructions' : ($n === 2 ? 'data' : 'extra'.$n)], range(1, 8));
            $node('context', 'context', 740, 0, ['role' => $role, 'mode' => 'object', 'inputs' => $inputs, 'order' => array_column($inputs, 'id')]);
            $node('serialize', 'serialize', 1220, 80, ['role' => $role, 'format' => 'messages']);
            $node('model', 'model', 1590, 80, ['role' => $role, 'title' => $profile['name'], ...array_diff_key($config, ['prompts' => 1])]);
            $module = in_array($role, ['examiner', 'translation'], true) ? 'Справочник · по запросу модели → проверка результата' : ($profile['kind'] === 'stt' ? 'Сохранить дословную расшифровку в ответе ученика' : 'Проверить и сохранить результат');
            $node('tools', 'tools', 1970, 80, ['role' => $role, 'title' => $module]);
            $node('reply', 'reply', 2350, 80, ['role' => $role, 'title' => $role === 'examiner' ? 'Проверенные баллы и комментарии' : 'Результат функционала']);
            $edge('event', 'source'); $edge('source', 'context', 'in2');
            $edge('context', 'serialize'); $edge('serialize', 'model'); $edge('model', 'tools'); $edge('tools', 'reply');
        }
        if (in_array($scheme, ['exams', 'english_exams'], true)) foreach (['primary', 'secondary'] as $pass) $edges[] = ['id' => 'stored_'.$pass, 'source' => ($scheme === 'exams' ? 'exam_stt_' : 'exam_stt_en_').$pass.'__reply', 'target' => ($scheme === 'exams' ? 'examiner' : 'examiner_en').'__source', 'sourceHandle' => 'out', 'targetHandle' => 'in', 'channel' => 'stored'];
        return ['version' => 1, 'name' => self::SCHEMES[$scheme]['name'], 'nodes' => $nodes, 'edges' => $edges];
    }

    private function revision(array $state): string { return hash('sha256', json_encode($state, JSON_THROW_ON_ERROR)); }

    public function mutate(string $scheme, string $action, array $input, int $adminId): array
    {
        abort_unless(isset(self::SCHEMES[$scheme]), 404);
        abort_unless(in_array($action, ['save', 'activate', 'deactivate'], true), 422);
        abort_unless(Schema::hasTable('app_settings'), 503);
        $graph = $action === 'save' ? $this->validate($scheme, $input['graph'] ?? []) : null;
        DB::transaction(function () use ($scheme, $action, $input, $adminId, $graph) {
            $key = 'ai_workflow_'.$scheme;
            DB::table('app_settings')->insertOrIgnore(['key' => $key, 'value' => json_encode(['versions' => [], 'head' => null, 'active' => null]), 'created_at' => now(), 'updated_at' => now()]);
            $row = AppSetting::where('key', $key)->lockForUpdate()->first();
            $state = json_decode($row->value, true, 512, JSON_THROW_ON_ERROR);
            abort_unless(is_string($input['expected_revision'] ?? null) && hash_equals($this->revision($state), $input['expected_revision']), 409, 'Схема изменилась. Обновите список версий; черновик остаётся на экране.');
            if ($action === 'save') {
                $id = ($state['head'] ?? 0) + 1;
                array_unshift($state['versions'], ['id' => $id, 'name' => $graph['name'], 'graph' => $graph, 'created_at' => now()->toIso8601String(), 'created_by' => $adminId]);
                $state['head'] = $id;
                // Preserve the active rollback target even when old drafts are trimmed.
                $state['versions'] = array_values(array_filter($state['versions'], fn ($v, $i) => $i < 20 || $v['id'] === $state['active'], ARRAY_FILTER_USE_BOTH));
            } elseif ($action === 'activate') {
                $version = collect($state['versions'])->firstWhere('id', $input['version_id'] ?? -1);
                abort_unless($version && is_int($input['version_id'] ?? null), 404);
                $this->validate($scheme, $version['graph']); $state['active'] = $version['id'];
            } else $state['active'] = null;
            $row->update(['value' => json_encode($state, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]);
        });
        return $this->all();
    }

    public function activeConfig(string $role): ?array
    {
        foreach (self::SCHEMES as $id => $definition) if (in_array($role, $definition['roles'], true)) {
            $state = $this->state($id);
            $version = collect($state['versions'])->firstWhere('id', $state['active']);
            return $version ? [...$this->compile($role, $version['graph']), '_workflowGraph' => $version['graph']] : null;
        }
        return null;
    }

    public function graphForRole(string $role): ?array
    {
        foreach (self::SCHEMES as $id => $definition) if (in_array($role, $definition['roles'], true)) {
            $state = $this->state($id); $version = collect($state['versions'])->firstWhere('id', $state['active']);
            return $version['graph'] ?? $this->defaultGraph($id);
        }
        return null;
    }

    public function defaultGraphForRole(string $role): ?array
    {
        foreach (self::SCHEMES as $id => $definition) if (in_array($role, $definition['roles'], true)) return $this->defaultGraph($id);
        return null;
    }

    public function preview(string $scheme, array $input): array
    {
        abort_unless(isset(self::SCHEMES[$scheme]) && in_array($input['role'] ?? '', self::SCHEMES[$scheme]['roles'], true), 422);
        $graph = $this->validate($scheme, $input['graph'] ?? []); $role = $input['role'];
        $body = $input['body'] ?? null; $variables = $input['variables'] ?? [];
        $stt = str_starts_with($role, 'exam_stt_');
        abort_unless(is_array($body) && ($stt || is_array($body['input'] ?? null) && array_is_list($body['input'])) && is_string($body['model'] ?? null)
            && is_array($variables) && count($variables) <= 20 && strlen(json_encode($body)) < 150000, 422, 'Нужен учебный запрос модели (model, input) до 150 КБ. Аудиофайлы не загружаются.');
        foreach ($body['input'] ?? [] as $message) abort_unless(is_array($message), 422, 'Сообщения запроса должны быть объектами.');
        abort_unless(strlen(json_encode($variables)) <= 20000, 422);
        foreach ($variables as $value) abort_unless(is_scalar($value) || $value === null, 422);
        if ($stt) $body = ['model' => $body['model'], 'prompt' => '', 'language' => str_ends_with($role, '_primary') ? 'auto' : ($scheme === 'english_exams' ? 'en' : 'lv')];
        $config = $this->compile($role, $graph);
        $request = app(AiProfiles::class)->applyConfig($body, $config, $variables);
        if (in_array($role, ['examiner', 'translation'], true)) $request['input'][0]['content'] .= "\n".\App\Services\Language\LatvianReferences::instructions();
        $events = [];
        foreach ($graph['nodes'] as $node) {
            if ($node['data']['role'] !== $role) continue;
            $type = $node['type']; $value = null;
            if ($type === 'prompt') { $value = $node['data']['text']; foreach ($variables as $key => $v) $value = str_replace('{{'.$key.'}}', (string) $v, $value); }
            elseif ($type === 'source') $value = $node['data']['source'] === 'request' ? ($stt ? ['audioStored' => false, 'testOnly' => true] : array_values(array_filter($body['input'], fn ($v) => ($v['role'] ?? '') !== 'developer'))) : $variables;
            elseif ($type === 'context') $value = ['mode' => $node['data']['mode'], 'ordered_parts' => ServiceContext::parts($config['assembly'], $body['input'] ?? [], $variables)];
            elseif ($type === 'serialize') $value = $request['input'] ?? $request['prompt'] ?? '';
            elseif ($type === 'model') $value = ['dryRun' => true, 'providerCalled' => false];
            else $value = ['role' => $role, 'dryRun' => true];
            $events[] = ['nodeId' => $node['id'], 'type' => $type === 'model' ? 'request_preview' : $type, 'status' => in_array($type, ['tools', 'reply'], true) ? 'skipped' : 'completed',
                'at' => now()->toIso8601String(), 'inputPreview' => $type === 'model' ? json_encode($request, JSON_UNESCAPED_UNICODE) : null, 'outputPreview' => json_encode($value, JSON_UNESCAPED_UNICODE)];
        }
        return ['request' => $request, 'events' => $events, 'dryRun' => true, 'providerCalled' => false];
    }

    public function compile(string $role, array $graph): array
    {
        $nodes = array_column(array_filter($graph['nodes'], fn ($n) => $n['data']['role'] === $role), null, 'id');
        $context = collect($nodes)->firstWhere('type', 'context');
        $serialize = collect($nodes)->firstWhere('type', 'serialize');
        $model = collect($nodes)->firstWhere('type', 'model')['data'];
        $parts = []; $prompts = [];
        foreach ($context['data']['order'] as $port) foreach ($graph['edges'] as $edge) if ($edge['target'] === $context['id'] && $edge['targetHandle'] === $port) {
            $source = $nodes[$edge['source']];
            if ($source['type'] === 'prompt') { $prompts[] = $source['data']['text']; $parts[] = ['kind' => 'prompt', 'text' => $source['data']['text'], 'port' => $port]; }
            else $parts[] = ['kind' => 'source', 'source' => $source['data']['source'], 'port' => $port];
        }
        return ['model' => $model['model'], 'reasoning' => $model['reasoning'], 'maxOutputTokens' => $model['maxOutputTokens'], 'prompts' => $prompts,
            'assembly' => ['parts' => $parts, 'mode' => $context['data']['mode'], 'format' => $serialize['data']['format'], 'inputs' => $context['data']['inputs']]];
    }

    public function validate(string $scheme, mixed $graph): array
    {
        $fail = fn ($text) => throw ValidationException::withMessages(['graph' => $text]);
        if (!is_array($graph) || array_diff(array_keys($graph), ['version', 'name', 'nodes', 'edges']) || ($graph['version'] ?? null) !== 1
            || !is_string($graph['name'] ?? null) || !mb_strlen(trim($graph['name'])) || mb_strlen($graph['name']) > 120
            || !is_array($graph['nodes'] ?? null) || !array_is_list($graph['nodes']) || count($graph['nodes']) > 64
            || !is_array($graph['edges'] ?? null) || !array_is_list($graph['edges']) || count($graph['edges']) > 128
            || strlen(json_encode($graph)) > 131072) $fail('Неверная схема или превышен лимит 128 КиБ / 64 узла / 128 связей.');
        $roles = self::SCHEMES[$scheme]['roles']; $ids = [];
        $keys = ['event' => ['role', 'title'], 'source' => ['role', 'title', 'source'], 'prompt' => ['role', 'text'], 'context' => ['role', 'mode', 'inputs', 'order'],
            'serialize' => ['role', 'format'], 'model' => ['role', 'title', 'model', 'reasoning', 'maxOutputTokens'], 'tools' => ['role', 'title'], 'reply' => ['role', 'title']];
        foreach ($graph['nodes'] as $n) {
            if (!is_array($n) || array_diff(array_keys($n), ['id', 'type', 'data', 'position']) || !is_string($n['id'] ?? null) || !preg_match('/\A[a-zA-Z0-9_-]{1,80}\z/D', $n['id']) || isset($ids[$n['id']])
                || !is_string($n['type'] ?? null) || !isset($keys[$n['type']]) || !is_array($n['data'] ?? null) || array_diff(array_keys($n['data']), $keys[$n['type']]) || array_diff($keys[$n['type']], array_keys($n['data'])) || !in_array($n['data']['role'] ?? '', $roles, true)) $fail('Неверный тип, данные или роль узла.');
            foreach (['x', 'y'] as $axis) if ((!is_int($n['position'][$axis] ?? null) && !is_float($n['position'][$axis] ?? null)) || !is_finite((float) $n['position'][$axis]) || abs($n['position'][$axis]) > 100000) $fail('Некорректная координата узла.');
            foreach (['title', 'text'] as $key) if (isset($n['data'][$key]) && (!is_string($n['data'][$key]) || mb_strlen($n['data'][$key]) > ($key === 'text' ? 16000 : 200))) $fail('Слишком длинный текст узла.');
            if ($n['type'] === 'source' && !in_array($n['data']['source'], ['request', 'variables'], true)) $fail('Недопустимый источник.');
            if ($n['type'] === 'model' && !is_int($n['data']['maxOutputTokens'])) $fail('Лимит ответа в схеме должен быть целым числом.');
            if ($n['type'] === 'serialize' && !in_array($n['data']['format'], ['messages', 'text', 'json'], true)) $fail('Неизвестный формат сериализации.');
            if ($n['type'] === 'context') {
                $d = $n['data'];
                if (!in_array($d['mode'], ['object', 'text', 'json'], true) || !is_array($d['inputs']) || !array_is_list($d['inputs']) || count($d['inputs']) < 1 || count($d['inputs']) > 16
                    || !is_array($d['order']) || !array_is_list($d['order']) || count($d['order']) !== count($d['inputs']) || count(array_filter($d['order'], 'is_string')) !== count($d['order'])
                    || count(array_unique($d['order'])) !== count($d['order']) || array_diff($d['order'], array_map(fn ($v) => 'in'.$v, range(1, 16)))) $fail('Нужно от 1 до 16 входов и полный порядок без повторов.');
                $seen = $seenKeys = [];
                foreach ($d['inputs'] as $p) {
                    if (!is_array($p) || array_diff(array_keys($p), ['id', 'label', 'key']) || !in_array($p['id'] ?? '', $d['order'], true) || isset($seen[$p['id']]) || !is_string($p['label'] ?? null) || mb_strlen($p['label']) > 80
                        || !is_string($p['key'] ?? null) || !preg_match('/\A[a-zA-Z][a-zA-Z0-9_]{0,59}\z/D', $p['key']) || in_array($p['key'], ['constructor', 'prototype', '__proto__'], true) || isset($seenKeys[$p['key']])) $fail('Неверные ключи или подписи входов.');
                    $seen[$p['id']] = true; $seenKeys[$p['key']] = true;
                }
            }
            $ids[$n['id']] = $n;
        }
        $edgeIds = [];
        $pairs = ['event' => ['source', 'prompt'], 'source' => ['context'], 'prompt' => ['context'], 'context' => ['serialize'], 'serialize' => ['model'], 'model' => ['tools'], 'tools' => ['reply']];
        foreach ($graph['edges'] as $e) {
            if (!is_array($e) || array_diff(array_keys($e), ['id', 'source', 'target', 'sourceHandle', 'targetHandle', 'channel']) || !is_string($e['id'] ?? null) || strlen($e['id']) > 180 || isset($edgeIds[$e['id']]) || !isset($ids[$e['source'] ?? ''], $ids[$e['target'] ?? ''])) $fail('Неверная или повторяющаяся связь.');
            $from = $ids[$e['source']]; $to = $ids[$e['target']];
            if (($e['channel'] ?? null) === 'stored') {
                $prefix = $scheme === 'english_exams' ? 'exam_stt_en_' : 'exam_stt_';
                $examiner = $scheme === 'english_exams' ? 'examiner_en' : 'examiner';
                if (!in_array($scheme, ['exams', 'english_exams'], true) || !in_array($e['source'], [$prefix.'primary__reply', $prefix.'secondary__reply'], true) || $e['target'] !== $examiner.'__source' || $e['sourceHandle'] !== 'out' || $e['targetHandle'] !== 'in') $fail('Неверный системный канал сохранённых расшифровок.');
                $edgeIds[$e['id']] = $e; continue;
            }
            if (array_key_exists('channel', $e)) $fail('Неизвестный канал связи.');
            if ($from['data']['role'] !== $to['data']['role'] || !in_array($to['type'], $pairs[$from['type']] ?? [], true) || ($e['sourceHandle'] ?? '') !== 'out' || ($to['type'] === 'context' ? !in_array($e['targetHandle'] ?? '', $to['data']['order'], true) : ($e['targetHandle'] ?? '') !== 'in')) $fail('Связь не соответствует контракту функционала. Между отдельными вызовами данные сохраняет сервис.');
            foreach ($edgeIds as $old) if ($old['source'] === $e['source'] && $old['target'] === $e['target'] && $old['targetHandle'] === $e['targetHandle']) $fail('Связь дублируется.');
            $edgeIds[$e['id']] = $e;
        }
        if (in_array($scheme, ['exams', 'english_exams'], true)) foreach (['primary', 'secondary'] as $pass) if (count(array_filter($graph['edges'], fn ($e) => ($e['channel'] ?? '') === 'stored' && $e['source'] === ($scheme === 'exams' ? 'exam_stt_' : 'exam_stt_en_').$pass.'__reply')) !== 1) $fail('Системный канал сохранения расшифровки обязателен.');
        foreach ($roles as $role) {
            $own = array_filter($ids, fn ($n) => $n['data']['role'] === $role);
            foreach (['event', 'context', 'serialize', 'model', 'tools', 'reply'] as $type) if (count(array_filter($own, fn ($n) => $n['type'] === $type)) !== 1) $fail('Для каждого вызова нужны событие, сборка, сериализация, модель, обработка и результат.');
            foreach ($own as $n) {
                $incoming = array_filter($graph['edges'], fn ($e) => $e['target'] === $n['id'] && ($e['channel'] ?? '') !== 'stored');
                $outgoing = array_filter($graph['edges'], fn ($e) => $e['source'] === $n['id']);
                if ($n['type'] !== 'event' && !$incoming || $n['type'] !== 'reply' && !$outgoing) $fail('Есть неподключённая карточка.');
                if (in_array($n['type'], ['source', 'prompt', 'serialize', 'model', 'tools', 'reply'], true) && count($incoming) !== 1) $fail('У шага исполнения должен быть один вход.');
            }
            $compiled = $this->compile($role, $graph);
            if (str_starts_with($role, 'exam_stt_') && ($compiled['assembly']['mode'] !== 'object' || $compiled['assembly']['format'] !== 'messages'
                || count(array_filter($own, fn ($n) => $n['type'] === 'source')) !== 1)) $fail('Распознавание принимает файл и инструкцию. Протокол аудиозапроса фиксирован, произвольная текстовая сериализация к нему неприменима.');
            if (($compiled['assembly']['parts'][0]['kind'] ?? '') !== 'prompt' || !array_filter($compiled['assembly']['parts'], fn ($p) => ($p['source'] ?? '') === 'request')) $fail('Сначала нужна инструкция, а данные реального ответа должны оставаться подключены.');
            app(AiProfiles::class)->validateConfig($role, array_diff_key($compiled, ['assembly' => 1]));
        }
        return $graph;
    }
}
