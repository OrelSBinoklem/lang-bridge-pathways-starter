<?php

namespace Tests\Feature;

use App\Console\Commands\PublishCourseListeningRevision;
use App\Console\Commands\TrimCourseListeningQuestions;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Symfony\Component\Console\Input\ArrayInput;
use Tests\TestCase;

class TrimCourseListeningQuestionsTest extends TestCase
{
    protected const SKILL = 'listening';

    protected const COMMAND_CLASS = TrimCourseListeningQuestions::class;

    protected const EVIDENCE_PREFIX = "Sarun\u{0101}: ";

    private string $originalBase;

    protected string $temporary;

    protected array $pack;

    protected string $commandOutput = '';

    protected function setUp(): void
    {
        parent::setUp();
        $this->originalBase = base_path();
        // Always select a fresh, explicit memory connection before any schema or data operation.
        config(['app.env' => 'testing', 'database.connections.listening_trim_test' => [
            'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true,
        ]]);
        $this->app->instance('env', 'testing');
        DB::setDefaultConnection('listening_trim_test');
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
        $this->temporary = base_path('.tmp/listening-trim-test-'.Str::uuid());
        File::ensureDirectoryExists($this->temporary.'/.tmp');
        $this->app->setBasePath($this->temporary);
        $this->register(new (static::COMMAND_CLASS));
        $this->pack = ['schema_version' => 1, 'entries' => []];
        foreach ([1 => 'A1', 2 => 'A2', 3 => 'B1', 4 => 'B2'] as $id => $level) {
            $category = 1762 + $id;
            DB::table('course_groups')->insert(['id' => $id, 'dictionary_id' => 20, 'category_id' => $category,
                'level' => $level, 'learn_lang' => 'lv', 'is_published' => true]);
            DB::table('lesson_pages')->insert(['id' => $id, 'course_group_id' => $id, 'title' => 'Listening page',
                'slug' => 'course-'.$category.'-'.static::SKILL, 'skill' => static::SKILL, 'level' => $level,
                'learn_lang' => 'lv', 'status' => 'published', 'is_published' => true]);
            DB::table('lesson_blocks')->insert(['id' => $id, 'lesson_page_id' => $id, 'type' => static::SKILL,
                'config' => '{"block":"untouched"}', 'bot_prompt' => 'untouched']);
            foreach (range(0, 4) as $position) {
                $variant = $id * 10 + $position;
                $before = ['title' => $position === 2 ? null : 'Listening '.$variant, 'config' => $this->fixtureConfig()];
                DB::table('lesson_block_variants')->insert(['id' => $variant, 'lesson_block_id' => $id,
                    'title' => $before['title'], 'seed_key' => 'variant:'.($position + 1), 'position' => $position,
                    'config' => $this->encodeJson($before['config']), 'is_published' => true,
                    'practice_archived_at' => $position === 0 ? '2026-01-01 00:00:00' : null,
                    'created_at' => '2020-01-01 00:00:00', 'updated_at' => '2020-01-01 00:00:00']);
                if ($position >= 1 && $position <= 3) {
                    $this->pack['entries'][] = ['level' => $level, 'category_id' => $category, 'page_id' => $id,
                        'page_slug' => 'course-'.$category.'-'.static::SKILL, 'block_id' => $id, 'variant_id' => $variant,
                        'seed_key' => 'variant:'.($position + 1), 'before' => $before,
                        'keep' => range(1, 4 + $position), 'before_sha256' => '', 'after_sha256' => ''];
                }
            }
        }
        $this->rehash();
        DB::table('users')->insert(['id' => 5]);
        DB::table('lesson_block_attempts')->insert(['user_id' => 5, 'lesson_block_id' => 1,
            'lesson_block_variant_id' => 11, 'answer' => '[true,false]', 'feedback' => '{"private":"historical feedback"}',
            'score' => 81, 'rank' => 'silver', 'scored_at' => '2026-01-01 00:00:00']);
        DB::table('lesson_block_progress')->insert(['user_id' => 5, 'lesson_block_id' => 1,
            'best_score' => 91, 'best_rank' => 'gold', 'assisted_variant_ids' => '[11]']);
        DB::table('lesson_block_completions')->insert(['user_id' => 5, 'lesson_block_id' => 1, 'completed_at' => '2026-01-01 00:00:00']);
        DB::table('lesson_block_responses')->insert(['user_id' => 5, 'lesson_block_id' => 1,
            'lesson_block_variant_id' => 11, 'answer_text' => 'private response', 'status' => 'accepted']);
        foreach (['exam_variants', 'exam_variant_archives', 'exam_attempts', 'user_dictionary_words'] as $table) {
            Schema::create($table, function ($blueprint) {
                $blueprint->id();
                $blueprint->text('sentinel');
            });
            DB::table($table)->insert(['id' => 11, 'sentinel' => 'untouched private history']);
        }
    }

