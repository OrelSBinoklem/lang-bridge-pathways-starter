<?php

namespace App\Console\Commands;

use App\Models\LessonBlock;
use App\Models\LessonBlockVariant;
use App\Models\LessonPage;
use App\Services\CoursePracticeVariants;
use Illuminate\Database\Connection;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use stdClass;

/** Inherits only the installation/connection guard; revision handling is independent. */
class ReviseCourseProductiveTasks extends TrimCourseListeningQuestions
{
    private const FIELDS = ['instruction', 'topic', 'tutor_prompt'];

    private const KINDS = [
        'writing' => ['ru_to_lv', 'image_description', 'question_formation'],
        'speaking' => ['roleplay', 'question_formation'],
    ];

    protected const BACKUP_ROOT = '.tmp/productive-revision-backups';

    protected $signature = 'course:revise-productive-tasks {manifest} {--apply : Apply after validation and a checked private backup} {--production : Explicitly allow the verified production installation}';

    protected $description = 'Revise only approved text fields of the complete 950-variant course writing/speaking scope; dry-run by default';

    public function handle(): int
    {
        try {
            $connection = DB::connection();
            if ($this->option('apply') || $this->option('production')) {
                $this->guardApply($connection);
            }
            $pack = $this->readRevision();
            $backup = null;
            $plan = $connection->transaction(function () use ($connection, $pack, &$backup): array {
                if ($this->option('apply') || $this->option('production')) {
                    $this->guardApply($connection);
                }
                $entries = $this->validateRevision($pack);
                $plan = $this->inspectScope($connection, $entries);
                if ($this->option('apply') && $plan['changed']) {
                    $backup = $this->archive($plan['rows']);
                    foreach ($plan['changed'] as $id) {
                        if ($connection->table('lesson_block_variants')->where('id', $id)->update([
                            'config' => PublishCourseListeningRevision::canonicalJson($this->projectAfter($entries[$id])->config),
                            'updated_at' => now(),
                        ]) !== 1) {
                            throw new RuntimeException('Variant update failed.');
                        }
                    }
                    // Fresh locked reads include unchanged and archived variants and their ownership.
                    $verified = $this->inspectScope($connection, $entries, $plan['changed']);
                    if ($verified['changed'] || $verified['protected_sha256'] !== $plan['protected_sha256']) {
                        throw new RuntimeException('After-state verification failed.');
                    }
                }

                return $plan;
            });
            $this->info('scope=950 active=570 archived=380 changed='.count($plan['changed']).' kept='.$plan['kept']
                .' already_applied='.$plan['already_applied'].' dry_run='.($this->option('apply') ? 'no' : 'yes')
                .($backup ? ' backup='.$backup : ''));

            return self::SUCCESS;
        } catch (QueryException) {
            $this->error('Database operation failed. No transaction changes committed.');
        } catch (\JsonException) {
            $this->error('Invalid JSON. No transaction changes committed.');
        } catch (RuntimeException $exception) {
            $this->error($exception::class === RuntimeException::class ? $exception->getMessage()
                : 'Productive revision failed. No transaction changes committed.');
        } catch (\Throwable) {
            $this->error('Productive revision failed. No transaction changes committed.');
        }

        return self::FAILURE;
    }

    private function readRevision(): mixed
    {
        $argument = (string) $this->argument('manifest');
        $candidate = preg_match('~^(?:[A-Za-z]:[/\\\\]|/)~', $argument) ? $argument : base_path($argument);
        $workspace = realpath(base_path());
        $path = realpath($candidate);
        $allowed = false;
        foreach (['.tmp', 'resources/course/productive-revisions'] as $relative) {
            $root = $workspace ? $workspace.'/'.$relative : '';
            if ($path && $root && $this->samePath($candidate, $path)
                && $this->samePath((string) realpath($root), $root) && $this->within($path, $root)) {
                $allowed = true;
            }
        }
        if (! $allowed || ! is_file($path) || strtolower(pathinfo($path, PATHINFO_EXTENSION)) !== 'json') {
            throw new RuntimeException('Manifest must be a non-redirected JSON file in workspace .tmp/ or resources/course/productive-revisions/.');
        }
        $bytes = @file_get_contents($path);
        if ($bytes === false) {
            throw new RuntimeException('Cannot read revision manifest.');
        }

        return json_decode($bytes, false, 512, JSON_THROW_ON_ERROR);
    }

