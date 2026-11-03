<?php

namespace App\Services\Tutor;

use App\Models\AppSetting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

/** A project consists of versioned application-module references, never copied bot settings. */
class TutorProjectSchemes
{
    private const PREFIX = 'tutor_project_scheme:';

    public function contract(): array
    {
        return json_decode(file_get_contents(resource_path('ai-studio/project.json')), true, flags: JSON_THROW_ON_ERROR);
    }

    public function defaultGraph(bool $main = true): array
    {
        return ['version' => 2, 'name' => $main ? 'Главная схема проекта' : 'Новая схема',
            'modules' => $main ? array_map(fn ($module) => ['id' => $module['id'], 'position' => $module['position'], 'expanded' => false], $this->contract()['modules']) : []];
    }

    private function document(string $id, ?string $raw): array
    {
        $state = $raw === null ? ['graph' => $this->defaultGraph(), 'version' => 0, 'history' => []] : json_decode($raw, true, flags: JSON_THROW_ON_ERROR);

        // Upgrade the representation only. GET must not rewrite saved history,
        // active versions or CAS revisions issued for a legacy v1 document.
        return ['id' => $id, 'graph' => $this->validate($id, $state['graph']), 'version' => $state['version'], 'revision' => hash('sha256', json_encode($state, JSON_THROW_ON_ERROR))];
    }

    public function all(): array
    {
        $stored = AppSetting::where('key', 'like', self::PREFIX.'%')->orderBy('key')->pluck('value', 'key');
        $documents = [$this->document('main', $stored[self::PREFIX.'main'] ?? null)];
        foreach ($stored as $key => $raw) {
            if (! str_starts_with($key, self::PREFIX)) {
                continue;
            }
            $id = substr($key, strlen(self::PREFIX));
            if (preg_match('/\Aproject_[a-f0-9-]{36}\z/D', $id)) {
                $documents[] = $this->document($id, $raw);
            }
        }

        return ['schemes' => $documents, 'contract' => $this->contract(), 'modules' => app(TutorProjectModules::class)->all()];
    }

    public function blocks(): array
    {
        return ['modules' => app(TutorProjectModules::class)->all(true)];
    }

    public function validate(string $id, mixed $graph): array
    {
        $fail = fn () => throw ValidationException::withMessages(['graph' => 'Нужны название и уникальные ссылки на модули с координатами.']);
        $allowed = array_column($this->contract()['modules'], 'id');
        $legacy = is_array($graph) && ($graph['version'] ?? null) === 1;
        $field = $legacy ? 'groups' : 'modules';
        if (! is_array($graph) || array_diff(array_keys($graph), ['version', 'name', $field]) || ! in_array($graph['version'] ?? null, [1, 2], true)
            || ! is_string($graph['name'] ?? null) || ! mb_strlen(trim($graph['name'])) || mb_strlen($graph['name']) > 120
            || ! is_array($graph[$field] ?? null) || ! array_is_list($graph[$field]) || count($graph[$field]) > count($allowed)) {
            $fail();
        }
        $seen = [];
        $modules = [];
        foreach ($graph[$field] as $module) {
            if (! is_array($module) || array_diff(array_keys($module), $legacy ? ['id', 'position'] : ['id', 'position', 'expanded', 'detailPosition'])
                || ! in_array($module['id'] ?? null, $allowed, true) || isset($seen[$module['id']])
                || (array_key_exists('expanded', $module) && ! is_bool($module['expanded']))) {
                $fail();
            }
            foreach (['position', ...(array_key_exists('detailPosition', $module) ? ['detailPosition'] : [])] as $key) {
                if (! is_array($module[$key] ?? null) || array_diff(array_keys($module[$key]), ['x', 'y']) || count($module[$key]) !== 2) {
                    $fail();
                }
                foreach (['x', 'y'] as $axis) {
                    $value = $module[$key][$axis] ?? null;
                    if ((! is_int($value) && ! is_float($value)) || ! is_finite((float) $value) || abs($value) > 100000) {
                        $fail();
                    }
                }
            }
            $seen[$module['id']] = true;
            $modules[] = ['id' => $module['id'], 'position' => $module['position'], 'expanded' => $module['expanded'] ?? false,
                ...(isset($module['detailPosition']) ? ['detailPosition' => $module['detailPosition']] : [])];
        }
        if ($id === 'main' && count($seen) !== count($allowed)) {
            throw ValidationException::withMessages(['graph' => 'В главной схеме должны оставаться все рабочие модули проекта.']);
        }

        return ['version' => 2, 'name' => trim($graph['name']), 'modules' => $modules];
    }

    public function create(string $name, int $admin): array
    {
        $id = 'project_'.Str::uuid();
        $graph = $this->validate($id, [...$this->defaultGraph(false), 'name' => $name]);
        DB::transaction(function () use ($id, $graph, $admin) {
            // One shared catalogue lock serializes creation even when different IDs are generated.
            DB::table('app_settings')->insertOrIgnore(['key' => 'tutor_project_scheme_catalog_lock', 'value' => '{}', 'created_at' => now(), 'updated_at' => now()]);
            DB::table('app_settings')->where('key', 'tutor_project_scheme_catalog_lock')->lockForUpdate()->first();
            abort_if(AppSetting::where('key', 'like', self::PREFIX.'project_%')->count() >= 20, 422, 'Допустимо до 20 дополнительных схем.');
            AppSetting::create(['key' => self::PREFIX.$id, 'value' => json_encode(['graph' => $graph, 'version' => 1, 'history' => [], 'updated_by' => $admin], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)]);
        });

        return ['id' => $id, ...$this->all()];
    }

    public function save(string $id, mixed $graph, string $expected, int $admin): array
    {
        abort_unless($id === 'main' || preg_match('/\Aproject_[a-f0-9-]{36}\z/D', $id), 404);
        $graph = $this->validate($id, $graph);
        DB::transaction(function () use ($id, $graph, $expected, $admin) {
            $key = self::PREFIX.$id;
            if ($id === 'main') {
                DB::table('app_settings')->insertOrIgnore(['key' => $key, 'value' => 'null', 'created_at' => now(), 'updated_at' => now()]);
            }
            $row = AppSetting::where('key', $key)->lockForUpdate()->first();
            abort_unless($row, 404);
            $raw = $row->value === 'null' ? null : $row->value;
            $current = $this->document($id, $raw);
            abort_unless(hash_equals($current['revision'], $expected), 409, 'Схему уже изменили. Обновите список; ваш черновик сохранён на экране.');
            $old = $raw === null ? ['history' => []] : json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
            $history = array_slice([['graph' => $old['graph'] ?? $current['graph'], 'version' => $current['version']], ...$old['history']], 0, 10);
            $row->update(['value' => json_encode(['graph' => $graph, 'version' => $current['version'] + 1, 'history' => $history, 'updated_by' => $admin], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE)]);
        });

        return $this->all();
    }
}