    protected function tearDown(): void
    {
        Str::createUuidsNormally();
        if (isset($this->originalBase)) {
            $this->app->setBasePath($this->originalBase);
        }
        if (isset($this->temporary)) {
            $root = str_replace('\\', '/', realpath($this->originalBase.'/.tmp'));
            $path = str_replace('\\', '/', realpath($this->temporary));
            if (str_starts_with($path, $root.'/listening-trim-test-')) {
                File::deleteDirectory($this->temporary);
            }
        }
        DB::purge('listening_trim_test');
        parent::tearDown();
    }

    protected function register(TrimCourseListeningQuestions $command): void
    {
        $this->app->make(Kernel::class)->registerCommand($command);
    }

    protected function fixtureConfig(): array
    {
        return ['task_kind' => 'listening', 'audio_url' => '/audio/unchanged.mp3',
            'audio_generation' => ['model' => 'existing', 'metadata' => (object) []],
            'transcript' => 'Anna brauc uz skolu. Autobuss pienak septinos.',
            'dialogue_segments' => [['speaker' => 'A', 'text' => 'Mani sauc Anna.'], ['speaker' => 'B', 'text' => 'Es esmu Janis.']],
            'speaker_profiles' => [(object) ['speaker' => 'A', 'voice' => 'unchanged']],
            'authoring' => ['dictionary_ids' => [20, 123], 'lexical_ids' => [180, 190]],
            'questions' => array_map(fn ($i) => ['statement' => 'Statement '.$i, 'correct' => $i % 2 === 1,
                'explanation' => 'Explanation '.$i, 'retained_metadata' => ['index' => $i]], range(1, 10)),
            'assisted_questions' => array_map(fn ($i) => 'Assisted '.$i, range(1, 10))];
    }