    private function validateRevision(mixed $pack): array
    {
        if (! $pack instanceof stdClass || ! $this->exactKeys($pack, ['schema_version', 'entries'])
            || $pack->schema_version !== 1 || ! is_array($pack->entries) || count($pack->entries) !== 950) {
            throw new RuntimeException('Expected schema_version 1 and exactly 950 entries.');
        }
        $entries = [];
        $active = 0;
        foreach ($pack->entries as $entry) {
            if (! $entry instanceof stdClass || ! $this->exactKeys($entry, [
                'level', 'skill', 'category_id', 'page_id', 'page_slug', 'block_id', 'variant_id', 'seed_key',
                'active', 'before_sha256', 'before', 'set', 'after_sha256',
            ])) {
                throw new RuntimeException('Unexpected or missing manifest entry fields.');
            }
            foreach (['category_id', 'page_id', 'block_id', 'variant_id'] as $field) {
                if (! is_int($entry->$field) || $entry->$field < 1 || $entry->$field > 9007199254740991) {
                    throw new RuntimeException('Selector IDs must be positive safe JSON integers.');
                }
            }
            if (! in_array($entry->level, ['A1', 'A2', 'B1', 'B2'], true)
                || ! in_array($entry->skill, ['writing', 'speaking'], true)
                || $entry->page_slug !== 'course-'.$entry->category_id.'-'.$entry->skill
                || ! is_string($entry->seed_key) || preg_match('/\S/u', $entry->seed_key) !== 1
                || ! is_bool($entry->active) || isset($entries[$entry->variant_id])
                || ! $entry->before instanceof stdClass || ! $this->exactKeys($entry->before, ['title', 'config'])
                || ! is_string($entry->before->title) || ! $entry->before->config instanceof stdClass
                || ! $entry->set instanceof stdClass || (! $entry->active && (array) $entry->set !== [])) {
                throw new RuntimeException('Invalid selector, duplicate ID, before state or archived edit.');
            }
            $this->validateTask($entry->before->config, $entry->skill);
            foreach ((array) $entry->set as $field => $value) {
                if (! in_array($field, self::FIELDS, true) || ! is_string($value) || preg_match('/\S/u', $value) !== 1
                    || $value === $entry->before->config->$field) {
                    throw new RuntimeException('Set allows only changed nonempty instruction, topic and tutor_prompt strings; unchanged entries require {}.');
                }
            }
            foreach (['before_sha256', 'after_sha256'] as $field) {
                if (! is_string($entry->$field) || ! preg_match('/^[a-f0-9]{64}$/D', $entry->$field)) {
                    throw new RuntimeException('Invalid SHA-256.');
                }
            }
            if (! hash_equals($entry->before_sha256, PublishCourseListeningRevision::fingerprint($entry->before))
                || ! hash_equals($entry->after_sha256, PublishCourseListeningRevision::fingerprint($this->projectAfter($entry)))) {
                throw new RuntimeException('Before or derived after fingerprint mismatch.');
            }
            $active += (int) $entry->active;
            $entries[$entry->variant_id] = $entry;
        }
        if ($active !== 570) {
            throw new RuntimeException('Expected exactly 570 active and 380 archived entries.');
        }
        ksort($entries, SORT_NUMERIC);

        return $entries;
    }

    private function validateTask(stdClass $config, string $skill): void
    {
        if (! in_array($config->task_kind ?? null, self::KINDS[$skill], true)) {
            throw new RuntimeException('Malformed productive task kind.');
        }
        foreach (self::FIELDS as $field) {
            if (! is_string($config->$field ?? null)) {
                throw new RuntimeException('Malformed productive text field.');
            }
        }
    }

    private function projectAfter(stdClass $entry): stdClass
    {
        $after = clone $entry->before;
        $after->config = clone $entry->before->config;
        foreach ((array) $entry->set as $field => $value) {
            $after->config->$field = $value;
        }

        return $after;
    }

