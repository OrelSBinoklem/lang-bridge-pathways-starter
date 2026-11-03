<?php

namespace App\Console\Commands;

use App\Models\GrammarTopic;
use App\Services\GrammarTableBindings;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;

class ConsolidateGrammarTables extends Command
{
    protected $signature = 'grammar:consolidate-tables {--apply : Update local bindings and extension metadata}';
    protected $description = 'Consolidate grammar references without changing questions, variants or progress';

    public function handle(GrammarTableBindings $bindings): int
    {
        if ($this->option('apply') && app()->environment('production')) {
            $this->error('Production requires a separately approved publication package.');
            return self::FAILURE;
        }
        $changes = [];
        foreach (GrammarTopic::with('page.blocks.sourceBlock.page.grammarTopic', 'page.blocks.page.grammarTopic')->get() as $topic) {
            if ($topic->page?->skill !== 'grammar') continue;
            $keys = $bindings->resolve($topic->table_keys ?? []);
            foreach ($topic->page->blocks as $block) {
                if ($block->type !== 'grammar') continue;
                $meta = $bindings->forBlock($block);
                $keys = array_values(array_unique(array_merge($keys, $meta['grammar_table_keys'])));
                if (!$block->source_block_id && $meta['is_extension']) {
                    $config = $block->config ?? [];
                    $next = array_replace($config, ['grammar_extension' => ['table_keys' => $meta['grammar_table_keys']]]);
                    if ($next !== $config) $changes[] = ['table' => 'lesson_blocks', 'id' => $block->id, 'field' => 'config', 'before' => $block->config, 'after' => $next];
                }
            }
            if ($keys !== ($topic->table_keys ?? [])) $changes[] = ['table' => 'grammar_topics', 'id' => $topic->id, 'field' => 'table_keys', 'before' => $topic->table_keys, 'after' => $keys];
        }
        $this->info(count($changes).' metadata changes; no questions, variants or progress are changed.');
        if (!$changes || !$this->option('apply')) return self::SUCCESS;
        $directory = base_path('.tmp/grammar-table-consolidation');
        File::ensureDirectoryExists($directory);
        $backup = $directory.'/'.now()->format('Ymd-His').'-'.bin2hex(random_bytes(4)).'.json';
        File::put($backup, json_encode($changes, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
        DB::transaction(function () use ($changes) {
            foreach ($changes as $change) {
                $row = DB::table($change['table'])->where('id', $change['id'])->lockForUpdate()->first();
                if (!$row || json_decode($row->{$change['field']} ?? 'null', true) !== $change['before']) {
                    throw new \RuntimeException('Grammar metadata changed concurrently; nothing was applied.');
                }
                DB::table($change['table'])->where('id', $change['id'])->update([
                    $change['field'] => json_encode($change['after'], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR),
                ]);
            }
        });
        $this->info('Saved metadata backup: '.$backup);
        return self::SUCCESS;
    }
}