    protected function encodeJson(mixed $value): string
    {
        return json_encode($value, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    protected function expectedAfter(array $entry): array
    {
        $after = $entry['before'];
        $after['config']['questions'] = array_map(fn ($i) => $entry['before']['config']['questions'][$i - 1], $entry['keep']);
        if (array_key_exists('assisted_questions', $after['config'])) {
            $after['config']['assisted_questions'] = array_map(fn ($i) => $entry['before']['config']['assisted_questions'][$i - 1], $entry['keep']);
        }
        foreach ($entry['explanation_evidence'] ?? [] as $evidence) {
            $position = array_search($evidence['index'], $entry['keep'], true);
            $after['config']['questions'][$position]['explanation'] = static::EVIDENCE_PREFIX.implode(' / ', $evidence['quotes']);
        }

        return $after;
    }

    protected function rehash(): void
    {
        foreach ($this->pack['entries'] as &$entry) {
            $entry['before_sha256'] = PublishCourseListeningRevision::fingerprint($entry['before']);
            $entry['after_sha256'] = PublishCourseListeningRevision::fingerprint($this->expectedAfter($entry));
        }
    }

    protected function commandName(): string
    {
        return 'course:trim-'.static::SKILL.'-questions';
    }

    protected function runCommand(bool $apply = true, array $options = []): int
    {
        $file = $this->temporary.'/.tmp/manifest.json';
        File::put($file, $this->encodeJson($this->pack));

        $result = Artisan::call($this->commandName(), ['manifest' => $file, ...($apply ? ['--apply' => true] : []), ...$options]);
        $this->commandOutput = Artisan::output();

        return $result;
    }

    protected function snapshot(): array
    {
        $tables = ['course_groups', 'lesson_pages', 'lesson_blocks', 'lesson_block_variants', 'lesson_block_attempts',
            'lesson_block_progress', 'lesson_block_completions', 'lesson_block_responses',
            'exam_variants', 'exam_variant_archives', 'exam_attempts', 'user_dictionary_words'];
        $snapshot = [];
        foreach ($tables as $table) {
            $snapshot[$table] = DB::table($table)->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
        }

        return $snapshot;
    }

    protected function backups(): array
    {
        return glob($this->temporary.'/.tmp/'.static::SKILL.'-question-backups/*/before.json') ?: [];
    }

    public function test_default_is_read_only_and_does_not_create_backup(): void
    {
        $before = $this->snapshot();
        $this->assertSame(0, $this->runCommand(false), $this->commandOutput);
        $this->assertStringContainsString('changed=12', $this->commandOutput);
        $this->assertStringContainsString('dry_run=yes', $this->commandOutput);
        $this->assertSame($before, $this->snapshot());
        $this->assertSame([], $this->backups());
    }

    public static function retainedCounts(): array
    {
        return array_map(fn ($count) => [$count], range(5, 10));
    }

    #[DataProvider('retainedCounts')]
    public function test_counts_full_hash_backup_and_idempotence_preserve_every_other_field(int $count): void
    {
        foreach ($this->pack['entries'] as &$entry) {
            $entry['keep'] = range(1, $count);
        }
        unset($entry);
        $this->rehash();
        $before = $this->snapshot();
        $this->assertSame(0, $this->runCommand(), $this->commandOutput);
        $after = $this->snapshot();
        foreach ($before as $table => $rows) {
            if ($table !== 'lesson_block_variants') {
                $this->assertSame($rows, $after[$table], $table);
            }
        }
        $entries = array_column($this->pack['entries'], null, 'variant_id');
        foreach ($after['lesson_block_variants'] as $offset => $row) {
            $old = $before['lesson_block_variants'][$offset];
            if (! isset($entries[$row['id']]) || $count === 10) {
                $this->assertSame($old, $row);
                continue;
            }
            $expected = $this->expectedAfter($entries[$row['id']]);
            $this->assertSame(PublishCourseListeningRevision::canonicalJson($expected['config']), $row['config']);
            $this->assertNotSame($old['updated_at'], $row['updated_at']);
            unset($old['config'], $old['updated_at'], $row['config'], $row['updated_at']);
            $this->assertSame($old, $row);
        }
        $backups = $this->backups();
        $this->assertCount($count === 10 ? 0 : 1, $backups);
        if ($count < 10) {
            $backup = json_decode(File::get($backups[0]), false, 512, JSON_THROW_ON_ERROR);
            $this->assertCount(12, $backup->entries);
            foreach ($backup->entries as $item) {
                $entry = $entries[$item->variant_id];
                $this->assertSame($entry['before_sha256'], PublishCourseListeningRevision::fingerprint($item->before));
                $this->assertSame($entry['after_sha256'], $item->after_sha256);
            }
        } else {
            $this->assertStringContainsString('changed=0 kept=12', $this->commandOutput);
        }
        $this->assertSame(0, $this->runCommand(), $this->commandOutput);
        $this->assertSame($after, $this->snapshot());
        $this->assertSame($backups, $this->backups());
        $this->assertStringContainsString($count === 10 ? 'kept=12' : 'already_applied=12', $this->commandOutput);
    }

    public function test_noncontiguous_keep_and_evidence_use_original_indices_and_parallel_assistance(): void
    {
        $this->pack['entries'][0]['keep'] = [2, 3, 5, 7, 10];
        $this->pack['entries'][0]['explanation_evidence'] = [
            ['index' => 7, 'quotes' => ['Mani sauc Anna.', 'Anna brauc uz skolu.']],
            ['index' => 2, 'quotes' => ['Es esmu Janis.']],
        ];
        // An explanation-only change with all ten questions must still be counted and backed up.
        $this->pack['entries'][1]['keep'] = range(1, 10);
        $this->pack['entries'][1]['explanation_evidence'] = [['index' => 10, 'quotes' => ['Autobuss pienak septinos.']]];
        $this->rehash();
        $this->assertSame(0, $this->runCommand(), $this->commandOutput);
        $this->assertStringContainsString('changed=12', $this->commandOutput);
        foreach ([0, 1] as $index) {
            $entry = $this->pack['entries'][$index];
            $row = DB::table('lesson_block_variants')->find($entry['variant_id']);
            $this->assertSame(PublishCourseListeningRevision::canonicalJson($this->expectedAfter($entry)['config']), $row->config);
        }
        $this->assertSame('Explanation 7', $this->pack['entries'][0]['before']['config']['questions'][6]['explanation']);
        $this->assertSame(0, $this->runCommand(), $this->commandOutput);
        $this->assertStringContainsString('already_applied=12', $this->commandOutput);
    }

    public function test_absent_assisted_questions_stay_absent(): void
    {
        unset($this->pack['entries'][0]['before']['config']['assisted_questions']);
        DB::table('lesson_block_variants')->where('id', 11)->update(['config' => $this->encodeJson($this->pack['entries'][0]['before']['config'])]);
        $this->rehash();
        $this->assertSame(0, $this->runCommand(), $this->commandOutput);
        $this->assertArrayNotHasKey('assisted_questions', json_decode(DB::table('lesson_block_variants')->find(11)->config, true));
    }

    public static function invalidManifests(): array
    {
        return array_map(fn ($case) => [$case], ['under5', 'over10', 'out_of_range', 'zero', 'negative', 'order', 'duplicate_index',
            'string_index', 'float_index', 'before_hash', 'after_hash', 'config_only_hash', 'missing_entry', 'duplicate_entry',
            'unknown_id', 'archived_id', 'overflow_id', 'wrong_page', 'wrong_block', 'wrong_category', 'wrong_level',
            'wrong_slug', 'wrong_seed', 'client_after', 'client_config', 'schema', 'empty', 'non_boolean', 'one_answer',
            'assisted_length', 'assisted_null', 'exam_kind', 'evidence_absent_quote', 'evidence_removed_index',
            'evidence_duplicate_index', 'evidence_empty_quotes', 'evidence_four_quotes', 'evidence_empty_quote',
            'evidence_long_quote', 'evidence_string_index', 'evidence_extra_field', 'evidence_non_array']);
    }

    #[DataProvider('invalidManifests')]
    public function test_invalid_manifest_is_atomic_and_creates_no_backup(string $case): void
    {
        $entry = &$this->pack['entries'][0];
        switch ($case) {
            case 'under5': $entry['keep'] = [1, 2, 3, 4]; break;
            case 'over10': $entry['keep'] = range(1, 11); break;
            case 'out_of_range': $entry['keep'] = [1, 2, 3, 4, 11]; break;
            case 'zero': $entry['keep'] = [0, 1, 2, 3, 4]; break;
            case 'negative': $entry['keep'] = [-1, 1, 2, 3, 4]; break;
            case 'order': $entry['keep'] = [1, 3, 2, 4, 5]; break;
            case 'duplicate_index': $entry['keep'] = [1, 2, 3, 4, 4]; break;
            case 'string_index': $entry['keep'][0] = '1'; break;
            case 'float_index': $entry['keep'][0] = 1.5; break;
            case 'before_hash': $entry['before_sha256'] = str_repeat('0', 64); break;
            case 'after_hash': $entry['after_sha256'] = str_repeat('0', 64); break;
            case 'config_only_hash': $entry['before_sha256'] = PublishCourseListeningRevision::fingerprint($entry['before']['config']); break;
            case 'missing_entry': array_pop($this->pack['entries']); break;
            case 'duplicate_entry': $this->pack['entries'][] = $entry; break;
            case 'unknown_id': $entry['variant_id'] = 999; break;
            case 'archived_id': $entry['variant_id'] = 10; break;
            case 'overflow_id': $entry['variant_id'] = 14; break;
            case 'wrong_page': $entry['page_id'] = 2; break;
            case 'wrong_block': $entry['block_id'] = 2; break;
            case 'wrong_category': $entry['category_id'] = 1770; $entry['page_slug'] = 'course-1770-'.static::SKILL; break;
            case 'wrong_level': $entry['level'] = 'B2'; break;
            case 'wrong_slug': $entry['page_slug'] = 'exam-a1-listening'; break;
            case 'wrong_seed': $entry['seed_key'] = 'variant:5'; break;
            case 'client_after': $entry['after'] = $entry['before']; break;
            case 'client_config': $entry['config'] = $entry['before']['config']; break;
            case 'schema': $this->pack['schema_version'] = 2; break;
            case 'empty': $this->pack['entries'] = []; break;
            case 'non_boolean': $entry['before']['config']['questions'][0]['correct'] = 1; $this->rehash(); break;
            case 'one_answer': $entry['keep'] = [1, 3, 5, 7, 9]; $this->rehash(); break;
            case 'assisted_length': array_pop($entry['before']['config']['assisted_questions']); $this->rehash(); break;
            case 'assisted_null': $entry['before']['config']['assisted_questions'] = null; $entry['before_sha256'] = PublishCourseListeningRevision::fingerprint($entry['before']); break;
            case 'exam_kind': $entry['before']['config']['task_kind'] = 'exam_listening'; $this->rehash(); break;
            default:
                $evidence = ['index' => 1, 'quotes' => ['Mani sauc Anna.']];
                switch ($case) {
                    case 'evidence_absent_quote': $evidence['quotes'] = ['Not in the recording']; break;
                    case 'evidence_removed_index': $evidence['index'] = 10; break;
                    case 'evidence_empty_quotes': $evidence['quotes'] = []; break;
                    case 'evidence_four_quotes': $evidence['quotes'] = array_fill(0, 4, 'Anna'); break;
                    case 'evidence_empty_quote': $evidence['quotes'] = [' ']; break;
                    case 'evidence_long_quote': $evidence['quotes'] = [str_repeat('a', 1001)]; break;
                    case 'evidence_string_index': $evidence['index'] = '1'; break;
                    case 'evidence_extra_field': $evidence['statement'] = 'Forbidden'; break;
                }
                $entry['explanation_evidence'] = $case === 'evidence_non_array' ? (object) [] : [$evidence];
                if ($case === 'evidence_duplicate_index') {
                    $entry['explanation_evidence'][] = $evidence;
                }
                // Hash a valid projection where possible, so evidence validation cannot be bypassed by a matching hash.
                if (! in_array($case, ['evidence_removed_index', 'evidence_string_index', 'evidence_non_array'], true)) {
                    $this->rehash();
                }
        }
        unset($entry);
        $before = $this->snapshot();
        $this->assertSame(1, $this->runCommand(), $this->commandOutput);
        $this->assertSame($before, $this->snapshot());
        $this->assertSame([], $this->backups());
    }

    public static function scopeChanges(): array
    {
        return [
            ['course_groups', 'dictionary_id', 21], ['course_groups', 'learn_lang', 'en'],
            ['course_groups', 'is_published', false], ['course_groups', 'level', 'B2'],
            ['lesson_pages', 'course_group_id', null], ['lesson_pages', 'skill', static::SKILL === 'listening' ? 'reading' : 'listening'],
            ['lesson_pages', 'status', 'archived'], ['lesson_pages', 'is_published', false],
            ['lesson_pages', 'learn_lang', 'en'], ['lesson_pages', 'level', 'C1'],
            ['lesson_pages', 'slug', 'exam-a1'], ['lesson_blocks', 'type', static::SKILL === 'listening' ? 'reading' : 'listening'],
            ['lesson_blocks', 'source_block_id', 2], ['lesson_block_variants', 'practice_archived_at', '2026-01-01 00:00:00'],
            ['lesson_block_variants', 'is_published', false], ['lesson_block_variants', 'seed_key', 'changed'],
        ];
    }

    #[DataProvider('scopeChanges')]
    public function test_changed_ownership_and_publication_are_rejected(string $table, string $field, mixed $value): void
    {
        DB::table($table)->where('id', $table === 'lesson_block_variants' ? 11 : 1)->update([$field => $value]);
        $before = $this->snapshot();
        $this->assertSame(1, $this->runCommand(), $this->commandOutput);
        $this->assertSame($before, $this->snapshot());
        $this->assertSame([], $this->backups());
    }

    public static function concurrentChanges(): array
    {
        return [['config'], ['title'], ['active_scope']];
    }

    protected function concurrentCommand(string $kind): TrimCourseListeningQuestions
    {
        return new class($kind) extends TrimCourseListeningQuestions
        {
            public function __construct(private string $kind) { parent::__construct(); }

            protected function preflight(Connection $connection, array $entries, bool $lock = false): array
            {
                $plan = parent::preflight($connection, $entries, $lock);
                if (! $lock) {
                    // Simulate another editor committing after the first read, before our transaction.
                    $change = match ($this->kind) {
                        'title' => ['title' => 'Concurrent private title'],
                        'active_scope' => ['practice_archived_at' => '2026-01-01 00:00:00'],
                        default => ['config' => '{"private":"concurrent configuration"}'],
                    };
                    $connection->table('lesson_block_variants')->where('id', 43)->update($change);
                }

                return $plan;
            }
        };
    }

    #[DataProvider('concurrentChanges')]
    public function test_rechecks_conflicts_inside_transaction_before_any_write(string $kind): void
    {
        $this->register($this->concurrentCommand($kind));
        $before = DB::table('lesson_block_variants')->where('id', '<>', 43)->get()->all();
        $this->assertSame(1, $this->runCommand(), $this->commandOutput);
        $this->assertEquals($before, DB::table('lesson_block_variants')->where('id', '<>', 43)->get()->all());
        $this->assertStringNotContainsString('Concurrent private', $this->commandOutput);
        $this->assertStringNotContainsString('concurrent configuration', $this->commandOutput);
        $this->assertSame([], $this->backups());
    }

    public static function triggerFailures(): array
    {
        return [['readback'], ['sql_error']];
    }

    #[DataProvider('triggerFailures')]
    public function test_readback_or_sql_failure_rolls_back_all_writes_and_does_not_leak_private_data(string $kind): void
    {
        $sql = $kind === 'readback'
            ? "CREATE TRIGGER trim_test AFTER UPDATE ON lesson_block_variants WHEN NEW.id = 43 BEGIN UPDATE lesson_block_variants SET title = 'private-trigger-title' WHERE id = 43; END"
            : "CREATE TRIGGER trim_test BEFORE UPDATE ON lesson_block_variants WHEN NEW.id = 43 BEGIN SELECT RAISE(ABORT, 'private-trigger-message'); END";
        DB::unprepared($sql);
        $before = $this->snapshot();
        $this->assertSame(1, $this->runCommand(), $this->commandOutput);
        $this->assertSame($before, $this->snapshot());
        $this->assertStringNotContainsString('private-trigger', $this->commandOutput);
        $this->assertStringNotContainsString('historical feedback', $this->commandOutput);
        $this->assertCount(1, $this->backups());
    }

    public function test_checked_backup_exists_before_first_update_and_exclusive_collision_aborts(): void
    {
        $observed = 0;
        DB::listen(function ($query) use (&$observed) {
            if (str_starts_with(strtolower($query->sql), 'update')) {
                $files = $this->backups();
                $this->assertCount(1, $files);
                $backup = json_decode(File::get($files[0]), true, 512, JSON_THROW_ON_ERROR);
                $this->assertCount(12, $backup['entries']);
                $observed++;
            }
        });
        $this->assertSame(0, $this->runCommand(), $this->commandOutput);
        $this->assertSame(12, $observed);
        // Restore only our memory fixture before testing exclusive directory creation.
        foreach ($this->pack['entries'] as $entry) {
            DB::table('lesson_block_variants')->where('id', $entry['variant_id'])->update(['config' => $this->encodeJson($entry['before']['config'])]);
        }
        $uuid = basename(dirname($this->backups()[0]));
        Str::createUuidsUsing(fn () => $uuid);
        $before = $this->snapshot();
        $bytes = File::get($this->backups()[0]);
        $this->assertSame(1, $this->runCommand(), $this->commandOutput);
        $this->assertSame($before, $this->snapshot());
        $this->assertSame($bytes, File::get($this->backups()[0]));
    }

    public function test_backup_failure_prevents_writes(): void
    {
        File::put($this->temporary.'/.tmp/'.static::SKILL.'-question-backups', 'not a directory');
        $before = $this->snapshot();
        $this->assertSame(1, $this->runCommand(), $this->commandOutput);
        $this->assertSame($before, $this->snapshot());
    }

    public function test_manifest_paths_are_resolved_and_bounded(): void
    {
        $outside = $this->temporary.'/outside.json';
        File::put($outside, $this->encodeJson($this->pack));
        $before = $this->snapshot();
        $this->assertSame(1, Artisan::call($this->commandName(), ['manifest' => $outside, '--apply' => true]));
        $this->assertSame(1, Artisan::call($this->commandName(), ['manifest' => $this->temporary.'/.tmp/../outside.json', '--apply' => true]));
        $this->assertSame($before, $this->snapshot());
        File::ensureDirectoryExists($this->temporary.'/resources/course/'.static::SKILL.'-revisions');
        $valid = $this->temporary.'/resources/course/'.static::SKILL.'-revisions/manifest.json';
        File::put($valid, $this->encodeJson($this->pack));
        $this->assertSame(0, Artisan::call($this->commandName(), ['manifest' => $valid]), $this->commandOutput);
        $this->assertSame($before, $this->snapshot());
        $link = $this->temporary.'/.tmp/link.json';
        if (@symlink($outside, $link)) {
            try {
                $this->assertSame(1, Artisan::call($this->commandName(), ['manifest' => $link, '--apply' => true]));
            } finally {
                unlink($link);
            }
        }
    }

    public function test_production_without_flag_and_wrong_production_flag_are_rejected(): void
    {
        $before = $this->snapshot();
        $this->assertSame(1, $this->runCommand(true, ['--production' => true]));
        $this->assertSame(1, $this->runCommand(false, ['--production' => true]));
        $this->app->instance('env', 'production');
        config(['app.env' => 'production', 'app.url' => 'https://langbridge-pathways.com']);
        $this->assertSame(1, $this->runCommand());
        $this->assertSame(1, $this->runCommand(true, ['--production' => true]));
        $this->assertSame($before, $this->snapshot());
        $this->assertSame([], $this->backups());
    }

    public static function guardCases(): array
    {
        return [
            ['local', false, '127.0.0.1', [], true], ['local', false, '::1', [], true],
            ['local', false, 'MariaDB-10.4', [], true], ['local', false, 'remote.example', [], false],
            ['local', false, 'mixed.example', [], false], ['local', false, 'unknown.example', [], false],
            ['local', false, '127.0.0.1', ['read' => ['host' => '192.0.2.10']], false],
            ['local', false, '127.0.0.1', ['write' => [['host' => '127.0.0.1'], ['host' => '192.0.2.10']]], false],
            ['local', false, '127.0.0.1', ['url' => 'mysql://test:test@192.0.2.10/db'], false],
            ['local', false, '127.0.0.1', ['unix_socket' => '/remote/socket'], false],
            ['production', false, '127.0.0.1', [], false], ['local', true, '127.0.0.1', [], false],
            ['production', true, '127.0.0.1', [], true], ['production', true, '192.0.2.10', [], false],
            ['production', true, '127.0.0.1', ['driver' => 'pgsql'], false],
        ];
    }

    #[DataProvider('guardCases')]
    public function test_guard_checks_configuration_without_opening_endpoints(string $environment, bool $production, string $host, array $overrides, bool $allowed): void
    {
        $this->app->instance('env', $environment);
        config(['app.env' => $environment, 'app.url' => 'https://langbridge-pathways.com']);
        $settings = ['name' => 'trim_guard', 'driver' => 'mysql', 'host' => $host, 'database' => 'db'];
        config(['database.connections.trim_guard' => array_replace($settings, $overrides)]);
        $connection = new Connection(function () { throw new RuntimeException('Must never connect'); }, 'db', '', $settings);
        $command = new class extends TrimCourseListeningQuestions
        {
            protected function isProductionPath(): bool { return true; }

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
        $failureMessage = '';
        try {
            $command->check($connection, $production);
        } catch (RuntimeException $exception) {
            $failed = true;
            $failureMessage = $exception->getMessage();
            $this->assertNotSame('Must never connect', $exception->getMessage());
        }
        $this->assertSame(! $allowed, $failed, $failureMessage);
    }
}
