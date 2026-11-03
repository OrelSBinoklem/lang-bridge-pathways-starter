<?php

namespace Tests\Feature;

use App\Console\Commands\ApplyCourseReadingRevision;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Database\Connection;
use Illuminate\Support\ConfigurationUrlParser;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ApplyCourseReadingRevisionTest extends TestCase
{
    private string $originalStorage;

    private string $originalConnection;

    private string $temporary;

    private array $pack;

    private array $protected;

    private array $before;

    protected function setUp(): void
    {
        parent::setUp();
        $this->originalStorage = storage_path();
        $this->originalConnection = DB::getDefaultConnection();
        config(['app.env' => 'testing', 'database.connections.reading_revision_test' => [
            'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true,
        ]]);
        $this->app->instance('env', 'testing');
        DB::setDefaultConnection('reading_revision_test');
        $this->assertSame('sqlite', DB::connection()->getDriverName());
        $this->assertSame(':memory:', DB::connection()->getConfig('database'));
        $this->temporary = base_path('.tmp/reading-revision-test-'.bin2hex(random_bytes(10)));
        File::ensureDirectoryExists($this->temporary);
        $this->app->useStoragePath($this->temporary.'/storage');
        $this->app->make(Kernel::class)->registerCommand(new ApplyCourseReadingRevision);
        Schema::create('course_groups', function ($table) {
            $table->id();
            $table->integer('dictionary_id');
            $table->integer('category_id');
            $table->string('level');
            $table->string('learn_lang');
            $table->boolean('is_published');
        });
        Schema::create('lesson_pages', function ($table) {
            $table->id();
            $table->integer('course_group_id');
            $table->string('skill');
            $table->string('level');
            $table->string('learn_lang');
            $table->string('status');
            $table->boolean('is_published');
        });
        Schema::create('lesson_blocks', function ($table) {
            $table->id();
            $table->integer('lesson_page_id');
            $table->string('type');
            $table->integer('source_block_id')->nullable();
            $table->text('bot_prompt')->default('private-block-prompt');
        });
        Schema::create('lesson_block_variants', function ($table) {
            $table->id();
            $table->integer('lesson_block_id');
            $table->string('seed_key')->nullable();
            $table->string('title')->nullable();
            $table->json('config');
            $table->integer('position');
            $table->boolean('is_published');
            $table->timestamps();
        });
        foreach (['lesson_block_progress', 'lesson_block_attempts', 'lesson_block_completions', 'dictionary_words', 'dictionary_categories', 'user_dictionary_words'] as $name) {
            Schema::create($name, function ($table) {
                $table->id();
                $table->text('sentinel');
            });
            DB::table($name)->insert(['id' => 7, 'sentinel' => 'protected-private-data']);
        }
        $this->pack = ['schema_version' => 1, 'scope' => 'course_reading_revision', 'entries' => []];
        foreach ([1763 => 'A1', 1775 => 'A2'] as $category => $level) {
            $group = $category === 1763 ? 1 : 2;
            DB::table('course_groups')->insert(['id' => $group, 'dictionary_id' => 20, 'category_id' => $category,
                'level' => $level, 'learn_lang' => 'lv', 'is_published' => true]);
            DB::table('lesson_pages')->insert(['id' => $group, 'course_group_id' => $group,
                'skill' => 'reading', 'level' => $level, 'learn_lang' => 'lv', 'status' => 'published', 'is_published' => true]);
            foreach (['reading_binary', 'lv_to_ru'] as $offset => $kind) {
                $block = $group * 10 + $offset;
                DB::table('lesson_blocks')->insert(['id' => $block, 'lesson_page_id' => $group, 'type' => 'reading']);
                foreach ([1, 2] as $seed) {
                    $id = 100 + count($this->pack['entries']);
                    $config = $this->configFor($kind);
                    $title = $id === 101 ? null : 'Before '.$id;
                    DB::table('lesson_block_variants')->insert(['id' => $id, 'lesson_block_id' => $block,
                        'seed_key' => 'variant:'.$seed, 'title' => $title, 'config' => json_encode($config, JSON_THROW_ON_ERROR),
                        'position' => $seed * 10, 'is_published' => true,
                        'created_at' => '2020-01-01 00:00:00', 'updated_at' => '2020-01-01 00:00:00']);
                    $after = $config;
                    if ($id !== 100) {
                        $after[$kind === 'reading_binary' ? 'questions' : 'reference_translation'] = $kind === 'reading_binary'
                            ? array_map(static fn ($question) => array_replace($question, ['explanation' => 'Revised explanation']), $config['questions'])
                            : "\u{042D}\u{0442}\u{0430}\u{043B}\u{043E}\u{043D} 2";
                    }
                    $this->pack['entries'][] = ['variant_id' => $id, 'block_id' => $block, 'page_id' => $group,
                        'category_id' => $category, 'level' => $level,
                        'expected_config_sha256' => ApplyCourseReadingRevision::fingerprint($config), 'expected_title' => $title,
                        'after_sha256' => ApplyCourseReadingRevision::fingerprint($after), 'title' => $id === 100 ? $title : 'After '.$id,
                        'config' => $after, 'action' => $id === 100 ? 'keep' : ($kind === 'reading_binary' ? 'questions_only' : 'copyedit')];
                }
            }
        }
        // Excluded variants must neither affect complete coverage nor be updated.
        foreach (['dictionary', 'group_unpublished', 'group_language', 'group_level', 'page_unpublished', 'page_status', 'page_skill',
            'page_language', 'page_level', 'block_type', 'block_source', 'variant_unpublished'] as $offset => $excluded) {
            $id = 300 + $offset;
            $group = (array) DB::table('course_groups')->where('id', 1)->first();
            $page = (array) DB::table('lesson_pages')->where('id', 1)->first();
            $block = (array) DB::table('lesson_blocks')->where('id', 10)->first();
            $variant = (array) DB::table('lesson_block_variants')->where('id', 100)->first();
            $group['id'] = $page['id'] = $page['course_group_id'] = $block['id'] = $block['lesson_page_id'] = $variant['id'] = $variant['lesson_block_id'] = $id;
            match ($excluded) {
                'dictionary' => $group['dictionary_id'] = 21,
                'group_unpublished' => $group['is_published'] = false,
                'group_language' => $group['learn_lang'] = 'en',
                'group_level' => $group['level'] = 'C1',
                'page_unpublished' => $page['is_published'] = false,
                'page_status' => $page['status'] = 'draft',
                'page_skill' => $page['skill'] = 'writing',
                'page_language' => $page['learn_lang'] = 'en',
                'page_level' => $page['level'] = 'C1',
                'block_type' => $block['type'] = 'listening',
                'block_source' => $block['source_block_id'] = 10,
                'variant_unpublished' => $variant['is_published'] = false,
            };
            DB::table('course_groups')->insert($group);
            DB::table('lesson_pages')->insert($page);
            DB::table('lesson_blocks')->insert($block);
            DB::table('lesson_block_variants')->insert($variant);
        }
        $this->before = $this->variantState();
        $this->protected = $this->protectedState();
    }

    protected function tearDown(): void
    {
        try {
            if (isset($this->originalConnection)) {
                DB::purge('reading_revision_test');
                DB::setDefaultConnection($this->originalConnection);
                $this->app->useStoragePath($this->originalStorage);
            }
            if (isset($this->temporary) && is_dir($this->temporary)) {
                $root = realpath(base_path('.tmp'));
                $resolved = realpath($this->temporary);
                $this->assertNotFalse($root);
                $this->assertSame(strtolower(str_replace('\\', '/', $this->temporary)), strtolower(str_replace('\\', '/', $resolved)));
                $this->assertStringStartsWith(strtolower(str_replace('\\', '/', $root)).'/reading-revision-test-', strtolower(str_replace('\\', '/', $resolved)));
                $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($resolved, \FilesystemIterator::SKIP_DOTS), \RecursiveIteratorIterator::SELF_FIRST);
                foreach ($iterator as $file) {
                    $this->assertFalse($file->isLink(), 'Refuse cleanup across symlinks.');
                    $this->assertStringStartsWith(strtolower(str_replace('\\', '/', $resolved)).'/', strtolower(str_replace('\\', '/', $file->getRealPath())));
                }
                File::deleteDirectory($resolved);
            }
        } finally {
            parent::tearDown();
        }
    }

    private function configFor(string $kind): array
    {
        $protected = ['authoring' => ['ids' => [123, 456]], 'tutor_prompt' => 'private-variant-prompt', 'empty_object' => (object) [], 'empty_array' => []];

        return $kind === 'reading_binary' ? array_merge($protected, [
            'task_kind' => $kind, 'text' => "J\u{0101}nis lasa tekstu. /\u{2028}\u{2029}",
            'questions' => array_map(static fn ($i) => ['statement' => 'Apgalvojums '.$i, 'correct' => $i % 2 === 0, 'explanation' => 'Atbilde '.$i], range(1, 10)),
        ]) : array_merge($protected, ['task_kind' => $kind, 'source_text' => "J\u{0101}nis lasa tekstu.",
            'reference_translation' => "\u{042D}\u{0442}\u{0430}\u{043B}\u{043E}\u{043D}"]);
    }

    private function variantState(): array
    {
        return DB::table('lesson_block_variants')->orderBy('id')->get()->mapWithKeys(static fn ($row) => [$row->id => (array) $row])->all();
    }

    private function protectedState(): array
    {
        $state = [];
        foreach (['course_groups', 'lesson_pages', 'lesson_blocks', 'lesson_block_progress', 'lesson_block_attempts',
            'lesson_block_completions', 'dictionary_words', 'dictionary_categories', 'user_dictionary_words'] as $table) {
            $state[$table] = DB::table($table)->orderBy('id')->get()->toJson();
        }
        $state['identities'] = DB::table('lesson_block_variants')->orderBy('id')
            ->get(['id', 'lesson_block_id', 'seed_key', 'position', 'is_published', 'created_at'])->toJson();
        $state['excluded'] = DB::table('lesson_block_variants')->where('id', '>=', 300)->orderBy('id')->get()->toJson();

        return $state;
    }

    private function runRevision(bool $apply = false, int $exit = 0, ?string $path = null): string
    {
        $path ??= $this->temporary.'/manifest.json';
        File::put($path, json_encode($this->pack, JSON_THROW_ON_ERROR));
        $args = ['manifest' => $path];
        if ($apply) {
            $args['--apply'] = true;
        }
        $this->assertSame($exit, Artisan::call('course:apply-reading-revision', $args));
        $output = Artisan::output();
        $this->assertStringNotContainsString('private-variant-prompt', $output);
        $this->assertStringNotContainsString('Apgalvojums', $output);
        $this->assertSame($this->protected, $this->protectedState());

        return $output;
    }

    private function backups(): array
    {
        return File::glob(storage_path('app/private/course/reading-revision-backups/*/before.json'));
    }

    private function rehash(int $index): void
    {
        $this->pack['entries'][$index]['after_sha256'] = ApplyCourseReadingRevision::fingerprint($this->pack['entries'][$index]['config']);
    }

    public function test_default_dry_run_has_no_writes_and_never_reads_progress(): void
    {
        $queries = [];
        DB::listen(static function ($query) use (&$queries) {
            $queries[] = $query->sql;
        });
        $output = $this->runRevision();
        // protectedState() reads these tables in the test, after Artisan has returned.
        $commandQueries = array_slice($queries, 0, count($queries) - 11);
        $this->assertCount(1, $commandQueries);
        $this->assertStringNotContainsString('progress', $commandQueries[0]);
        $this->assertStringNotContainsString('attempts', $commandQueries[0]);
        $this->assertStringContainsString('changed=7 kept=1 already_applied=0 dry_run=yes', $output);
        $this->assertSame($this->before, $this->variantState());
        $this->assertDirectoryDoesNotExist(storage_path());
    }

    public function test_apply_preserves_every_identity_and_protected_row_and_is_idempotent(): void
    {
        $output = $this->runRevision(true);
        $this->assertStringContainsString('changed=7 kept=1 already_applied=0 dry_run=no backup=app/private/course/reading-revision-backups/', $output);
        $this->assertCount(1, $this->backups());
        $archive = json_decode(File::get($this->backups()[0]), false, 512, JSON_THROW_ON_ERROR);
        $this->assertCount(7, $archive->entries);
        foreach ($archive->entries as $entry) {
            $before = $this->before[$entry->variant_id];
            $this->assertSame($before['title'], $entry->title);
            $this->assertSame(ApplyCourseReadingRevision::fingerprint(json_decode($before['config'])), $entry->config_sha256);
            $this->assertSame($entry->config_sha256, ApplyCourseReadingRevision::fingerprint($entry->config));
        }
        foreach ($this->pack['entries'] as $entry) {
            $row = DB::table('lesson_block_variants')->where('id', $entry['variant_id'])->first();
            $this->assertSame($entry['title'], $row->title);
            $this->assertSame($entry['after_sha256'], ApplyCourseReadingRevision::fingerprint(json_decode($row->config)));
            $this->assertInstanceOf(\stdClass::class, json_decode($row->config)->empty_object);
        }
        $this->assertSame($this->before[100], $this->variantState()[100]);
        if (PHP_OS_FAMILY !== 'Windows') {
            $this->assertSame(0600, fileperms($this->backups()[0]) & 0777);
            $this->assertSame(0700, fileperms(dirname($this->backups()[0])) & 0777);
        }
        $applied = $this->variantState();
        $this->assertStringContainsString('changed=0 kept=1 already_applied=7', $this->runRevision(true));
        $this->assertSame($applied, $this->variantState());
        $this->assertCount(1, $this->backups());
    }

    #[DataProvider('conflicts')]
    public function test_one_stale_or_mixed_title_config_aborts_all(string $state): void
    {
        $entry = $this->pack['entries'][7];
        $changes = match ($state) {
            'stale_config' => ['config' => json_encode(array_replace($entry['config'], ['source_text' => 'Editor changed text.']))],
            'stale_title' => ['title' => 'Editor title'],
            'after_config_before_title' => ['config' => json_encode($entry['config'])],
            'before_config_after_title' => ['title' => $entry['title']],
        };
        DB::table('lesson_block_variants')->where('id', 107)->update($changes);
        $stateBefore = $this->variantState();
        $this->runRevision(true, 1);
        $this->assertSame($stateBefore, $this->variantState());
        $this->assertCount(0, $this->backups());
    }

    public static function conflicts(): array
    {
        return array_map(static fn ($state) => [$state], ['stale_config', 'stale_title', 'after_config_before_title', 'before_config_after_title']);
    }

    #[DataProvider('invalidEntries')]
    public function test_invalid_metadata_scope_or_protected_content_is_rejected(string $case): void
    {
        switch ($case) {
            case 'missing': array_pop($this->pack['entries']);
                break;
            case 'duplicate': $this->pack['entries'][7] = $this->pack['entries'][0];
                break;
            case 'unknown': $this->pack['entries'][7]['variant_id'] = 99999;
                break;
            case 'other_skill': $this->pack['entries'][7]['variant_id'] = 306;
                break;
            case 'category': $this->pack['entries'][1]['category_id'] = 1775;
                break;
            case 'block': $this->pack['entries'][1]['block_id'] = 11;
                break;
            case 'page': $this->pack['entries'][1]['page_id'] = 2;
                break;
            case 'level': $this->pack['entries'][1]['level'] = 'B1';
                break;
            case 'string_id': $this->pack['entries'][1]['variant_id'] = '101';
                break;
            case 'float_id': $this->pack['entries'][1]['page_id'] = 1.5;
                break;
            case 'zero_id': $this->pack['entries'][1]['category_id'] = 0;
                break;
            case 'bad_hash': $this->pack['entries'][1]['expected_config_sha256'] = str_repeat('g', 64);
                break;
            case 'wrong_after_hash': $this->pack['entries'][1]['after_sha256'] = str_repeat('a', 64);
                break;
            case 'extra_metadata': $this->pack['entries'][1]['seed_key'] = 'variant:9';
                break;
            case 'bad_action': $this->pack['entries'][1]['action'] = 'force';
                break;
            case 'bad_title': $this->pack['entries'][1]['title'] = 42;
                break;
            case 'task_kind': $this->pack['entries'][1]['config'] = $this->configFor('lv_to_ru');
                break;
            case 'add_field': $this->pack['entries'][1]['config']['audio_url'] = '/audio.mp3';
                break;
            case 'remove_field': unset($this->pack['entries'][1]['config']['authoring']);
                break;
            case 'change_field': $this->pack['entries'][1]['config']['tutor_prompt'] = 'Changed prompt';
                break;
            case 'question_extra': $this->pack['entries'][1]['config']['questions'][0]['evidence'] = 'Editorial evidence';
                break;
            case 'two_questions': $this->pack['entries'][1]['config']['questions'] = array_slice($this->pack['entries'][1]['config']['questions'], 0, 2);
                break;
            case 'eleven_questions': $this->pack['entries'][1]['config']['questions'][] = ['statement' => 'Additional statement', 'correct' => true, 'explanation' => 'Evidence'];
                break;
            case 'duplicate_statement': $this->pack['entries'][1]['config']['questions'][1]['statement'] = '  APGALVOJUMS 1  ';
                break;
            case 'nonboolean': $this->pack['entries'][1]['config']['questions'][0]['correct'] = 1;
                break;
            case 'empty_explanation': $this->pack['entries'][1]['config']['questions'][0]['explanation'] = ' ';
                break;
            case 'empty_text': $this->pack['entries'][1]['config']['text'] = '';
                break;
            case 'questions_only_text': $this->pack['entries'][1]['config']['text'] = 'Mainits teksts.';
                break;
            case 'empty_source': $this->pack['entries'][3]['config']['source_text'] = ' ';
                break;
            case 'empty_reference': $this->pack['entries'][3]['config']['reference_translation'] = '';
                break;
            case 'missing_reference': unset($this->pack['entries'][3]['config']['reference_translation']);
                break;
            case 'translation_questions_only': $this->pack['entries'][3]['action'] = 'questions_only';
                break;
            case 'keep_config': $this->pack['entries'][1]['action'] = 'keep';
                break;
            case 'keep_title': $this->pack['entries'][0]['title'] = 'Changed kept title';
                break;
        }
        if ($case !== 'wrong_after_hash') {
            foreach (array_keys($this->pack['entries']) as $index) {
                $this->rehash($index);
            }
        }
        $this->runRevision(true, 1);
        $this->assertSame($this->before, $this->variantState());
        $this->assertCount(0, $this->backups());
    }

    public static function invalidEntries(): array
    {
        $cases = ['missing', 'duplicate', 'unknown', 'other_skill', 'category', 'block', 'page', 'level', 'string_id', 'float_id', 'zero_id',
            'bad_hash', 'wrong_after_hash', 'extra_metadata', 'bad_action', 'bad_title', 'task_kind', 'add_field', 'remove_field', 'change_field',
            'question_extra', 'two_questions', 'eleven_questions', 'duplicate_statement', 'nonboolean', 'empty_explanation', 'empty_text', 'questions_only_text',
            'empty_source', 'empty_reference', 'missing_reference', 'translation_questions_only', 'keep_config', 'keep_title'];

        return array_combine($cases, array_map(static fn ($case) => [$case], $cases));
    }

    public function test_changed_publication_type_and_new_in_scope_variant_reject_coverage(): void
    {
        foreach ([['lesson_blocks', 20, ['type' => 'listening']], ['lesson_blocks', 20, ['source_block_id' => 10]],
            ['lesson_pages', 2, ['level' => 'B1']], ['lesson_pages', 2, ['is_published' => false]],
            ['course_groups', 2, ['is_published' => false]], ['lesson_block_variants', 107, ['is_published' => false]]] as [$table, $id, $changes]) {
            $original = (array) DB::table($table)->where('id', $id)->first();
            DB::table($table)->where('id', $id)->update($changes);
            $this->protected = $this->protectedState();
            $this->runRevision(true, 1);
            DB::table($table)->where('id', $id)->update($original);
        }
        $extra = $this->before[107];
        $extra['id'] = 200;
        $extra['seed_key'] = 'variant:3';
        $extra['position'] = 30;
        DB::table('lesson_block_variants')->insert($extra);
        $this->protected = $this->protectedState();
        $before = $this->variantState();
        $this->runRevision(true, 1);
        $this->assertSame($before, $this->variantState());
        $this->assertCount(0, $this->backups());
    }

    public function test_missing_reference_can_be_added_and_title_only_revision_can_be_applied(): void
    {
        $translation = $this->pack['entries'][3]['config'];
        unset($translation['reference_translation']);
        DB::table('lesson_block_variants')->where('id', 103)->update(['config' => json_encode($translation)]);
        $this->pack['entries'][3]['expected_config_sha256'] = ApplyCourseReadingRevision::fingerprint($translation);
        $this->pack['entries'][1]['config'] = json_decode($this->before[101]['config']);
        $this->rehash(1);
        $this->runRevision(true);
        $this->assertSame('After 101', DB::table('lesson_block_variants')->where('id', 101)->value('title'));
        $this->assertStringContainsString('already_applied=7', $this->runRevision(true));
    }

    public function test_transaction_failure_rolls_back_every_update_and_keeps_full_before_backup(): void
    {
        DB::unprepared("CREATE TRIGGER reject_last BEFORE UPDATE ON lesson_block_variants WHEN NEW.id = 107 BEGIN SELECT RAISE(ABORT, 'private-variant-prompt'); END");
        $this->runRevision(true, 1);
        $this->assertSame($this->before, $this->variantState());
        $this->assertCount(1, $this->backups());
        $this->assertCount(7, json_decode(File::get($this->backups()[0]))->entries);
    }

    public function test_after_hash_is_verified_before_commit(): void
    {
        DB::unprepared("CREATE TRIGGER corrupt_after AFTER UPDATE ON lesson_block_variants WHEN NEW.id = 107 BEGIN UPDATE lesson_block_variants SET title = 'corrupt' WHERE id = 107; END");
        $this->runRevision(true, 1);
        $this->assertSame($this->before, $this->variantState());
        $this->assertCount(1, $this->backups());
    }

    public function test_second_preflight_detects_edit_between_initial_validation_and_transaction(): void
    {
        $changed = false;
        DB::listen(static function ($query) use (&$changed) {
            if (! $changed && str_starts_with($query->sql, 'select') && str_contains($query->sql, 'lesson_block_variants')) {
                $changed = true;
                DB::table('lesson_block_variants')->where('id', 107)->update(['title' => 'Concurrent editor']);
            }
        });
        $this->runRevision(true, 1);
        $expected = $this->before;
        $expected[107]['title'] = 'Concurrent editor';
        $this->assertSame($expected, $this->variantState());
        $this->assertCount(0, $this->backups());
    }

    public function test_backup_failure_prevents_all_updates(): void
    {
        File::ensureDirectoryExists(storage_path('app/private/course'));
        File::put(storage_path('app/private/course/reading-revision-backups'), 'occupied');
        $this->runRevision(true, 1);
        $this->assertSame($this->before, $this->variantState());
    }

    public function test_manifest_outside_allowed_directories_and_invalid_json_are_rejected(): void
    {
        $base = base_path();
        $this->app->setBasePath($this->temporary);
        try {
            // The manifest is at this isolated workspace's root, outside both allowed directories.
            $this->runRevision(true, 1);
        } finally {
            $this->app->setBasePath($base);
        }
        $path = $this->temporary.'/broken.json';
        File::put($path, '{"scope":');
        $this->assertSame(1, Artisan::call('course:apply-reading-revision', ['manifest' => $path, '--apply' => true]));
        $this->assertSame($this->before, $this->variantState());
        $this->assertCount(0, $this->backups());
    }

    public function test_public_storage_and_symlink_backup_are_rejected(): void
    {
        $privateStorage = storage_path();
        File::ensureDirectoryExists($privateStorage.'/app/public');
        $this->app->usePublicPath($privateStorage.'/app/public');
        $this->app->useStoragePath($privateStorage.'/app/public/leaked-storage');
        $this->runRevision(true, 1);
        $this->assertSame($this->before, $this->variantState());
        $this->app->useStoragePath($privateStorage);
        $link = $privateStorage.'/app/private';
        if (! @symlink($privateStorage.'/app/public', $link)) {
            $this->markTestSkipped('Directory symlinks are unavailable on this host; public-storage rejection was checked.');
        }
        try {
            $this->runRevision(true, 1);
            $this->assertSame($this->before, $this->variantState());
        } finally {
            PHP_OS_FAMILY === 'Windows' ? rmdir($link) : unlink($link);
        }
    }

    #[DataProvider('forbiddenEnvironments')]
    public function test_nonlocal_apply_is_forbidden(string $environment, string $configured): void
    {
        $this->app->instance('env', $environment);
        config(['app.env' => $configured]);
        $output = $this->runRevision(true, 1);
        if ($environment === 'production' || $configured === 'production') {
            $this->assertStringContainsString('Production apply is forbidden', $output);
        }
        $this->assertSame($this->before, $this->variantState());
        $this->assertCount(0, $this->backups());
    }

    public static function forbiddenEnvironments(): array
    {
        return [['production', 'production'], ['staging', 'staging'], ['local', 'local'], ['production', 'testing'], ['testing', 'production'], ['local', 'testing']];
    }

    #[DataProvider('databaseGuards')]
    public function test_loopback_alias_and_all_read_write_database_guards(array $overrides, array $addresses, bool $allowed): void
    {
        $this->app->instance('env', 'local');
        config(['app.env' => 'local']);
        $settings = array_replace(['name' => 'reading_guard', 'driver' => 'mariadb', 'host' => 'MariaDB-10.4', 'database' => 'isolated'], $overrides);
        config(['database.connections.reading_guard' => $settings]);
        $command = new class($addresses) extends ApplyCourseReadingRevision
        {
            public function __construct(private array $addresses)
            {
                parent::__construct();
            }

            protected function resolveHost(string $host): array
            {
                return $this->addresses;
            }

            public function check(Connection $connection): void
            {
                $this->guardApply($connection);
            }
        };
        $effective = (new ConfigurationUrlParser)->parseConfiguration($settings);
        // Model the factory stripping read/write configuration from the actual connection.
        unset($effective['read'], $effective['write']);
        $connection = new Connection(null, 'isolated', '', $effective);
        if (! $allowed) {
            $this->expectException(\RuntimeException::class);
        }
        $command->check($connection);
        $this->assertTrue($allowed);
    }

    public static function databaseGuards(): array
    {
        return [
            'OSPanel alias' => [[], ['127.0.0.1'], true],
            'all alias addresses loopback' => [[], ['127.0.0.1', '127.0.0.2'], true],
            'alias mixed addresses' => [[], ['127.0.0.1', '192.0.2.5'], false],
            'unresolved alias' => [[], [], false],
            'remote literal' => [['host' => '192.0.2.5'], ['127.0.0.1'], false],
            'IPv6 loopback' => [['host' => '::1'], [], true],
            'loopback multi hosts' => [['host' => ['127.0.0.1', '127.0.0.2']], [], true],
            'empty hosts' => [['host' => []], [], false],
            'remote read' => [['read' => ['host' => '192.0.2.5']], ['127.0.0.1'], false],
            'remote write' => [['write' => ['host' => '192.0.2.5']], ['127.0.0.1'], false],
            'random read choices' => [['read' => [['host' => '127.0.0.1'], ['host' => '192.0.2.5']]], ['127.0.0.1'], false],
            'cross database read' => [['read' => ['host' => '127.0.0.1', 'database' => 'other']], ['127.0.0.1'], false],
            'cross database write' => [['write' => ['host' => '127.0.0.1', 'database' => 'other']], ['127.0.0.1'], false],
            'remote URL overrides local host' => [['host' => '127.0.0.1', 'url' => 'mysql://192.0.2.5/isolated'], [], false],
            'nested URL forbidden' => [['read' => ['url' => 'mysql://192.0.2.5/isolated']], ['127.0.0.1'], false],
            'socket bypass forbidden' => [['unix_socket' => '/remote/socket'], ['127.0.0.1'], false],
            'unsupported driver' => [['driver' => 'pgsql'], ['127.0.0.1'], false],
        ];
    }

    public function test_canonical_digest_matches_js_unicode_and_sorted_objects(): void
    {
        $value = json_decode('{"z":true,"a":{"10":"ten","2":"two","b":[],"a":{}},"text":"\u0101/\u2028\u2029","numbers":[1.0,0.000001,1e21]}');
        $expected = '{"a":{"2":"two","10":"ten","a":{},"b":[]},"numbers":[1,0.000001,1e+21],"text":"'."\u{0101}/\u{2028}\u{2029}".'","z":true}';
        $this->assertSame($expected, ApplyCourseReadingRevision::canonicalJson($value));
        $this->assertSame(hash('sha256', $expected), ApplyCourseReadingRevision::fingerprint($value));
    }
}
