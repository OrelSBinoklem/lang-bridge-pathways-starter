<?php

namespace Tests\Feature;

use App\Console\Commands\PublishCourseListeningRevision;
use App\Console\Commands\ReviseCourseProductiveTasks;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\Attributes\DataProviderExternal;
use RuntimeException;
use Symfony\Component\Console\Input\ArrayInput;
use Symfony\Component\Process\Process;
use Tests\TestCase;

class ReviseCourseProductiveTasksTest extends TestCase
{
    private string $originalBase;

    private string $temporary;

    private array $pack;

    private string $output = '';

    private array $links = [];

    protected function setUp(): void
    {
        parent::setUp();
        $this->originalBase = base_path();
        config(['app.env' => 'testing', 'database.connections.productive_revision_test' => [
            'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true,
        ]]);
        $this->app->instance('env', 'testing');
        DB::setDefaultConnection('productive_revision_test');
        $this->assertSame('sqlite', DB::connection()->getDriverName());
        $this->assertSame(':memory:', DB::connection()->getConfig('database'));
        Schema::create('users', fn ($table) => $table->id());
        Schema::create('course_groups', function ($table) {
            $table->id();
            $table->integer('dictionary_id');
            $table->integer('category_id');
            $table->string('level');
            $table->string('learn_lang');
            $table->boolean('is_published');
        });
        foreach ([
            '2026_09_11_000002_create_lesson_pages_table',
            '2026_09_11_000003_create_lesson_blocks_table',
            '2026_09_11_000005_create_lesson_block_completions_table',
            '2026_09_22_000001_add_course_skill_lesson_framework',
            '2026_09_29_000001_create_lesson_block_responses_table',
            '2026_10_01_000001_add_grammar_stage_references',
            '2026_10_13_000001_add_pending_assistance_to_lesson_block_progress',
            '2026_10_13_000002_add_practice_variant_archive',
        ] as $migration) {
            (require database_path("migrations/$migration.php"))->up();
        }
        $this->temporary = base_path('.tmp/productive-revision-test-'.Str::uuid());
        File::ensureDirectoryExists($this->temporary.'/.tmp');
        $this->app->setBasePath($this->temporary);
        $this->app->make(Kernel::class)->registerCommand(new ReviseCourseProductiveTasks);
        $this->pack = ['schema_version' => 1, 'entries' => []];
        $pageId = $blockId = $variantId = 0;
        $rows = [];
        foreach (range(1, 38) as $groupId) {
            $category = 1762 + $groupId;
            $level = $groupId <= 12 ? 'A1' : ($groupId <= 23 ? 'A2' : ($groupId <= 33 ? 'B1' : 'B2'));
            DB::table('course_groups')->insert(['id' => $groupId, 'dictionary_id' => 20, 'category_id' => $category,
                'level' => $level, 'learn_lang' => 'lv', 'is_published' => true]);
            foreach (['writing' => ['ru_to_lv', 'image_description', 'question_formation'],
                'speaking' => ['roleplay', 'question_formation']] as $skill => $kinds) {
                $pageId++;
                $slug = 'course-'.$category.'-'.$skill;
                DB::table('lesson_pages')->insert(['id' => $pageId, 'course_group_id' => $groupId,
                    'title' => 'Page '.$pageId, 'slug' => $slug, 'skill' => $skill, 'level' => $level,
                    'learn_lang' => 'lv', 'status' => 'published', 'is_published' => true]);
                foreach ($kinds as $kind) {
                    $blockId++;
                    DB::table('lesson_blocks')->insert(['id' => $blockId, 'lesson_page_id' => $pageId,
                        'type' => $skill, 'config' => '{"block":"untouched"}', 'bot_prompt' => 'Unchanged bot prompt']);
                    foreach (range(0, 4) as $position) {
                        $variantId++;
                        $config = ['task_kind' => $kind, 'topic' => 'Topic '.$variantId,
                            'instruction' => 'Original instruction', 'tutor_prompt' => 'Original tutor prompt',
                            'image_url' => '/images/unchanged.webp',
                            'authoring' => (object) ['ids' => [20, 1763], 'extra' => (object) [], 'zero' => 0.0]];
                        $before = ['title' => 'Variant '.$variantId, 'config' => $config];
                        $active = $position >= 1 && $position <= 3;
                        $rows[] = ['id' => $variantId, 'lesson_block_id' => $blockId, 'title' => $before['title'],
                            'seed_key' => 'variant:'.($position + 1), 'position' => $position,
                            'config' => $this->encodeJson($config), 'is_published' => true,
                            // The fifth is unavailable due to take(3), even without an archive timestamp.
                            'practice_archived_at' => $position === 0 ? '2026-01-01 00:00:00' : null,
                            'created_at' => '2020-01-01 00:00:00', 'updated_at' => '2020-01-01 00:00:00'];
                        $this->pack['entries'][] = ['level' => $level, 'skill' => $skill, 'category_id' => $category,
                            'page_id' => $pageId, 'page_slug' => $slug, 'block_id' => $blockId,
                            'variant_id' => $variantId, 'seed_key' => 'variant:'.($position + 1), 'active' => $active,
                            'before_sha256' => '', 'before' => $before, 'set' => (object) [], 'after_sha256' => ''];
                    }
                }
            }
        }
        foreach (array_chunk($rows, 50) as $chunk) {
            DB::table('lesson_block_variants')->insert($chunk);
        }
        $this->pack['entries'][1]['set'] = (object) ['instruction' => 'Revised instruction'];
        $this->pack['entries'][16]['set'] = (object) ['topic' => 'Revised topic', 'tutor_prompt' => 'Revised tutor prompt'];
        $this->rehash();
        DB::table('lesson_blocks')->insert(['id' => 999, 'lesson_page_id' => 1, 'type' => 'writing',
            'source_block_id' => 1, 'config' => '{"source":"untouched"}']);
        DB::table('lesson_block_variants')->insert([
            ['id' => 9991, 'lesson_block_id' => 999, 'title' => 'Source sentinel', 'seed_key' => 'source:1',
                'config' => '{"private":"linked content"}', 'is_published' => true, 'position' => 0],
            ['id' => 9992, 'lesson_block_id' => 1, 'title' => 'Draft sentinel', 'seed_key' => 'draft:1',
                'config' => '{"private":"draft content"}', 'is_published' => false, 'position' => -1],
        ]);
        DB::table('users')->insert(['id' => 5]);
        DB::table('lesson_block_attempts')->insert(['user_id' => 5, 'lesson_block_id' => 1,
            'lesson_block_variant_id' => 2, 'answer' => '"private answer"', 'feedback' => '{"private":"feedback"}',
            'score' => 81, 'rank' => 'silver', 'scored_at' => '2026-01-01 00:00:00']);
        DB::table('lesson_block_progress')->insert(['user_id' => 5, 'lesson_block_id' => 1,
            'best_score' => 91, 'best_rank' => 'gold', 'assisted_variant_ids' => '[2]']);
        DB::table('lesson_block_completions')->insert(['user_id' => 5, 'lesson_block_id' => 1,
            'completed_at' => '2026-01-01 00:00:00']);
        DB::table('lesson_block_responses')->insert(['user_id' => 5, 'lesson_block_id' => 1,
            'lesson_block_variant_id' => 2, 'answer_text' => 'private response', 'status' => 'accepted']);
        foreach (['exam_variants', 'exam_variant_archives', 'exam_attempts', 'user_dictionary_words',
            'dictionary_words', 'dictionary_word_translations', 'course_steps'] as $table) {
            Schema::create($table, function ($blueprint) {
                $blueprint->id();
                $blueprint->text('sentinel');
            });
            DB::table($table)->insert(['id' => 1, 'sentinel' => 'unchanged data']);
        }
    }

