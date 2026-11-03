<?php

namespace App\Console\Commands;

use App\Models\LessonBlockVariant;
use App\Services\CoursePracticeVariants;
use App\Support\LessonBinaryTask;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;

/** Shares the existing local/production connection guard, never its trimming logic. */
class ReviseCoursePracticeTasks extends TrimCourseListeningQuestions
{
    protected $signature = 'course:revise-practice-tasks {manifest} {--apply} {--production}';

    protected $description = 'Apply fingerprint-checked course question sets and visible roleplay goals; dry-run by default';

    public function handle(): int
    {
        try {
            $connection = DB::connection();
            if ($this->option('apply') || $this->option('production')) $this->guardApply($connection);
            $path = realpath(base_path((string) $this->argument('manifest')));
            $allowedPath = $path && collect([resource_path('course/practice-revisions'), base_path('.tmp')])->contains(function ($directory) use ($path) {
                $root = realpath($directory);
                return $root && str_starts_with(str_replace('\\', '/', $path), str_replace('\\', '/', $root).'/');
            });
            if (!$allowedPath || pathinfo($path, PATHINFO_EXTENSION) !== 'json') throw new RuntimeException('Expected a manifest in resources/course/practice-revisions/ or .tmp/.');
            $pack = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
            if (($pack['schema_version'] ?? null) !== 1 || empty($pack['entries']) || !array_is_list($pack['entries'])) {
                throw new RuntimeException('Invalid manifest schema.');
            }
            $changed = $connection->transaction(function () use ($pack) {
                $updates = [];
                $seen = [];
                foreach ($pack['entries'] as $entry) {
                    $id = $entry['variant_id'] ?? null;
                    if (!is_int($id) || isset($seen[$id])) throw new RuntimeException('Invalid or duplicate variant.');
                    $seen[$id] = true;
                    $variant = LessonBlockVariant::with('block.page', 'block.variants')->lockForUpdate()->find($id);
                    $block = $variant?->block;
                    if (!$block || $block->id !== ($entry['block_id'] ?? null) || $block->page?->slug !== ($entry['page_slug'] ?? null)
                        || !$block->page->is_published || $block->page->status !== 'published'
                        || !$block->page->course_group_id || $block->page->learn_lang !== 'lv'
                        || !in_array($block->page->level, ['A1','A2','B1','B2'], true)
                        || !app(CoursePracticeVariants::class)->available($block)->contains('id', $id)) {
                        throw new RuntimeException('Variant ownership, publication or active scope changed.');
                    }
                    $config = $variant->config;
                    $set = $entry['set'] ?? [];
                    $allowed = match ($config['task_kind'] ?? null) {
                        'listening', 'reading_binary' => ['questions', 'assisted_questions'],
                        'roleplay' => ['goals'],
                        default => [],
                    };
                    if (!$set || array_diff(array_keys($set), $allowed)) throw new RuntimeException('Only binary questions and roleplay goals may change.');
                    $after = array_replace($config, $set);
                    if (isset($set['questions'])) {
                        if (!in_array($block->type, ['listening','reading'], true) || count($after['questions']) !== 6) throw new RuntimeException('Expected six course questions.');
                        LessonBinaryTask::validate($after);
                        if (count(array_unique(array_column($after['questions'], 'statement'))) !== 6) throw new RuntimeException('Repeated questions.');
                    } else {
                        if ($block->type !== 'speaking' || !is_array($set['goals']) || !array_is_list($set['goals'])
                            || count($set['goals']) < 1 || count($set['goals']) > 6) throw new RuntimeException('Invalid roleplay goals.');
                        foreach ($set['goals'] as $goal) if (!is_string($goal) || !trim($goal)) throw new RuntimeException('Empty roleplay goal.');
                    }
                    $beforeHash = hash('sha256', PublishCourseListeningRevision::canonicalJson($config));
                    if (hash_equals($entry['after_sha256'] ?? '', $beforeHash)) continue;
                    if (!hash_equals($entry['before_sha256'] ?? '', $beforeHash)
                        || !hash_equals($entry['after_sha256'] ?? '', hash('sha256', PublishCourseListeningRevision::canonicalJson($after)))) {
                        throw new RuntimeException('Content changed since review; nothing applied.');
                    }
                    $updates[] = ['id' => $id, 'before' => $config, 'after' => $after];
                }
                if ($this->option('apply') && $updates) {
                    $directory = base_path('.tmp/practice-revision-backups');
                    if (!is_dir($directory) && !mkdir($directory, 0700, true)) throw new RuntimeException('Cannot create backup directory.');
                    $backup = $directory.'/'.Str::uuid().'.json';
                    $bytes = json_encode($updates, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
                    if (file_put_contents($backup, $bytes, LOCK_EX) !== strlen($bytes) || file_get_contents($backup) !== $bytes) throw new RuntimeException('Backup verification failed.');
                    foreach ($updates as $update) {
                        $encoded = PublishCourseListeningRevision::canonicalJson($update['after']);
                        if (DB::table('lesson_block_variants')->where('id', $update['id'])->update(['config' => $encoded, 'updated_at' => now()]) !== 1) throw new RuntimeException('Update failed.');
                        $saved = LessonBlockVariant::findOrFail($update['id']);
                        if (PublishCourseListeningRevision::canonicalJson($saved->config) !== $encoded) throw new RuntimeException('After-state verification failed.');
                    }
                }
                return count($updates);
            });
            $this->info('reviewed='.count($pack['entries']).' changed='.$changed.' dry_run='.($this->option('apply') ? 'no' : 'yes'));
            return self::SUCCESS;
        } catch (\Throwable $exception) {
            $this->error($exception::class === RuntimeException::class ? $exception->getMessage() : 'Practice revision failed; no transaction changes committed.');
            return self::FAILURE;
        }
    }
}
