<?php

namespace App\Services\Tutor;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

/** Immutable declarative snapshots. A catalogue save never updates embedded instances. */
class TutorFlowModules
{
    private const HEAD_PREFIX = 'tutor-flow-module-head:';

    private const VERSION_PREFIX = 'tutor-flow-module-version:';

    public function validateDefinition(mixed $value, int $depth = 1, ?int &$expanded = null): array
    {
        $expanded ??= 0;
        $this->check($depth <= 3, 'Вложенность модулей не должна превышать 3.');
        $definition = $this->object($value, ['id', 'name', 'version', 'inputs', 'outputs', 'nodes', 'edges']);
        $this->check($this->safeId($definition['id']) && is_string($definition['name']) && trim($definition['name']) !== '' && mb_strlen($definition['name']) <= 120 && is_int($definition['version']) && $definition['version'] >= 1 && $definition['version'] <= 9007199254740991, 'Неверный ID, название или версия модуля.');
        $this->check(strlen(json_encode($definition, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)) <= TutorFlows::MAX_BYTES, 'Модуль превышает 128 КиБ.');
        foreach (['inputs', 'outputs'] as $key) {
            $ports = $definition[$key];
            $this->check(is_array($ports) && array_is_list($ports) && count($ports) >= 1 && count($ports) <= 16, 'Нужно от 1 до 16 портов каждого направления.');
            $ids = [];
            foreach ($ports as $index => $port) {
                $port = $this->object($port, ['id', 'label']);
                $this->check($this->safeId($port['id']) && ! isset($ids[$port['id']]) && is_string($port['label']) && trim($port['label']) !== '' && mb_strlen($port['label']) <= 80, 'Порты должны иметь уникальные безопасные ID и названия.');
                $ids[$port['id']] = true;
                $definition[$key][$index] = $port;
            }
        }
        $graph = app(TutorFlows::class)->validateModuleGraph($definition, $depth, $expanded);

        return [...$definition, 'name' => $graph['name'], 'nodes' => $graph['nodes'], 'edges' => $graph['edges']];
    }

    /** All versions, newest first per module. Nothing is pruned or upgraded on read. */
    public function all(): array
    {
        if (! Schema::hasTable('app_settings')) {
            return [];
        }
        $modules = DB::table('app_settings')->where('key', 'like', self::VERSION_PREFIX.'%')->pluck('value')
            ->map(fn ($raw) => $this->decodeDefinition($raw))->all();
        usort($modules, fn ($a, $b) => strcmp($a['id'], $b['id']) ?: $b['version'] <=> $a['version']);

        return $modules;
    }

    public function save(mixed $definition, ?int $expectedVersion): array
    {
        $definition = $this->validateDefinition($definition);
        abort_unless(Schema::hasTable('app_settings'), 503, 'Хранилище настроек недоступно.');

        return DB::transaction(function () use ($definition, $expectedVersion) {
            // Hex preserves case-sensitive IDs even on a case-insensitive SQL collation.
            $storageId = bin2hex($definition['id']);
            $headKey = self::HEAD_PREFIX.$storageId;
            DB::table('app_settings')->insertOrIgnore(['key' => $headKey, 'value' => 'null', 'created_at' => now(), 'updated_at' => now()]);
            $row = DB::table('app_settings')->where('key', $headKey)->lockForUpdate()->first();
            $head = json_decode($row->value, true, 512, JSON_THROW_ON_ERROR);
            abort_unless($head === $expectedVersion, 409, 'Модуль уже изменён. Обновите каталог версий.');
            $this->check($definition['version'] === ($head ?? 0) + 1, 'Версия нового снимка должна следовать за ожидаемой версией.');
            DB::table('app_settings')->insert(['key' => self::VERSION_PREFIX.$storageId.':'.$definition['version'], 'value' => json_encode($definition, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), 'created_at' => now(), 'updated_at' => now()]);
            DB::table('app_settings')->where('key', $headKey)->update(['value' => json_encode($definition['version'], JSON_THROW_ON_ERROR), 'updated_at' => now()]);

            return ['definition' => $definition, 'modules' => $this->all()];
        }, 3);
    }

    private function decodeDefinition(string $json): array
    {
        $definition = json_decode($json, true, 512, JSON_THROW_ON_ERROR);
        $restore = function (array &$container) use (&$restore): void {
            foreach ($container['nodes'] as &$node) {
                if ($node['data'] === []) {
                    $node['data'] = (object) [];
                }
                if ($node['type'] === 'module') {
                    $restore($node['data']['definition']);
                }
            }
        };
        $restore($definition);

        return $definition;
    }

    private function safeId(mixed $value): bool
    {
        return is_string($value) && preg_match('/\A[a-zA-Z0-9_-]{1,80}\z/D', $value) === 1 && ! str_contains($value, '__') && ! in_array($value, ['__proto__', 'constructor', 'prototype', 'current_request'], true);
    }

    private function object(mixed $value, array $keys): array
    {
        if ($value instanceof \stdClass) {
            $value = (array) $value;
        }
        $this->check(is_array($value) && ! array_is_list($value) && array_diff(array_keys($value), $keys) === [] && array_diff($keys, array_keys($value)) === [], 'Неверные поля определения модуля.');

        return $value;
    }

    private function check(bool $condition, string $message): void
    {
        if (! $condition) {
            throw ValidationException::withMessages(['definition' => $message]);
        }
    }
}