    protected function tearDown(): void
    {
        Str::createUuidsNormally();
        foreach ($this->links as $link) {
            if (is_link($link) || (is_dir($link) && realpath($link) !== $link)) {
                if (PHP_OS_FAMILY === 'Windows' && is_dir($link)) {
                    rmdir($link);
                } else {
                    unlink($link);
                }
            }
        }
        if (isset($this->originalBase)) {
            $this->app->setBasePath($this->originalBase);
        }
        if (isset($this->temporary)) {
            $root = str_replace('\\', '/', realpath($this->originalBase.'/.tmp'));
            $path = str_replace('\\', '/', realpath($this->temporary));
            if (str_starts_with($path, $root.'/productive-revision-test-')) {
                File::deleteDirectory($this->temporary);
            }
        }
        DB::purge('productive_revision_test');
        parent::tearDown();
    }

    private function encodeJson(mixed $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function after(array $entry): array
    {
        $after = $entry['before'];
        $after['config'] = array_replace($after['config'], (array) $entry['set']);

        return $after;
    }

    private function rehash(): void
    {
        foreach ($this->pack['entries'] as &$entry) {
            $entry['before_sha256'] = PublishCourseListeningRevision::fingerprint($entry['before']);
            $entry['after_sha256'] = PublishCourseListeningRevision::fingerprint($this->after($entry));
        }
    }

    private function runCommand(bool $apply = true, array $options = [], ?string $manifest = null): int
    {
        $file = $this->temporary.'/.tmp/manifest.json';
        File::put($file, $this->encodeJson($this->pack));
        $result = Artisan::call('course:revise-productive-tasks', [
            'manifest' => $manifest ?? $file, ...($apply ? ['--apply' => true] : []), ...$options,
        ]);
        $this->output = Artisan::output();

        return $result;
    }

    private function snapshot(): array
    {
        $snapshot = [];
        foreach (['course_groups', 'lesson_pages', 'lesson_blocks', 'lesson_block_variants', 'lesson_block_attempts',
            'lesson_block_progress', 'lesson_block_completions', 'lesson_block_responses', 'exam_variants',
            'exam_variant_archives', 'exam_attempts', 'user_dictionary_words', 'dictionary_words',
            'dictionary_word_translations', 'course_steps'] as $table) {
            $snapshot[$table] = DB::table($table)->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
        }

        return $snapshot;
    }

    private function backups(): array
    {
        return glob($this->temporary.'/.tmp/productive-revision-backups/*/before.json') ?: [];
    }

    private function assertRejected(): void
    {
        $before = $this->snapshot();
        $this->assertSame(1, $this->runCommand(), $this->output);
        $this->assertSame($before, $this->snapshot());
        $this->assertSame([], $this->backups());
    }

    public function test_dry_run_validates_full_scope_inside_transaction_without_writes_or_backup(): void
    {
        $before = $this->snapshot();
        $levels = [];
        DB::listen(function ($query) use (&$levels) {
            if (str_starts_with($query->sql, 'select')) {
                $levels[] = $query->connection->transactionLevel();
            }
        });
        $this->assertSame(0, $this->runCommand(false), $this->output);
        $this->assertNotEmpty($levels);
        $this->assertSame([1], array_values(array_unique($levels)));
        $this->assertStringContainsString('scope=950 active=570 archived=380 changed=2 kept=948 already_applied=0 dry_run=yes', $this->output);
        $this->assertSame($before, $this->snapshot());
        $this->assertSame([], $this->backups());
    }

    public function test_apply_changes_only_allowed_config_and_timestamp_and_is_idempotent(): void
    {
        $before = $this->snapshot();
        $this->assertSame(0, $this->runCommand(), $this->output);
        $expected = $before;
        foreach ([1, 16] as $index) {
            $expected['lesson_block_variants'][$index]['config'] = PublishCourseListeningRevision::canonicalJson($this->after($this->pack['entries'][$index])['config']);
            $expected['lesson_block_variants'][$index]['updated_at'] = DB::table('lesson_block_variants')->find($index + 1)->updated_at;
            $this->assertNotSame($before['lesson_block_variants'][$index]['updated_at'], $expected['lesson_block_variants'][$index]['updated_at']);
        }
        $this->assertSame($expected, $this->snapshot());
        $files = $this->backups();
        $this->assertCount(1, $files);
        $backup = json_decode(File::get($files[0]), false, 512, JSON_THROW_ON_ERROR);
        $this->assertCount(950, $backup->entries);
        foreach ($backup->entries as $index => $row) {
            $entry = $this->pack['entries'][$index];
            foreach (['level', 'skill', 'category_id', 'page_id', 'page_slug', 'block_id', 'variant_id', 'seed_key', 'active'] as $field) {
                $this->assertSame($entry[$field], $row->$field);
            }
            $this->assertSame($entry['before_sha256'], $row->before_sha256);
            $this->assertSame($entry['before_sha256'], PublishCourseListeningRevision::fingerprint($row->before));
            $this->assertSame($entry['after_sha256'], $row->after_sha256);
        }
        $this->assertSame(0, $this->runCommand(), $this->output);
        $this->assertStringContainsString('changed=0 kept=948 already_applied=2', $this->output);
        $this->assertSame($expected, $this->snapshot());
        $this->assertSame($files, $this->backups());
    }

    public function test_empty_sets_preserve_all_rows_and_need_no_backup(): void
    {
        foreach ($this->pack['entries'] as &$entry) {
            $entry['set'] = (object) [];
        }
        unset($entry);
        $this->rehash();
        $before = $this->snapshot();
        $this->assertSame(0, $this->runCommand(), $this->output);
        $this->assertStringContainsString('changed=0 kept=950', $this->output);
        $this->assertSame($before, $this->snapshot());
        $this->assertSame([], $this->backups());
    }

    public function test_partly_applied_manifest_backs_up_actual_current_state(): void
    {
        $entry = $this->pack['entries'][1];
        DB::table('lesson_block_variants')->where('id', 2)->update([
            'config' => PublishCourseListeningRevision::canonicalJson($this->after($entry)['config']),
        ]);
        $this->assertSame(0, $this->runCommand(), $this->output);
        $this->assertStringContainsString('changed=1 kept=948 already_applied=1', $this->output);
        $backup = json_decode(File::get($this->backups()[0]), false, 512, JSON_THROW_ON_ERROR);
        $this->assertSame($entry['after_sha256'], $backup->entries[1]->before_sha256);
        $this->assertSame($entry['after_sha256'], PublishCourseListeningRevision::fingerprint($backup->entries[1]->before));
    }

    public static function forbiddenSets(): array
    {
        $cases = [];
        foreach (['title', 'task_kind', 'image_url', 'authoring', 'bot_prompt', 'instruction.ru', 'config', 'position', 'practice_archived_at'] as $field) {
            $cases[$field] = [(object) [$field => 'forbidden']];
        }
        foreach (['', '  ', "\u{00a0}", null, 0, false, [], (object) []] as $index => $value) {
            $cases['value '.$index] = [(object) ['instruction' => $value]];
        }
        $cases['array'] = [[]];
        $cases['null'] = [null];
        $cases['unchanged'] = [(object) ['instruction' => 'Original instruction']];

        return $cases;
    }

    #[DataProvider('forbiddenSets')]
    public function test_forbidden_fields_values_and_nonobject_sets_are_rejected(mixed $set): void
    {
        $this->pack['entries'][1]['set'] = $set;
        $this->rehash();
        $this->assertRejected();
    }

    public static function badContracts(): array
    {
        return array_map(fn ($case) => [$case], ['schema', 'extra_root', 'extra_entry', 'missing_field',
            'missing_entry', 'added_entry', 'duplicate_id', 'unknown_id', 'source_id', 'unpublished_id',
            'string_id', 'float_id', 'negative_id', 'unsafe_id', 'wrong_level', 'wrong_skill', 'wrong_page',
            'wrong_block', 'wrong_category', 'wrong_slug', 'wrong_seed', 'blank_seed', 'active_type', 'active_change',
            'archive_edit', 'overflow_edit', 'before_extra', 'before_title_null', 'before_config_array',
            'before_hash', 'after_hash', 'config_only_hash', 'hash_type', 'client_after', 'client_config']);
    }

    #[DataProvider('badContracts')]
    public function test_malformed_contract_scope_or_hash_is_rejected_atomically(string $case): void
    {
        $entry = &$this->pack['entries'][1];
        switch ($case) {
            case 'schema': $this->pack['schema_version'] = '1';
                break;
            case 'extra_root': $this->pack['after'] = [];
                break;
            case 'extra_entry': $entry['release'] = 'extra';
                break;
            case 'missing_field': unset($entry['set']);
                break;
            case 'missing_entry': array_pop($this->pack['entries']);
                break;
            case 'added_entry': $this->pack['entries'][] = $entry;
                break;
            case 'duplicate_id': $entry['variant_id'] = 1;
                break;
            case 'unknown_id': $entry['variant_id'] = 9990;
                break;
            case 'source_id': $entry['variant_id'] = 9991;
                break;
            case 'unpublished_id': $entry['variant_id'] = 9992;
                break;
            case 'string_id': $entry['page_id'] = '1';
                break;
            case 'float_id': $entry['page_id'] = 1.5;
                break;
            case 'negative_id': $entry['block_id'] = -1;
                break;
            case 'unsafe_id': $entry['variant_id'] = 9007199254740992;
                break;
            case 'wrong_level': $entry['level'] = 'C1';
                break;
            case 'wrong_skill': $entry['skill'] = 'reading';
                break;
            case 'wrong_page': $entry['page_id'] = 2;
                break;
            case 'wrong_block': $entry['block_id'] = 2;
                break;
            case 'wrong_category': $entry['category_id'] = 1764;
                $entry['page_slug'] = 'course-1764-writing';
                break;
            case 'wrong_slug': $entry['page_slug'] = 'exam-a1-writing';
                break;
            case 'wrong_seed': $entry['seed_key'] = 'variant:5';
                break;
            case 'blank_seed': $entry['seed_key'] = ' ';
                break;
            case 'active_type': $entry['active'] = 1;
                break;
            case 'active_change': $entry['active'] = false;
                $entry['set'] = (object) [];
                $this->rehash();
                break;
            case 'archive_edit': $this->pack['entries'][0]['set'] = (object) ['topic' => 'Forbidden'];
                $this->rehash();
                break;
            case 'overflow_edit': $this->pack['entries'][4]['set'] = (object) ['topic' => 'Forbidden'];
                $this->rehash();
                break;
            case 'before_extra': $entry['before']['extra'] = 'forbidden';
                $this->rehash();
                break;
            case 'before_title_null': $entry['before']['title'] = null;
                $this->rehash();
                break;
            case 'before_config_array': $entry['before']['config'] = [];
                $this->rehash();
                break;
            case 'before_hash': $entry['before_sha256'] = str_repeat('0', 64);
                break;
            case 'after_hash': $entry['after_sha256'] = str_repeat('0', 64);
                break;
            case 'config_only_hash': $entry['before_sha256'] = PublishCourseListeningRevision::fingerprint($entry['before']['config']);
                break;
            case 'hash_type': $entry['before_sha256'] = [];
                break;
            case 'client_after': $entry['after'] = $entry['before'];
                break;
            case 'client_config': $entry['config'] = $entry['before']['config'];
                break;
        }
        unset($entry);
        $this->assertRejected();
    }

    public static function ownershipChanges(): array
    {
        return [
            ['course_groups', 1, 'dictionary_id', 21], ['course_groups', 1, 'learn_lang', 'en'],
            ['course_groups', 1, 'is_published', false], ['course_groups', 1, 'level', 'B2'],
            ['course_groups', 1, 'category_id', 999], ['lesson_pages', 1, 'course_group_id', 2],
            ['lesson_pages', 1, 'skill', 'reading'], ['lesson_pages', 1, 'status', 'draft'],
            ['lesson_pages', 1, 'is_published', false], ['lesson_pages', 1, 'learn_lang', 'en'],
            ['lesson_pages', 1, 'level', 'C1'], ['lesson_pages', 1, 'slug', 'wrong-page'],
            ['lesson_blocks', 1, 'type', 'speaking'], ['lesson_blocks', 1, 'source_block_id', 2],
            ['lesson_blocks', 1, 'lesson_page_id', 3], ['lesson_block_variants', 2, 'lesson_block_id', 999],
            ['lesson_block_variants', 2, 'is_published', false], ['lesson_block_variants', 1, 'is_published', false],
            ['lesson_block_variants', 2, 'practice_archived_at', '2026-01-01 00:00:00'],
            ['lesson_block_variants', 5, 'position', -2], ['lesson_block_variants', 2, 'seed_key', 'changed'],
        ];
    }

    #[DataProvider('ownershipChanges')]
    public function test_current_ownership_and_active_selection_conflicts_are_rejected(string $table, int $id, string $field, mixed $value): void
    {
        DB::table($table)->where('id', $id)->update([$field => $value]);
        $this->assertRejected();
    }

    public static function currentContentConflicts(): array
    {
        return [[1, 'title'], [2, 'title'], [5, 'title'], [950, 'config'], [949, 'config'], [2, 'config']];
    }

    #[DataProvider('currentContentConflicts')]
    public function test_current_full_content_conflicts_include_unchanged_and_archived_rows(int $id, string $field): void
    {
        $value = 'Private current title';
        if ($field === 'config') {
            $config = $this->pack['entries'][$id - 1]['before']['config'];
            $config['image_url'] = '/private/admin-edit.webp';
            $value = $this->encodeJson($config);
        }
        DB::table('lesson_block_variants')->where('id', $id)->update([$field => $value]);
        $this->assertRejected();
        $this->assertStringNotContainsString('Private current title', $this->output);
        $this->assertStringNotContainsString('/private/admin-edit.webp', $this->output);
    }

    public static function malformedKinds(): array
    {
        $cases = [];
        foreach ([1, 2, 5, 17] as $id) {
            foreach ([null, 42, ['roleplay'], 'listening', 'exam_writing', $id === 17 ? 'ru_to_lv' : 'roleplay'] as $kind) {
                $cases[] = [$id, $kind];
            }
        }

        return $cases;
    }

    #[DataProvider('malformedKinds')]
    public function test_invalid_kind_even_with_matching_database_and_hashes_is_rejected(int $id, mixed $kind): void
    {
        $this->pack['entries'][$id - 1]['before']['config']['task_kind'] = $kind;
        DB::table('lesson_block_variants')->where('id', $id)->update([
            'config' => $this->encodeJson($this->pack['entries'][$id - 1]['before']['config']),
        ]);
        $this->rehash();
        $this->assertRejected();
    }

    public static function malformedStoredConfigs(): array
    {
        return array_map(fn ($config) => [$config], ['null', '[]', '{}', '"string"', '{invalid', '{"task_kind":null}']);
    }

    #[DataProvider('malformedStoredConfigs')]
    public function test_malformed_archived_config_cannot_be_silently_omitted(string $config): void
    {
        DB::table('lesson_block_variants')->where('id', 950)->update(['config' => $config]);
        $this->assertRejected();
    }

    public function test_mixed_valid_kinds_in_one_block_are_rejected(): void
    {
        $this->pack['entries'][0]['before']['config']['task_kind'] = 'question_formation';
        DB::table('lesson_block_variants')->where('id', 1)->update([
            'config' => $this->encodeJson($this->pack['entries'][0]['before']['config']),
        ]);
        $this->rehash();
        $this->assertRejected();
    }

    public function test_new_published_variant_is_not_silently_ignored(): void
    {
        DB::table('lesson_block_variants')->insert(['id' => 951, 'lesson_block_id' => 1,
            'title' => 'New variant', 'seed_key' => 'variant:6', 'position' => 6, 'is_published' => true,
            'config' => $this->encodeJson($this->pack['entries'][0]['before']['config'])]);
        $this->assertRejected();
    }

    public static function backupFailures(): array
    {
        return [['root_file'], ['uuid_collision']];
    }

    #[DataProvider('backupFailures')]
    public function test_backup_failure_prevents_any_update(string $failure): void
    {
        $root = $this->temporary.'/.tmp/productive-revision-backups';
        if ($failure === 'root_file') {
            File::put($root, 'sentinel');
        } else {
            $uuid = Str::uuid();
            Str::createUuidsUsing(fn () => $uuid);
            File::ensureDirectoryExists($root.'/'.$uuid);
        }
        $this->assertRejected();
        if ($failure === 'root_file') {
            $this->assertSame('sentinel', File::get($root));
        }
    }

    public static function triggerEffects(): array
    {
        return [['config'], ['ownership'], ['protected_metadata'], ['archived_timestamp'], ['scope'], ['sql_error']];
    }

    #[DataProvider('triggerEffects')]
    public function test_rechecking_full_scope_rolls_back_every_update_on_trigger_effects(string $effect): void
    {
        $sql = match ($effect) {
            'config' => "UPDATE lesson_block_variants SET title = 'Private trigger title' WHERE id = 950;",
            'ownership' => "UPDATE lesson_pages SET slug = 'wrong-slug' WHERE id = 76;",
            'protected_metadata' => 'UPDATE lesson_block_variants SET position = 99 WHERE id = 950;',
            'archived_timestamp' => "UPDATE lesson_block_variants SET updated_at = '2026-01-01 00:00:00' WHERE id = 950;",
            'scope' => 'UPDATE lesson_block_variants SET is_published = 0 WHERE id = 950;',
            'sql_error' => "SELECT RAISE(ABORT, 'Private SQL details');",
        };
        DB::unprepared('CREATE TRIGGER productive_side_effect AFTER UPDATE OF config ON lesson_block_variants WHEN NEW.id = 2 BEGIN '.$sql.' END');
        $before = $this->snapshot();
        $this->assertSame(1, $this->runCommand(), $this->output);
        $this->assertSame($before, $this->snapshot());
        $this->assertCount(1, $this->backups());
        $this->assertStringNotContainsString('Private trigger title', $this->output);
        $this->assertStringNotContainsString('Private SQL details', $this->output);
        $this->assertStringNotContainsString('UPDATE ', $this->output);
    }

    public function test_backup_is_complete_and_readable_before_the_first_update(): void
    {
        $checks = 0;
        DB::connection()->beforeExecuting(function ($sql) use (&$checks) {
            if (str_starts_with($sql, 'update "lesson_block_variants"')) {
                $checks++;
                $files = $this->backups();
                $this->assertCount(1, $files);
                $backup = json_decode(File::get($files[0]), false, 512, JSON_THROW_ON_ERROR);
                $this->assertCount(950, $backup->entries);
                $this->assertSame($this->pack['entries'][1]['before_sha256'], $backup->entries[1]->before_sha256);
                $this->assertSame(1, DB::connection()->transactionLevel());
            }
        });
        $this->assertSame(0, $this->runCommand(), $this->output);
        $this->assertSame(2, $checks);
    }

    public function test_manifest_outside_allowed_roots_is_rejected(): void
    {
        $file = $this->temporary.'/outside.json';
        File::put($file, $this->encodeJson($this->pack));
        $before = $this->snapshot();
        $this->assertSame(1, $this->runCommand(manifest: $file), $this->output);
        $this->assertSame($before, $this->snapshot());
        $this->assertSame([], $this->backups());
    }

    public function test_revision_resource_directory_is_accepted(): void
    {
        $root = $this->temporary.'/resources/course/productive-revisions';
        File::ensureDirectoryExists($root);
        File::put($root.'/manifest.json', $this->encodeJson($this->pack));
        $this->assertSame(0, $this->runCommand(false, manifest: 'resources/course/productive-revisions/manifest.json'), $this->output);
    }

    public static function malformedTextFields(): array
    {
        return [['instruction', null], ['topic', []], ['tutor_prompt', (object) []]];
    }

    #[DataProvider('malformedTextFields')]
    public function test_nonstring_before_text_fields_are_rejected_even_with_matching_hashes(string $field, mixed $value): void
    {
        $this->pack['entries'][0]['before']['config'][$field] = $value;
        DB::table('lesson_block_variants')->where('id', 1)->update([
            'config' => $this->encodeJson($this->pack['entries'][0]['before']['config']),
        ]);
        $this->rehash();
        $this->assertRejected();
    }

    public function test_directory_junctions_cannot_redirect_manifest_or_backups_on_windows(): void
    {
        if (PHP_OS_FAMILY !== 'Windows') {
            $this->markTestSkipped('Windows junction test; other hosts exercise symlinks.');
        }
        $target = $this->temporary.'/outside-junction';
        File::ensureDirectoryExists($target);
        File::put($target.'/manifest.json', $this->encodeJson($this->pack));
        $before = $this->snapshot();
        foreach (['manifest-junction', 'productive-revision-backups'] as $name) {
            $link = $this->temporary.'/.tmp/'.$name;
            $process = new Process(['cmd.exe', '/d', '/c', 'mklink', '/J',
                str_replace('/', '\\', $link), str_replace('/', '\\', $target)]);
            $this->assertSame(0, $process->run(), 'Could not create isolated test junction.');
            $this->links[] = $link;
            $this->assertSame(1, $this->runCommand(manifest: $name === 'manifest-junction' ? $link.'/manifest.json' : null), $this->output);
            $this->assertSame($before, $this->snapshot());
        }
        $this->assertSame(['manifest.json'], array_values(array_diff(scandir($target), ['.', '..'])));
    }

    public static function redirectPaths(): array
    {
        return [['manifest_file'], ['manifest_directory'], ['backup_directory']];
    }

    #[DataProvider('redirectPaths')]
    public function test_symlink_redirects_cannot_escape_manifest_or_backup_roots(string $kind): void
    {
        $target = $this->temporary.'/outside';
        File::ensureDirectoryExists($target);
        File::put($target.'/manifest.json', $this->encodeJson($this->pack));
        $link = $this->temporary.'/.tmp/'.match ($kind) {
            'manifest_file' => 'link.json', 'manifest_directory' => 'linked', default => 'productive-revision-backups',
        };
        if (! @symlink($kind === 'manifest_file' ? $target.'/manifest.json' : $target, $link)) {
            $this->markTestSkipped('This host does not permit symlink creation.');
        }
        $this->links[] = $link;
        $manifest = match ($kind) {
            'manifest_file' => $link, 'manifest_directory' => $link.'/manifest.json', default => null,
        };
        $before = $this->snapshot();
        $this->assertSame(1, $this->runCommand(manifest: $manifest), $this->output);
        $this->assertSame($before, $this->snapshot());
        $this->assertSame(['manifest.json'], array_values(array_diff(scandir($target), ['.', '..'])));
    }

    public function test_production_flags_cannot_bypass_the_real_installation_path(): void
    {
        $before = $this->snapshot();
        foreach ([false, true] as $apply) {
            $this->assertSame(1, $this->runCommand($apply, ['--production' => true]), $this->output);
            $this->assertStringContainsString('Production flag requires', $this->output);
        }
        $this->app->instance('env', 'production');
        config(['app.env' => 'production', 'app.url' => 'https://langbridge-pathways.com']);
        $this->assertSame(1, $this->runCommand(), $this->output);
        $this->assertSame(1, $this->runCommand(options: ['--production' => true]), $this->output);
        $this->assertStringContainsString('Production flag requires', $this->output);
        $this->assertSame($before, $this->snapshot());
        $this->assertSame([], $this->backups());
    }

    #[DataProviderExternal(TrimCourseListeningQuestionsTest::class, 'guardCases')]
    public function test_inherited_production_and_loopback_guards_without_connecting(string $environment, bool $production, string $host, array $overrides, bool $allowed): void
    {
        $this->app->instance('env', $environment);
        config(['app.env' => $environment, 'app.url' => 'https://langbridge-pathways.com']);
        $settings = ['name' => 'productive_guard', 'driver' => 'mysql', 'host' => $host, 'database' => 'db'];
        config(['database.connections.productive_guard' => array_replace($settings, $overrides)]);
        $connection = new Connection(function () {
            throw new RuntimeException('Must never connect');
        }, 'db', '', $settings);
        $command = new class extends ReviseCourseProductiveTasks
        {
            protected function isProductionPath(): bool
            {
                return true;
            }

            protected function resolveHost(string $host): array
            {
                return match ($host) {
                    'MariaDB-10.4' => ['127.0.0.1', '127.0.0.2'],
                    'mixed.example' => ['127.0.0.1', '192.0.2.10'],
                    'remote.example' => ['192.0.2.10'],
                    default => [],
                };
            }

            public function check(Connection $connection, bool $production): void
            {
                $this->input = new ArrayInput(['manifest' => 'unused.json', ...($production ? ['--production' => true] : [])], $this->getDefinition());
                $this->guardApply($connection);
            }
        };
        $failed = false;
        try {
            $command->check($connection, $production);
        } catch (RuntimeException $exception) {
            $failed = true;
            $this->assertNotSame('Must never connect', $exception->getMessage());
        }
        $this->assertSame(! $allowed, $failed);
    }
}