    private function inspectScope(Connection $connection, array $entries, ?array $updatedIds = null): array
    {
        $groups = $connection->table('course_groups')->where('dictionary_id', 20)->where('learn_lang', 'lv')
            ->where('is_published', true)->whereIn('level', ['A1', 'A2', 'B1', 'B2'])
            ->orderBy('id')->lockForUpdate()->get()->keyBy('id');
        $pages = LessonPage::on($connection->getName())->whereIn('course_group_id', $groups->keys())
            ->whereIn('skill', ['writing', 'speaking'])->where('learn_lang', 'lv')->where('is_published', true)
            ->where('status', 'published')->whereIn('level', ['A1', 'A2', 'B1', 'B2'])
            ->orderBy('id')->lockForUpdate()->get()->keyBy('id');
        $blocks = LessonBlock::on($connection->getName())->whereIn('lesson_page_id', $pages->keys())
            ->whereNull('source_block_id')->orderBy('id')->lockForUpdate()->get();
        // Include unpublished rows in locks and availability computation, but never in the edit scope.
        $variants = LessonBlockVariant::on($connection->getName())->whereIn('lesson_block_id', $blocks->modelKeys())
            ->orderBy('id')->lockForUpdate()->get();
        $byBlock = $variants->groupBy('lesson_block_id');
        $scope = [];
        $availability = app(CoursePracticeVariants::class);
        foreach ($blocks as $block) {
            $page = $pages[$block->lesson_page_id];
            $group = $groups[$page->course_group_id];
            if ($block->type !== $page->skill || $page->level !== $group->level
                || $page->slug !== 'course-'.$group->category_id.'-'.$page->skill) {
                throw new RuntimeException('Productive page/block ownership, type, level or slug conflict.');
            }
            $block->setRelation('page', $page);
            $block->setRelation('variants', $byBlock->get($block->id, collect()));
            $activeIds = $availability->available($block)->pluck('id')->all();
            $kind = null;
            $seeds = [];
            foreach ($block->variants->where('is_published', true) as $variant) {
                $before = (object) ['title' => $variant->getRawOriginal('title'),
                    'config' => json_decode($variant->getRawOriginal('config'), false, 512, JSON_THROW_ON_ERROR)];
                if (! is_string($before->title) || ! $before->config instanceof stdClass) {
                    throw new RuntimeException('Malformed stored productive task.');
                }
                $this->validateTask($before->config, $page->skill);
                if (($kind !== null && $kind !== $before->config->task_kind)
                    || ! is_string($variant->seed_key) || preg_match('/\S/u', $variant->seed_key) !== 1
                    || isset($seeds[$variant->seed_key])) {
                    throw new RuntimeException('Mixed task kinds or invalid duplicate seed in productive block.');
                }
                $kind = $before->config->task_kind;
                $seeds[$variant->seed_key] = true;
                $scope[(int) $variant->id] = [
                    'level' => $page->level, 'skill' => $page->skill, 'category_id' => (int) $group->category_id,
                    'page_id' => (int) $page->id, 'page_slug' => $page->slug, 'block_id' => (int) $block->id,
                    'variant_id' => (int) $variant->id, 'seed_key' => $variant->seed_key,
                    'active' => in_array($variant->id, $activeIds, true), 'before' => $before,
                    'before_sha256' => PublishCourseListeningRevision::fingerprint($before),
                ];
            }
        }
        ksort($scope, SORT_NUMERIC);
        if (array_keys($scope) !== array_keys($entries)) {
            throw new RuntimeException('Manifest must match the exact complete published productive variant scope.');
        }
        $plan = ['changed' => [], 'kept' => 0, 'already_applied' => 0, 'rows' => []];
        foreach ($scope as $id => $row) {
            $entry = $entries[$id];
            foreach (['level', 'skill', 'category_id', 'page_id', 'page_slug', 'block_id', 'variant_id', 'seed_key', 'active'] as $field) {
                if ($row[$field] !== $entry->$field) {
                    throw new RuntimeException('Ownership or active selection conflict for variant '.$id.'.');
                }
            }
            $hash = $row['before_sha256'];
            if (! hash_equals($hash, $entry->before_sha256) && ! hash_equals($hash, $entry->after_sha256)) {
                throw new RuntimeException('Full title/config conflict for variant '.$id.'.');
            }
            if ($entry->before_sha256 === $entry->after_sha256) {
                $plan['kept']++;
            } elseif ($hash === $entry->after_sha256) {
                $plan['already_applied']++;
            } else {
                $plan['changed'][] = $id;
            }
            $plan['rows'][] = $row + ['after_sha256' => $entry->after_sha256];
        }
        $raw = static fn ($models) => $models->map(fn ($model) => $model->getRawOriginal())->values()->all();
        $updatedIds ??= $plan['changed'];
        $protectedVariants = $variants->map(function ($variant) use ($updatedIds) {
            $attributes = $variant->getRawOriginal();
            if ($variant->is_published) {
                unset($attributes['config']);
            }
            if (in_array((int) $variant->id, $updatedIds, true)) {
                unset($attributes['updated_at']);
            }

            return $attributes;
        })->all();
        $plan['protected_sha256'] = PublishCourseListeningRevision::fingerprint([
            $groups->values()->all(), $raw($pages), $raw($blocks), $protectedVariants,
        ]);

        return $plan;
    }

