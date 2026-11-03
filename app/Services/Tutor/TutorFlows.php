<?php

namespace App\Services\Tutor;

use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class TutorFlows
{
    public const MAX_BYTES = 131072;

    private const TYPES = ['event', 'source', 'prompt', 'condition', 'compact', 'context', 'serialize', 'mcp', 'model', 'tools', 'reply', 'speech', 'module'];

    private const EVENTS = ['user.message', 'user.audio', 'tool.result', 'page.context', 'lesson.context'];

    private const SOURCES = ['recent_context', 'context_summary', 'important_notes', 'lesson_context', 'current_page', 'recent_tool_interactions', 'transcript_candidates', 'parameter_state', 'message_stream'];

    private const DATA_KEYS = [
        'event' => ['event'], 'source' => ['source', 'limitChars'], 'prompt' => ['text'],
        'condition' => ['field', 'operator', 'value'], 'compact' => ['keepPairs'], 'context' => ['order', 'inputs', 'mode'],
        'serialize' => ['format'], 'mcp' => ['service', 'query', 'tableKey', 'limit'],
        'model' => ['model', 'reasoning', 'maxOutputTokens'],
        'tools' => ['allCommands', 'allowedCommands', 'maxSteps', 'loop'], 'reply' => [], 'speech' => ['enabled'],
        'module' => ['definition'], 'module_input' => ['port'], 'module_output' => ['port'],
    ];

    private const PAIRS = [
        'event' => ['source', 'prompt', 'condition', 'compact', 'context', 'mcp'],
        'source' => ['context', 'condition', 'compact', 'mcp'], 'prompt' => ['context'],
        'condition' => ['source', 'prompt', 'condition', 'compact', 'context', 'mcp'],
        'compact' => ['source', 'prompt', 'condition', 'context', 'mcp'],
        'context' => ['context', 'serialize', 'model'], 'serialize' => ['model'], 'mcp' => ['context', 'mcp'], 'model' => ['tools'], 'tools' => ['reply'],
        'reply' => ['speech'], 'speech' => [],
    ];

    public function catalog(): array
    {
        return $this->readJson(resource_path('tutor-flow/catalog.json'));
    }

    public function defaultGraph(): array
    {
        return $this->validateGraph($this->decodeGraph(file_get_contents(resource_path('tutor-flow/default.json'))));
    }

    public function all(): array
    {
        $state = $this->state();

        return [
            'versions' => DB::table('tutor_flow_versions')->orderByDesc('id')->limit(50)
                ->get(['id', 'name', 'created_at', 'created_by'])->map(fn ($row) => $this->metadata($row))->all(),
            ...$this->pointers($state),
            'default_graph' => $this->defaultGraph(),
        ];
    }

    public function version(int $id): array
    {
        $row = DB::table('tutor_flow_versions')->where('id', $id)->first();
        abort_unless($row, 404);

        return [...$this->metadata($row), 'graph' => $this->decodeGraph($row->graph)];
    }

    /** A save never changes a snapshot or activates it. */
    public function save(array $graph, ?int $expectedHeadVersionId, int $createdBy): array
    {
        $graph = $this->validateGraph($graph);

        return DB::transaction(function () use ($graph, $expectedHeadVersionId, $createdBy) {
            $state = $this->state(lock: true);
            $this->expect($state->head_version_id, $expectedHeadVersionId);
            $id = DB::table('tutor_flow_versions')->insertGetId([
                'name' => $graph['name'], 'graph' => $this->encodeGraph($graph),
                'created_by' => $createdBy, 'created_at' => now(),
            ]);
            DB::table('tutor_flow_state')->where('id', 1)->update(['head_version_id' => $id]);
            $state->head_version_id = $id;

            return ['version' => $this->version($id), ...$this->pointers($state)];
        }, 3);
    }

    /** Activation of any historical snapshot is also the rollback operation. */
    public function activate(int $versionId, ?int $expectedActiveVersionId): array
    {
        return DB::transaction(function () use ($versionId, $expectedActiveVersionId) {
            $state = $this->state(lock: true);
            $this->expect($state->active_version_id, $expectedActiveVersionId);
            $version = $this->version($versionId);
            // Recheck against the current model catalog before publishing a snapshot.
            $this->validateGraph($version['graph']);
            DB::table('tutor_flow_state')->where('id', 1)->update(['active_version_id' => $versionId]);
            $state->active_version_id = $versionId;

            return ['version' => $version, ...$this->pointers($state)];
        }, 3);
    }

    public function deactivate(?int $expectedActiveVersionId): array
    {
        return DB::transaction(function () use ($expectedActiveVersionId) {
            $state = $this->state(lock: true);
            $this->expect($state->active_version_id, $expectedActiveVersionId);
            DB::table('tutor_flow_state')->where('id', 1)->update(['active_version_id' => null]);
            $state->active_version_id = null;

            return $this->pointers($state);
        }, 3);
    }

    /** Only server-owned graph configuration; base safety rules remain in the runtime. */
    public function active(): ?array
    {
        // One statement prevents a concurrent activation from mixing pointer and graph.
        $row = DB::table('tutor_flow_state as state')
            ->join('tutor_flow_versions as version', 'version.id', '=', 'state.active_version_id')
            ->where('state.id', 1)->first(['version.id', 'version.graph']);

        return $row ? ['version_id' => (int) $row->id, 'graph' => $this->validateGraph($this->decodeGraph($row->graph))] : null;
    }

    /** Canonical validation: accept declarative settings, never executable node data. */
    public function validateGraph(mixed $input): array
    {
        $expanded = 0;
        return $this->validateStructure($input, null, 0, $expanded);
    }

    public function validateModuleGraph(array $definition, int $depth, int &$expanded): array
    {
        return $this->validateStructure(['version' => 2, 'name' => $definition['name'], 'nodes' => $definition['nodes'], 'edges' => $definition['edges']], $definition, $depth, $expanded);
    }

    private function validateStructure(mixed $input, ?array $fragment, int $depth, int &$expanded): array
    {
        $graph = $this->object($input, ['version', 'name', 'engine', 'nodes', 'edges'], 'graph');
        $this->check(($graph['version'] ?? null) === 2, 'graph.version', 'Нужна версия схемы 2.');
        if (array_key_exists('engine', $graph)) {
            $this->check(in_array($graph['engine'], ['native', 'langgraph'], true), 'graph.engine', 'Выберите исполнитель native или langgraph.');
        }
        $this->text($graph['name'] ?? null, 120, 'graph.name', nonempty: true);
        $graph['name'] = trim($graph['name']);
        $this->check(strlen($this->encodeGraph($graph)) <= self::MAX_BYTES, 'graph', 'Схема превышает 128 КиБ.');
        foreach (['nodes' => 64, 'edges' => 128] as $key => $max) {
            $this->check(isset($graph[$key]) && is_array($graph[$key]) && array_is_list($graph[$key]) && count($graph[$key]) <= $max,
                'graph.'.$key, 'Неверный список или превышен лимит элементов.');
        }

        $models = array_keys($this->readJson(base_path('frontend/src/config/tutor-reasoning.json')));
        $expanded += count($graph['nodes']);
        $this->check($expanded <= 256, 'graph.nodes', 'Допустимо до 256 развёрнутых узлов.');
        $nodes = $counts = $events = [];
        $contextId = $contextOrder = $contextOrderPath = null;
        foreach ($graph['nodes'] as $index => $inputNode) {
            $path = 'graph.nodes.'.$index;
            $node = $this->object($inputNode, ['id', 'type', 'position', 'data'], $path);
            $this->identifier($node['id'] ?? null, $path.'.id');
            $this->check(! isset($nodes[$node['id']]), $path.'.id', 'Идентификаторы узлов должны быть уникальны.');
            $type = $node['type'] ?? null;
            $this->check(in_array($type, $fragment ? ['module_input', 'module_output', 'source', 'prompt', 'condition', 'context', 'serialize', 'mcp', 'model', 'module'] : self::TYPES, true), $path.'.type', 'Неизвестный тип узла.');
            if ($fragment) $this->check(! str_contains($node['id'], '__') && ! in_array($node['id'], ['__proto__', 'constructor', 'prototype'], true), $path.'.id', 'Небезопасный внутренний ID.');
            $position = $this->object($node['position'] ?? null, ['x', 'y'], $path.'.position');
            foreach (['x', 'y'] as $axis) {
                $value = $position[$axis] ?? null;
                $this->check((is_int($value) || is_float($value)) && is_finite((float) $value) && abs($value) <= 100000,
                    $path.'.position.'.$axis, 'Нужна конечная числовая координата до 100000.');
            }
            $data = $this->object($node['data'] ?? null, self::DATA_KEYS[$type], $path.'.data');
            $requiredKeys = $type === 'tools' ? ['allCommands', 'allowedCommands', 'maxSteps'] : self::DATA_KEYS[$type];
            $this->check($type === 'context' || array_diff($requiredKeys, array_keys($data)) === [], $path.'.data', 'Укажите все настройки узла.');
            $dataPath = $path.'.data';
            switch ($type) {
                case 'module':
                    $data['definition'] = app(TutorFlowModules::class)->validateDefinition($data['definition'], $depth + 1, $expanded);
                    break;
                case 'module_input':
                case 'module_output':
                    $this->check(in_array($data['port'], array_column($fragment[$type === 'module_input' ? 'inputs' : 'outputs'], 'id'), true), $dataPath, 'Неизвестный порт модуля.');
                    break;
                case 'event':
                    $this->check(in_array($data['event'], self::EVENTS, true), $dataPath.'.event', 'Неизвестное событие.');
                    $events[$data['event']] = ($events[$data['event']] ?? 0) + 1;
                    break;
                case 'source':
                    $this->check(in_array($data['source'], self::SOURCES, true), $dataPath.'.source', 'Неизвестный источник.');
                    $this->integer($data['limitChars'], 100, $data['source'] === 'message_stream' ? 120000 : 24000, $dataPath.'.limitChars');
                    break;
                case 'prompt':
                    $this->text($data['text'], 12000, $dataPath.'.text');
                    break;
                case 'condition':
                    $this->check(in_array($data['field'], ['transcript', 'current_page', 'user_message_count'], true), $dataPath.'.field', 'Неизвестное поле условия.');
                    if ($data['field'] === 'user_message_count') {
                        $this->check($data['operator'] === 'gt', $dataPath.'.operator', 'Для счётчика доступен только оператор gt.');
                        $this->check(is_string($data['value']) && preg_match('/\A[1-9][0-9]{0,2}\z/D', $data['value']) === 1 && (int) $data['value'] <= 200,
                            $dataPath.'.value', 'Порог должен быть строкой с целым числом от 1 до 200.');
                    } else {
                        $this->check(in_array($data['operator'], ['contains', 'equals'], true), $dataPath.'.operator', 'Неизвестный оператор.');
                        $this->text($data['value'], 300, $dataPath.'.value', nonempty: true);
                    }
                    break;
                case 'compact':
                    $this->integer($data['keepPairs'], 1, 10, $dataPath.'.keepPairs');
                    break;
                case 'context':
                    $contextId = $node['id'];
                    if (array_key_exists('mode', $data)) {
                        $this->check(in_array($data['mode'], ['object', 'text', 'json'], true), $dataPath.'.mode', 'Выберите объект, текст или JSON.');
                    }
                    if (array_key_exists('inputs', $data)) {
                        $this->check(is_array($data['inputs']) && array_is_list($data['inputs']) && count($data['inputs']) === 8, $dataPath.'.inputs', 'Нужны восемь входов.');
                        $portIds = $portKeys = [];
                        foreach ($data['inputs'] as $port) {
                            $port = $this->object($port, ['id', 'label', 'key'], $dataPath.'.inputs');
                            $this->check(is_string($port['id'] ?? null) && preg_match('/\Ain[1-8]\z/D', $port['id']) === 1 && ! isset($portIds[$port['id']]), $dataPath.'.inputs', 'Входы должны быть уникальны.');
                            $this->text($port['label'] ?? null, 80, $dataPath.'.inputs.label');
                            $key = $port['key'] ?? null;
                            $this->check(is_string($key) && preg_match('/\A[a-zA-Z][a-zA-Z0-9_]{0,59}\z/D', $key) === 1 && ! in_array($key, ['__proto__', 'constructor', 'prototype', 'current_request'], true) && ! isset($portKeys[$key]), $dataPath.'.inputs.key', 'Ключи должны быть безопасны и уникальны.');
                            $portIds[$port['id']] = $portKeys[$key] = true;
                        }
                    }
                    if (array_key_exists('order', $data)) {
                        $contextOrderPath = $dataPath.'.order';
                        $contextOrder = $data['order'];
                        $this->check(is_array($contextOrder) && array_is_list($contextOrder) && count($contextOrder) <= 65,
                            $contextOrderPath, 'Порядок контекста должен быть списком до 65 элементов.');
                        $seen = [];
                        foreach ($contextOrder as $indexInOrder => $id) {
                            $this->check(is_string($id), $contextOrderPath.'.'.$indexInOrder, 'Нужен строковый ID блока контекста.');
                            $this->check(! isset($seen[$id]), $contextOrderPath.'.'.$indexInOrder, 'Блок контекста повторяется.');
                            $seen[$id] = true;
                        }
                        $this->check(isset($seen['$request']), $contextOrderPath, 'Порядок контекста должен содержать ровно один $request.');
                    }
                    break;
                case 'serialize':
                    $this->check(in_array($data['format'], ['messages', 'text', 'json'], true), $dataPath.'.format', 'Неизвестный формат запроса.');
                    break;
                case 'mcp':
                    $this->check(in_array($data['service'], ['web_search', 'grammar_search', 'grammar_table'], true), $dataPath.'.service', 'Неизвестный MCP-инструмент.');
                    $this->text($data['query'], 1000, $dataPath.'.query');
                    $this->check(is_string($data['tableKey']) && preg_match('/\A[a-zA-Z0-9_-]{0,100}\z/D', $data['tableKey']) === 1, $dataPath.'.tableKey', 'Неверный ID таблицы.');
                    $this->integer($data['limit'], 1, 8, $dataPath.'.limit');
                    break;
                case 'model':
                    $this->check(in_array($data['model'], ['preset', ...$models], true), $dataPath.'.model', 'Выберите модель из каталога.');
                    $this->check(in_array($data['reasoning'], ['preset', 'none', 'low', 'medium', 'high', 'xhigh', 'max'], true), $dataPath.'.reasoning', 'Неизвестный режим мышления.');
                    $this->integer($data['maxOutputTokens'], 700, 8192, $dataPath.'.maxOutputTokens');
                    break;
                case 'tools':
                    if (array_key_exists('loop', $data)) {
                        $loop = $this->object($data['loop'], ['timeoutMs', 'maxRepeatedCommand', 'maxCostUsd'], $dataPath.'.loop');
                        $this->integer($loop['timeoutMs'] ?? null, 1000, 120000, $dataPath.'.loop.timeoutMs');
                        $this->integer($loop['maxRepeatedCommand'] ?? null, 2, 3, $dataPath.'.loop.maxRepeatedCommand');
                        if (array_key_exists('maxCostUsd', $loop)) $this->check((is_int($loop['maxCostUsd']) || is_float($loop['maxCostUsd'])) && is_finite((float) $loop['maxCostUsd']) && $loop['maxCostUsd'] >= 0.001 && $loop['maxCostUsd'] <= 10, $dataPath.'.loop.maxCostUsd', 'Бюджет от 0.001 до 10 USD.');
                        $data['loop'] = $loop;
                    }
                    $this->check(is_bool($data['allCommands']), $dataPath.'.allCommands', 'Нужно логическое значение.');
                    $commands = $data['allowedCommands'];
                    $this->check(is_array($commands) && array_is_list($commands) && count($commands) <= 30, $dataPath.'.allowedCommands', 'Допустимо до 30 команд.');
                    foreach ($commands as $command) {
                        $this->check(is_string($command) && preg_match('/\A[a-z][a-z0-9_.]{0,99}\z/D', $command) === 1,
                            $dataPath.'.allowedCommands', 'Неверное имя команды.');
                    }
                    $this->integer($data['maxSteps'], 1, 6, $dataPath.'.maxSteps');
                    break;
                case 'speech':
                    $this->check(is_bool($data['enabled']), $dataPath.'.enabled', 'Нужно логическое значение.');
                    break;
            }
            // Keep empty settings as objects for the JavaScript graph contract.
            $node['data'] = $data === [] ? (object) [] : $data;
            $graph['nodes'][$index] = $node;
            $nodes[$node['id']] = $node;
            $counts[$type] = ($counts[$type] ?? 0) + 1;
        }
        if (! $fragment) {
        foreach (['model', 'tools', 'reply', 'speech'] as $type) {
            $this->check(($counts[$type] ?? 0) === 1, 'graph.nodes', 'Нужен ровно один узел каждого типа исполнения.');
        }
        $this->check(($counts['context'] ?? 0) >= 1, 'graph.nodes', 'Нужна сборка контекста.');
        $this->check(($counts['serialize'] ?? 0) <= 1, 'graph.nodes', 'Допустим один конечный сериализатор.');
        $this->check(($counts['compact'] ?? 0) <= 1, 'graph.nodes', 'Допустим не более одного узла сжатия.');
        foreach (['user.message', 'user.audio', 'tool.result'] as $event) {
            $this->check(($events[$event] ?? 0) === 1, 'graph.nodes', 'Нужен ровно один источник каждого основного события.');
        }
        }
        foreach ($nodes as $module) if ($module['type'] === 'module') foreach ($nodes as $node) $this->check(! str_starts_with($node['id'], $module['id'].'__'), 'graph.nodes', 'ID совпадает с пространством имён модуля.');

        $edgeIds = $signatures = $outgoing = $incoming = [];
        foreach ($nodes as $id => $_) {
            $outgoing[$id] = [];
            $incoming[$id] = 0;
        }
        foreach ($graph['edges'] as $index => $inputEdge) {
            $path = 'graph.edges.'.$index;
            $edge = $this->object($inputEdge, ['id', 'source', 'target', 'sourceHandle', 'targetHandle'], $path);
            foreach (['id', 'source', 'target'] as $key) {
                $this->identifier($edge[$key] ?? null, $path.'.'.$key);
            }
            $this->check(! isset($edgeIds[$edge['id']]), $path.'.id', 'Идентификаторы связей должны быть уникальны.');
            $from = $nodes[$edge['source']] ?? null;
            $to = $nodes[$edge['target']] ?? null;
            $this->check($from && $to && $edge['source'] !== $edge['target'], $path, 'Неизвестный узел или связь с самим собой.');
            $this->check($this->modulePairAllowed($from['type'], $to['type'], $fragment !== null), $path, 'Несовместимые типы портов.');
            if ($from['type'] === 'source' && in_array($to['type'], ['condition', 'compact'], true)) {
                $this->check($from['data']['source'] === 'message_stream', $path, 'Только поток сообщений может запускать условие или сжатие.');
                $this->check($to['type'] !== 'condition' || $to['data']['field'] === 'user_message_count',
                    $path, 'Поток сообщений можно подключить только к условию счётчика сообщений.');
            }
            $handle = $edge['sourceHandle'] ?? null;
            $this->check($from['type'] === 'module' ? in_array($handle, array_column($from['data']['definition']['outputs'], 'id'), true) : ($from['type'] === 'condition' ? in_array($handle, ['true', 'false'], true) : ($handle === null || $handle === 'out')),
                $path.'.sourceHandle', 'Неверный выходной порт.');
            $targetHandle = $edge['targetHandle'] ?? null;
            $toData = (array) $to['data'];
            $this->check($to['type'] === 'module' ? in_array($targetHandle, array_column($toData['definition']['inputs'], 'id'), true) : ($to['type'] === 'context' && isset($toData['inputs']) ? in_array($targetHandle, array_column($toData['inputs'], 'id'), true) : ($targetHandle === null || $targetHandle === 'in')), $path.'.targetHandle', 'Неверный входной порт.');
            $signature = $edge['source'].':'.($handle ?? 'out').':'.$edge['target'].':'.($targetHandle ?? 'in');
            $this->check(! isset($signatures[$signature]), $path, 'Повторяющаяся связь.');
            $edgeIds[$edge['id']] = $signatures[$signature] = true;
            $outgoing[$edge['source']][] = $edge['target'];
            $incoming[$edge['target']]++;
        }

        $remaining = $incoming;
        $queue = array_keys(array_filter($remaining, fn ($degree) => $degree === 0));
        $order = [];
        while ($queue !== []) {
            $id = array_shift($queue);
            $order[] = $id;
            foreach ($outgoing[$id] as $target) {
                if (--$remaining[$target] === 0) {
                    $queue[] = $target;
                }
            }
        }
        $this->check(count($order) === count($nodes), 'graph.edges', 'В схеме есть цикл.');

        // With a single sink, reverse reachability proves every branch reaches speech.
        $reachesSpeech = $reachesContext = [];
        foreach (array_reverse($order) as $id) {
            $node = $nodes[$id];
            $reachesSpeech[$id] = $node['type'] === 'speech';
            $reachesContext[$id] = $node['id'] === $contextId;
            foreach ($outgoing[$id] as $target) {
                $reachesSpeech[$id] = $reachesSpeech[$id] || $reachesSpeech[$target];
                $reachesContext[$id] = $reachesContext[$id] || $reachesContext[$target];
            }
            if (! $fragment) $this->check($reachesSpeech[$id], 'graph.edges', 'Каждый узел должен иметь путь к озвучке.');
            $this->check(in_array($node['type'], ['event', 'module_input'], true) || $incoming[$id] > 0, 'graph.edges', 'У каждого узла, кроме событий и входов, должен быть вход.');
            $this->check($node['type'] !== 'model' || $incoming[$id] === 1, 'graph.edges', 'Модель должна получать одну сборку контекста.');
            $this->check($node['type'] !== 'serialize' || $incoming[$id] === 1, 'graph.edges', 'Сериализатор должен получать одну сборку.');
        }
        if ($fragment) {
            foreach (['module_input' => 'inputs', 'module_output' => 'outputs'] as $type => $ports) foreach ($fragment[$ports] as $port) $this->check(count(array_filter($nodes, fn ($n) => $n['type'] === $type && $n['data']['port'] === $port['id'])) === 1, 'definition.'.$ports, 'Каждому порту нужен один граничный узел.');
            $fromInput = $toOutput = [];
            foreach ($order as $id) {
                $fromInput[$id] = ($fromInput[$id] ?? false) || $nodes[$id]['type'] === 'module_input';
                foreach ($outgoing[$id] as $target) $fromInput[$target] = ($fromInput[$target] ?? false) || $fromInput[$id];
            }
            foreach (array_reverse($order) as $id) {
                $toOutput[$id] = $nodes[$id]['type'] === 'module_output';
                foreach ($outgoing[$id] as $target) $toOutput[$id] = $toOutput[$id] || $toOutput[$target];
                $this->check($fromInput[$id] && $toOutput[$id], 'definition.nodes', 'Узел должен лежать на пути от входа к выходу.');
                $this->check($nodes[$id]['type'] !== 'module_input' || $incoming[$id] === 0, 'definition.edges', 'У входного узла не может быть входов.');
                $this->check($nodes[$id]['type'] !== 'module_output' || $outgoing[$id] === [], 'definition.edges', 'У выходного узла не может быть выходов.');
            }
        }

        foreach ($nodes as $contextNode) {
          if ($contextNode['type'] !== 'context') continue;
          $contextData = (array) $contextNode['data'];
          foreach ($contextData['order'] ?? [] as $index => $id) {
            if ($id === '$request') {
                continue;
            }
            if (isset($contextData['inputs'])) {
                $this->check(in_array($id, array_column($contextData['inputs'], 'id'), true), 'graph.nodes', 'Порядок должен содержать ID входов.');
                continue;
            }
            $this->check($id !== $contextNode['id'] && isset($nodes[$id]) && in_array($nodes[$id]['type'], ['source', 'prompt', 'mcp', 'context', 'module', ...($fragment ? ['module_input'] : [])], true),
                $contextOrderPath.'.'.$index, 'Порядок контекста может содержать только ID источников и инструкций.');
            $seenReach = [$id => true];
            foreach ($order as $candidate) if (isset($seenReach[$candidate])) foreach ($outgoing[$candidate] as $target) $seenReach[$target] = true;
            $this->check(isset($seenReach[$contextNode['id']]), $contextOrderPath.'.'.$index, 'Блок должен иметь направленный путь к сборке контекста.');
          }
        }

        return $graph;
    }

    private function modulePairAllowed(string $from, string $to, bool $fragment): bool
    {
        $processing = ['source', 'prompt', 'condition', 'context', 'serialize', 'mcp', 'module'];
        if ($fragment && ($from === 'module_output' || $to === 'module_input')) return false;
        if ($fragment && $to === 'module_output') return in_array($from, [...$processing, 'module_input', 'model'], true);
        if ($fragment && $from === 'module_input') return in_array($to, $processing, true);
        if ($to === 'module') return in_array($from, [...$processing, 'event', 'compact'], true);
        if ($from === 'module') return in_array($to, [...$processing, 'model'], true);
        return in_array($to, self::PAIRS[$from] ?? [], true);
    }

    private function state(bool $lock = false): object
    {
        $query = DB::table('tutor_flow_state')->where('id', 1);
        $state = ($lock ? $query->lockForUpdate() : $query)->first();
        abort_unless($state, 503, 'Хранилище потоков не инициализировано.');

        return $state;
    }

    private function pointers(object $state): array
    {
        return ['head_version_id' => $state->head_version_id === null ? null : (int) $state->head_version_id,
            'active_version_id' => $state->active_version_id === null ? null : (int) $state->active_version_id];
    }

    private function expect(mixed $actual, ?int $expected): void
    {
        abort_unless(($actual === null ? null : (int) $actual) === $expected, 409, 'Поток уже изменён. Обновите список версий.');
    }

    private function metadata(object $row): array
    {
        return ['id' => (int) $row->id, 'name' => $row->name,
            'created_at' => \Carbon\CarbonImmutable::parse($row->created_at, config('app.timezone', 'UTC'))->toIso8601String(),
            'created_by' => (int) $row->created_by];
    }

    private function readJson(string $path): array
    {
        return json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    }

    private function decodeGraph(string $json): array
    {
        $graph = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        $restore = function (array &$container) use (&$restore): void {
            foreach ($container['nodes'] as &$node) {
                if ($node['data'] === []) $node['data'] = (object) [];
                if ($node['type'] === 'module') $restore($node['data']['definition']);
            }
        };
        $restore($graph);

        return $graph;
    }

    private function encodeGraph(array $graph): string
    {
        try {
            return json_encode($graph, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (\JsonException) {
            throw ValidationException::withMessages(['graph' => 'Схема должна содержать только корректные JSON-данные.']);
        }
    }

    private function object(mixed $value, array $keys, string $path): array
    {
        $isObject = $value instanceof \stdClass;
        if ($value instanceof \stdClass) {
            $value = (array) $value;
        }
        $this->check(is_array($value) && ($isObject || ! array_is_list($value)), $path, 'Нужен объект настроек.');
        $this->check(array_diff(array_keys($value), $keys) === [], $path, 'Неизвестные поля запрещены.');

        return $value;
    }

    private function identifier(mixed $value, string $path): void
    {
        $this->check(is_string($value) && preg_match('/\A[a-zA-Z0-9_-]{1,80}\z/D', $value) === 1, $path, 'Неверный идентификатор.');
    }

    private function text(mixed $value, int $max, string $path, bool $nonempty = false): void
    {
        $this->check(is_string($value) && mb_strlen($value) <= $max && (! $nonempty || trim($value) !== ''), $path, 'Неверный текст или превышен лимит символов.');
    }

    private function integer(mixed $value, int $min, int $max, string $path): void
    {
        $this->check(is_int($value) && $value >= $min && $value <= $max, $path, 'Целое число вне допустимого диапазона.');
    }

    private function check(bool $condition, string $path, string $message): void
    {
        if (! $condition) {
            throw ValidationException::withMessages([$path => $message]);
        }
    }
}
