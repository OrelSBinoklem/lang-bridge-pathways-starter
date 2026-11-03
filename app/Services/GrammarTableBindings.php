<?php

namespace App\Services;

use App\Models\LessonBlock;

class GrammarTableBindings
{
    private ?array $catalog = null;

    public function catalog(): array
    {
        return $this->catalog ??= json_decode(file_get_contents(base_path(
            'frontend/src/features/grammar/data/practiceConsolidation.json'
        )), true, 512, JSON_THROW_ON_ERROR);
    }

    public function resolve(array $keys): array
    {
        $retired = $this->catalog()['retired'];
        return array_values(array_unique(array_merge([], ...array_map(
            fn ($key) => $retired[$key]['tables'] ?? [$key], $keys
        ))));
    }

    /** Source blocks own bindings too; placements inherit them without copying exercises. */
    public function forBlock(LessonBlock $block): array
    {
        $source = $block->source_block_id ? $block->sourceBlock : $block;
        if (!$source || $source->type !== 'grammar') return ['is_extension' => false, 'grammar_table_keys' => []];
        $saved = $source->config['grammar_extension'] ?? null;
        if (is_array($saved) && is_array($saved['table_keys'] ?? null)) {
            return ['is_extension' => true, 'grammar_table_keys' => $this->resolve($saved['table_keys'])];
        }
        $keys = $source->page?->grammarTopic?->table_keys ?? [];
        $extra = $this->catalog()['additional_sources'][$source->page?->slug ?? ''] ?? null;
        if ($extra) {
            $stage = substr($source->seed_key ?? '', strlen($source->page->slug) + 1);
            return ['is_extension' => !isset($extra['regular_stages'][$stage]),
                'grammar_table_keys' => $extra['regular_stages'][$stage] ?? $extra['tables']];
        }
        $retired = $this->catalog()['retired'];
        foreach ($retired as $key => $entry) {
            if ($entry['slug'] === $source->page?->slug) {
                $stage = str_starts_with($source->seed_key ?? '', $entry['slug'].'-')
                    ? substr($source->seed_key, strlen($entry['slug']) + 1) : '';
                return ['is_extension' => true, 'grammar_table_keys' => $entry['stages'][$stage] ?? $entry['tables']];
            }
        }
        return ['is_extension' => (bool) array_intersect($keys, array_keys($retired)), 'grammar_table_keys' => $this->resolve($keys)];
    }
}