    private function exactKeys(stdClass $object, array $expected): bool
    {
        $actual = array_keys((array) $object);
        sort($actual);
        sort($expected);

        return $actual === $expected;
    }

    private function normalizePath(string $path): string
    {
        $path = rtrim(str_replace('\\', '/', $path), '/');

        return PHP_OS_FAMILY === 'Windows' ? strtolower($path) : $path;
    }

    private function samePath(string $a, string $b): bool
    {
        return $this->normalizePath($a) === $this->normalizePath($b);
    }

    private function within(string $path, string $root): bool
    {
        return str_starts_with($this->normalizePath($path), $this->normalizePath($root).'/');
    }

    protected function archive(array $rows): string
    {
        $mask = umask(0077);
        try {
            $workspace = realpath(base_path());
            if ($workspace === false) {
                throw new RuntimeException('Cannot resolve private backup workspace.');
            }
            $directory = $workspace;
            $uuid = (string) Str::uuid();
            foreach (['.tmp', 'productive-revision-backups', $uuid] as $part) {
                $directory .= DIRECTORY_SEPARATOR.$part;
                clearstatcache(true);
                if (is_link($directory) || ($part === $uuid && file_exists($directory))
                    || (! is_dir($directory) && ! @mkdir($directory, 0700))
                    || ! $this->samePath((string) realpath($directory), $directory)) {
                    throw new RuntimeException('Cannot create non-redirected private backup directory.');
                }
            }
            if (! @chmod($directory, 0700)) {
                throw new RuntimeException('Cannot restrict backup directory permissions.');
            }
            $file = $directory.DIRECTORY_SEPARATOR.'before.json';
            $bytes = PublishCourseListeningRevision::canonicalJson((object) ['schema_version' => 1, 'entries' => $rows]);
            $handle = @fopen($file, 'x+b');
            if ($handle === false) {
                throw new RuntimeException('Cannot exclusively create private backup.');
            }
            try {
                if (! @chmod($file, 0600)) {
                    throw new RuntimeException('Cannot restrict backup permissions.');
                }
                $offset = 0;
                while ($offset < strlen($bytes)) {
                    $written = @fwrite($handle, substr($bytes, $offset));
                    if ($written === false || $written === 0) {
                        throw new RuntimeException('Private backup write failed.');
                    }
                    $offset += $written;
                }
                clearstatcache(true);
                if (! @fflush($handle) || ! @fsync($handle) || ! @rewind($handle)
                    || is_link($file) || ! $this->samePath((string) realpath($file), $file)
                    || stream_get_contents($handle) !== $bytes || @file_get_contents($file) !== $bytes) {
                    throw new RuntimeException('Private backup verification failed.');
                }
            } finally {
                fclose($handle);
            }

            return self::BACKUP_ROOT.'/'.$uuid.'/before.json';
        } finally {
            umask($mask);
        }
    }
}
