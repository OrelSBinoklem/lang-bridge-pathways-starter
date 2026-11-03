<?php

namespace App\Console\Commands;

use App\Models\LessonBlock;
use App\Services\ContentAudit\PracticeVariantDiversity;
use App\Services\CoursePracticeVariants;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use RuntimeException;

class SelectCoursePracticeVariants extends Command
{
    protected $signature = 'course:select-practice-variants {--grammar : Select grammar blocks instead of the four course skills} {--apply : Archive locally after writing an audit report}';
    protected $description = 'Select three diverse practice variants, optionally grammar; never change exams, content or progress';

    public function handle(PracticeVariantDiversity $selector, CoursePracticeVariants $policy): int
    {
        try {
            if ($this->option('apply')) {
                $db = DB::connection()->getConfig();
                $host = gethostbyname((string) ($db['host'] ?? ''));
                $local = app()->environment('local') && str_starts_with($host, '127.')
                    && empty($db['read']) && empty($db['write']);
                $test = app()->environment('testing') && ($db['driver'] ?? '') === 'sqlite' && ($db['database'] ?? '') === ':memory:';
                if (! $local && ! $test) throw new RuntimeException('Apply is limited to local loopback DB or isolated tests.');
            }
            $report = DB::transaction(function () use ($selector, $policy) {
                $query = LessonBlock::with('page', 'variants')->whereNull('source_block_id')
                    ->orderBy('id');
                if ($this->option('grammar')) {
                    $query->where('type', 'grammar')->whereHas('page', fn ($q) => $q->where('is_published', true)
                        ->where('status', 'published')->where('slug', '!=', 'grammar-a1-alphabet'));
                } else {
                    $query->whereIn('type', CoursePracticeVariants::SKILLS)
                        ->whereHas('page', fn ($q) => $q->whereNotNull('course_group_id')->where('learn_lang', 'lv')
                            ->whereIn('skill', CoursePracticeVariants::SKILLS)->where('is_published', true)->where('status', 'published'));
                }
                if ($this->option('apply')) $query->lockForUpdate();
                $rows = []; $changed = 0;
                foreach ($query->get() as $block) {
                    if (! $this->option('grammar') && ! $policy->isCoursePractice($block)) continue;
                    if ($this->option('grammar') && (str_starts_with((string) $block->seed_key, 'grammar-a1-alphabet-')
                        || ($block->variants->first()?->config['task_kind'] ?? null) === 'grammar_items')) continue;
                    $variants = $block->variants()->where('is_published', true)->orderBy('position')->orderBy('id');
                    if ($this->option('apply')) $variants->lockForUpdate();
                    $variants = $variants->get();
                    if ($variants->isEmpty()) continue;
                    if ($variants->count() > 20) throw new RuntimeException('Unexpected variant count in block '.$block->id.'. Nothing applied.');
                    $choice = $selector->choose($variants->map(fn ($v) => $v->only(['id', 'position', 'config']))->all());
                    $before = $variants->mapWithKeys(fn ($v) => [$v->id => ['archived_at' => $v->getRawOriginal('practice_archived_at'),
                        'position' => $v->position, 'title' => $v->title, 'sha256' => hash('sha256', json_encode($v->config, JSON_THROW_ON_ERROR))]])->all();
                    $rows[] = ['block_id' => $block->id, 'group_id' => $block->page->course_group_id, 'level' => $block->page->level,
                        'skill' => $block->type, 'slug' => $block->page->slug, 'before' => $before] + $choice;
                }
                $directory = base_path('.tmp/course-practice-variants'); File::ensureDirectoryExists($directory);
                $path = $directory.'/'.now()->format('Ymd-His').'-'.bin2hex(random_bytes(3)).'.json';
                $report = ['algorithm' => PracticeVariantDiversity::VERSION, 'applied' => false, 'rows' => $rows];
                // The previous archive state is recorded before touching rows; content/audio/IDs stay intact.
                if (file_put_contents($path, json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)) === false) {
                    throw new RuntimeException('Could not write the private selection report.');
                }
                if ($this->option('apply')) foreach ($rows as $row) {
                    foreach ($row['before'] as $id => $before) {
                        $archive = in_array($id, $row['archive_ids'], true);
                        if ($archive === ($before['archived_at'] !== null)) continue;
                        DB::table('lesson_block_variants')->where('id', $id)->update(['practice_archived_at' => $archive ? now() : null]);
                        $changed++;
                    }
                }

                return ['path' => $path, 'blocks' => count($rows), 'selected' => array_sum(array_map(fn ($r) => count($r['selected_ids']), $rows)),
                    'archived' => array_sum(array_map(fn ($r) => count($r['archive_ids']), $rows)), 'changed' => $changed,
                    'fallbacks' => count(array_filter($rows, fn ($r) => collect($r['vocabulary'])->contains(fn ($v) => $v['basis'] !== 'latvian_lemmas'))),
                    'report' => $report];
            });
            if ($this->option('apply')) {
                $report['report']['applied'] = true;
                File::put($report['path'], json_encode($report['report'], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
            }
            $this->info('blocks='.$report['blocks'].' retained='.$report['selected'].' archived='.$report['archived']
                .' changed='.$report['changed'].' instruction_fallback_blocks='.$report['fallbacks'].' apply='.($this->option('apply') ? 'yes' : 'no'));
            $this->line('Report: '.$report['path']);
            return self::SUCCESS;
        } catch (\Throwable $error) {
            $this->error('Selection failed: '.$error::class.'. No content, audio or learner progress was removed.');
            return self::FAILURE;
        }
    }
}
