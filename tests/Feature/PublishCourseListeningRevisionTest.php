<?php

namespace Tests\Feature;

use App\Console\Commands\PublishCourseListeningRevision;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PublishCourseListeningRevisionTest extends TestCase
{
    private string $originalBase;

    private string $originalStorage;

    private string $temporaryBase;

    private string $originalConnection;

    private array $pack;

    private array $before;

    private array $protectedRows;

    private string $audioBytes;

    protected function setUp(): void
    {
        parent::setUp();
        $this->app->make(Kernel::class)->registerCommand(new PublishCourseListeningRevision);
        $this->originalBase = base_path();
        $this->originalStorage = storage_path();
        $this->originalConnection = DB::getDefaultConnection();
        config(['database.connections.listening_revision_test' => [
            'driver' => 'sqlite', 'database' => ':memory:', 'prefix' => '', 'foreign_key_constraints' => true,
        ]]);
        DB::setDefaultConnection('listening_revision_test');
        $this->assertSame(':memory:', DB::connection()->getConfig('database'));
        $this->temporaryBase = base_path('.tmp/listening-revision-test-'.bin2hex(random_bytes(6)));
        File::ensureDirectoryExists($this->temporaryBase);
        $this->app->setBasePath($this->temporaryBase);
        $this->app->useStoragePath($this->temporaryBase.'/storage');
        Schema::create('course_groups', function ($table) {
            $table->id();
            $table->integer('category_id');
            $table->string('level');
            $table->string('learn_lang');
        });
        Schema::create('lesson_pages', function ($table) {
            $table->id();
            $table->integer('course_group_id');
            $table->string('slug');
            $table->string('skill');
            $table->string('learn_lang');
            $table->string('level');
            $table->string('title');
            $table->boolean('is_published');
        });
        Schema::create('lesson_blocks', function ($table) {
            $table->id();
            $table->integer('lesson_page_id');
            $table->string('type');
            $table->integer('position');
            $table->integer('source_block_id')->nullable();
        });
        Schema::create('lesson_block_variants', function ($table) {
            $table->id();
            $table->integer('lesson_block_id');
            $table->string('seed_key');
            $table->string('title');
            $table->json('config');
            $table->integer('position');
            $table->boolean('is_published');
            $table->timestamps();
        });
        foreach (['lesson_block_progress', 'lesson_block_attempts', 'dictionary_words', 'user_dictionary_words'] as $name) {
            Schema::create($name, function ($table) {
                $table->id();
                $table->text('sentinel');
            });
            DB::table($name)->insert(['id' => 7, 'sentinel' => 'unchanged-private-data']);
        }
        // Repeated MPEG frame headers, sufficient for libmagic without an external encoder.
        $this->audioBytes = str_repeat("\xff\xfb\x90\x64".str_repeat("\x00", 413), 10);
        $hash = hash('sha256', $this->audioBytes);
        foreach (['prior-audio-release', 'revision-release'] as $release) {
            $directory = base_path('frontend/public/audio/course/listening/'.$release);
            File::ensureDirectoryExists($directory);
            File::put($directory.'/'.$hash.'.mp3', $this->audioBytes);
        }
        $config = [
            'task_kind' => 'listening',
            'dialogue_segments' => [['speaker' => 'a', 'text' => 'Labdien!'], ['speaker' => 'b', 'text' => 'Sveiki!']],
            'speaker_profiles' => ['a' => ['name' => 'Anna', 'gender' => 'female'], 'b' => ['name' => 'Janis', 'gender' => 'male']],
            'transcript' => "A: Labdien!\nB: Sveiki!",
            'questions' => array_map(static fn ($i) => ['statement' => 'Apgalvojums '.$i, 'correct' => $i < 5, 'explanation' => 'Atbilde '.$i], range(0, 9)),
            'audio_url' => '/old-audio.mp3', 'audio_generation' => ['provider' => 'old-provider'],
            'authoring' => ['source_sha256' => str_repeat('a', 64), 'target_word_ids' => [123, 456]],
            'empty_object' => (object) [], 'empty_array' => [],
        ];
        $this->pack = ['schema_version' => 1, 'scope' => 'course_listening_revision', 'release' => 'revision-release', 'items' => []];
        $this->before = [];
        foreach (range(1763, 1800) as $category) {
            $level = $category <= 1774 ? 'A1' : ($category <= 1785 ? 'A2' : ($category <= 1795 ? 'B1' : 'B2'));
            DB::table('course_groups')->insert(['id' => $category, 'category_id' => $category, 'level' => $level, 'learn_lang' => 'lv']);
            DB::table('lesson_pages')->insert(['id' => $category, 'course_group_id' => $category,
                'slug' => "course-{$category}-listening", 'skill' => 'listening', 'learn_lang' => 'lv',
                'level' => $level, 'title' => 'Original page title', 'is_published' => false]);
            DB::table('lesson_blocks')->insert(['id' => $category, 'lesson_page_id' => $category, 'type' => 'listening', 'position' => 10]);
            foreach (range(1, 5) as $seed) {
                $id = count($this->pack['items']) + 10000;
                $before = ['title' => "Before {$category}:{$seed}", 'config' => $config];
                $this->before[$id] = $before;
                DB::table('lesson_block_variants')->insert(['id' => $id, 'lesson_block_id' => $category,
                    'seed_key' => "variant:{$seed}", 'title' => $before['title'], 'config' => json_encode($config, JSON_THROW_ON_ERROR),
                    'position' => $seed * 10, 'is_published' => $seed % 2 === 0, 'created_at' => '2020-01-01 00:00:00', 'updated_at' => '2020-01-01 00:00:00']);
                $afterConfig = $config;
                $afterConfig['dialogue_segments'][0]['text'] = 'Labrit!';
                $afterConfig['transcript'] = "A: Labrit!\nB: Sveiki!";
                $release = $id < 10114 ? 'prior-audio-release' : 'revision-release';
                $afterConfig['audio_url'] = "/audio/course/listening/{$release}/{$hash}.mp3";
                $afterConfig['audio_generation'] = ['provider' => 'google', 'model' => 'gemini-3.8-flash-tts', 'file_sha256' => $hash];
                $after = ['title' => "After {$category}:{$seed}", 'config' => $afterConfig];
                $this->pack['items'][] = [
                    'category_id' => $category, 'level' => $level, 'seed_key' => "variant:{$seed}",
                    'expected_before_sha256' => PublishCourseListeningRevision::fingerprint($before),
                    'after_sha256' => PublishCourseListeningRevision::fingerprint($after), 'after' => $after,
                    'file_sha256' => $hash, 'audio_mime' => 'audio/mpeg',
                ];
            }
        }
        $this->protectedRows = $this->protectedState();
    }

    protected function tearDown(): void
    {
        DB::purge('listening_revision_test');
        DB::setDefaultConnection($this->originalConnection);
        $this->app->setBasePath($this->originalBase);
        $this->app->useStoragePath($this->originalStorage);
        parent::tearDown();
    }

    private function protectedState(): array
    {
        $state = [];
        foreach (['course_groups', 'lesson_pages', 'lesson_blocks', 'lesson_block_progress', 'lesson_block_attempts', 'dictionary_words', 'user_dictionary_words'] as $table) {
            $state[$table] = DB::table($table)->orderBy('id')->get()->toJson();
        }
        $state['variant_identity'] = DB::table('lesson_block_variants')->orderBy('id')
            ->get(['id', 'lesson_block_id', 'seed_key', 'position', 'is_published', 'created_at'])->toJson();

        return $state;
    }

    private function runRelease(bool $apply, int $exitCode): void
    {
        $manifest = $this->temporaryBase.'/manifest.json';
        File::put($manifest, json_encode($this->pack, JSON_THROW_ON_ERROR));
        $args = ['manifest' => $manifest];
        if ($apply) {
            $args['--apply'] = true;
        }
        $this->artisan('course:publish-listening-revision', $args)->assertExitCode($exitCode);
        $this->assertSame($this->protectedRows, $this->protectedState());
    }

    private function backups(): array
    {
        return File::glob(storage_path('app/private/course/listening-revision-backups/*.json'));
    }

    private function assertBefore(): void
    {
        foreach (DB::table('lesson_block_variants')->orderBy('id')->get() as $row) {
            $this->assertSame(PublishCourseListeningRevision::fingerprint($this->before[$row->id]),
                PublishCourseListeningRevision::fingerprint(['title' => $row->title, 'config' => json_decode($row->config)]));
        }
        $this->assertCount(0, $this->backups());
    }

    private function rehash(int $index = 0): void
    {
        $this->pack['items'][$index]['after_sha256'] = PublishCourseListeningRevision::fingerprint($this->pack['items'][$index]['after']);
    }

    public function test_default_dry_run_apply_and_idempotence_with_114_reused_files(): void
    {
        $this->runRelease(false, 0);
        $this->assertBefore();
        $this->assertDirectoryDoesNotExist(storage_path('app/private/course/listening-revision-backups'));
        $this->runRelease(true, 0);
        $rows = DB::table('lesson_block_variants')->orderBy('id')->get();
        foreach ($rows as $index => $row) {
            $this->assertSame($this->pack['items'][$index]['after_sha256'],
                PublishCourseListeningRevision::fingerprint(['title' => $row->title, 'config' => json_decode($row->config)]));
            $this->assertInstanceOf(\stdClass::class, json_decode($row->config)->empty_object);
        }
        $backupFiles = $this->backups();
        $this->assertCount(1, $backupFiles);
        $backup = json_decode(File::get($backupFiles[0]));
        $this->assertCount(190, $backup->items);
        foreach ($backup->items as $item) {
            $this->assertSame(PublishCourseListeningRevision::fingerprint($this->before[$item->variant_id]), $item->before_sha256);
            $this->assertSame($item->before_sha256, PublishCourseListeningRevision::fingerprint($item->before));
        }
        if (PHP_OS_FAMILY !== 'Windows') {
            $this->assertSame(0600, fileperms($backupFiles[0]) & 0777);
        }
        $unchanged = $rows->toJson();
        $this->runRelease(true, 0);
        $this->assertSame($unchanged, DB::table('lesson_block_variants')->orderBy('id')->get()->toJson());
        $this->assertCount(1, $this->backups());
    }

    public function test_title_content_audio_and_authoring_edits_abort_the_entire_release(): void
    {
        foreach (['title', 'transcript', 'audio_url', 'authoring'] as $field) {
            $before = $this->before[10189];
            if ($field === 'title') {
                $before['title'] = 'Editor changed title';
            } else {
                $before['config'][$field] = 'editor-change';
            }
            DB::table('lesson_block_variants')->where('id', 10189)->update(['title' => $before['title'], 'config' => json_encode($before['config'])]);
            $state = DB::table('lesson_block_variants')->orderBy('id')->get()->toJson();
            $this->runRelease(true, 1);
            $this->assertSame($state, DB::table('lesson_block_variants')->orderBy('id')->get()->toJson());
            $this->assertCount(0, $this->backups());
        }
    }

    public function test_invalid_count_duplicate_scope_missing_hash_and_wrong_after_hash_fail_closed(): void
    {
        $valid = $this->pack;
        array_pop($this->pack['items']);
        $this->runRelease(true, 1);
        $this->pack = $valid;
        $this->pack['items'][189] = $this->pack['items'][0];
        $this->runRelease(true, 1);
        $this->pack = $valid;
        unset($this->pack['items'][0]['expected_before_sha256']);
        $this->runRelease(true, 1);
        $this->pack = $valid;
        $this->pack['items'][0]['after']['title'] = 'Unhashed edit';
        $this->runRelease(true, 1);
        $this->pack = $valid;
        $this->pack['items'][0]['category_id'] = 1801;
        $this->runRelease(true, 1);
        $this->assertBefore();
    }

    public function test_runtime_editorial_fields_incomplete_configs_and_protected_metadata_are_rejected(): void
    {
        $valid = $this->pack;
        foreach (['evidence', 'skill', 'answer'] as $field) {
            $this->pack = $valid;
            $this->pack['items'][0]['after']['config']['questions'][0][$field] = 'must-not-leak';
            $this->rehash();
            $this->runRelease(true, 1);
        }
        $this->pack = $valid;
        unset($this->pack['items'][0]['after']['config']['questions']);
        $this->rehash();
        $this->runRelease(true, 1);
        $this->pack = $valid;
        $this->pack['items'][0]['after']['config']['transcript'] = 'Not the dialogue';
        $this->rehash();
        $this->runRelease(true, 1);
        $this->pack = $valid;
        $this->pack['items'][0]['after']['config']['authoring']['target_word_ids'] = [999];
        $this->rehash();
        $this->runRelease(true, 1);
        $this->assertBefore();
    }

    public function test_unsafe_paths_corrupt_missing_and_non_audio_files_are_rejected(): void
    {
        $valid = $this->pack;
        foreach (['/audio/course/listening/../private.mp3', 'https://example.test/audio.mp3', '/audio/course/listening/%2e%2e/audio.mp3', '/audio/course/listening/release/file.mp3'] as $url) {
            $this->pack = $valid;
            $this->pack['items'][0]['after']['config']['audio_url'] = $url;
            $this->rehash();
            $this->runRelease(true, 1);
        }
        $this->pack = $valid;
        $file = base_path('frontend/public'.$this->pack['items'][0]['after']['config']['audio_url']);
        File::put($file, str_repeat('broken', 500));
        $this->runRelease(true, 1);
        // A matching checksum alone must not accept a non-audio payload.
        $hash = hash('sha256', str_repeat('text-not-audio', 200));
        $url = '/audio/course/listening/prior-audio-release/'.$hash.'.mp3';
        File::put(base_path('frontend/public'.$url), str_repeat('text-not-audio', 200));
        $this->pack['items'][0]['file_sha256'] = $hash;
        $this->pack['items'][0]['after']['config']['audio_url'] = $url;
        $this->pack['items'][0]['after']['config']['audio_generation']['file_sha256'] = $hash;
        $this->rehash();
        $this->runRelease(true, 1);
        $this->pack = $valid;
        $hash = str_repeat('b', 64);
        $this->pack['items'][0]['file_sha256'] = $hash;
        $this->pack['items'][0]['after']['config']['audio_url'] = '/audio/course/listening/prior-audio-release/'.$hash.'.mp3';
        $this->pack['items'][0]['after']['config']['audio_generation']['file_sha256'] = $hash;
        $this->rehash();
        $this->runRelease(true, 1);
        $this->assertBefore();
    }

    public function test_database_failure_rolls_back_all_updates_but_keeps_full_recovery_archive(): void
    {
        DB::unprepared("CREATE TRIGGER reject_last_revision BEFORE UPDATE ON lesson_block_variants WHEN NEW.id = 10189 BEGIN SELECT RAISE(ABORT, 'simulated failure'); END");
        $state = DB::table('lesson_block_variants')->orderBy('id')->get()->toJson();
        $this->runRelease(true, 1);
        $this->assertSame($state, DB::table('lesson_block_variants')->orderBy('id')->get()->toJson());
        $this->assertCount(1, $this->backups());
        $backup = json_decode(File::get($this->backups()[0]));
        $this->assertCount(190, $backup->items);
        $this->assertSame($this->before[10189]['title'], $backup->items[189]->before->title);
    }

    public function test_audio_symlink_cannot_escape_the_listening_root(): void
    {
        $outside = $this->temporaryBase.'/outside-audio';
        File::ensureDirectoryExists($outside);
        $hash = hash('sha256', $this->audioBytes);
        File::put($outside.'/'.$hash.'.mp3', $this->audioBytes);
        $link = base_path('frontend/public/audio/course/listening/external-link');
        if (! @symlink($outside, $link)) {
            $this->markTestSkipped('This host does not permit creating directory symlinks.');
        }
        $this->pack['items'][0]['after']['config']['audio_url'] = '/audio/course/listening/external-link/'.$hash.'.mp3';
        $this->rehash();
        $this->runRelease(true, 1);
        $this->assertBefore();
    }

    public function test_failed_backup_prevents_every_database_update(): void
    {
        File::ensureDirectoryExists(storage_path('app/private/course'));
        File::put(storage_path('app/private/course/listening-revision-backups'), 'occupied-by-file');
        $this->runRelease(true, 1);
        $this->assertBefore();
    }

    public function test_already_applied_entry_is_archived_alongside_pending_entries(): void
    {
        $first = $this->pack['items'][0]['after'];
        DB::table('lesson_block_variants')->where('id', 10000)->update(['title' => $first['title'], 'config' => json_encode($first['config'])]);
        $this->runRelease(true, 0);
        $backup = json_decode(File::get($this->backups()[0]));
        $this->assertCount(190, $backup->items);
        $this->assertTrue($backup->items[0]->already_applied);
        $this->assertSame(PublishCourseListeningRevision::fingerprint($first), $backup->items[0]->before_sha256);
        $this->assertFalse($backup->items[1]->already_applied);
    }

    public function test_changed_ownership_and_extra_variants_are_rejected(): void
    {
        DB::table('lesson_pages')->where('id', 1800)->update(['learn_lang' => 'en']);
        $this->protectedRows = $this->protectedState();
        $this->runRelease(true, 1);
        DB::table('lesson_pages')->where('id', 1800)->update(['learn_lang' => 'lv']);
        $row = (array) DB::table('lesson_block_variants')->where('id', 10189)->first();
        $row['id'] = 20000;
        $row['seed_key'] = 'variant:6';
        DB::table('lesson_block_variants')->insert($row);
        $this->protectedRows = $this->protectedState();
        $state = DB::table('lesson_block_variants')->orderBy('id')->get()->toJson();
        $this->runRelease(true, 1);
        $this->assertSame($state, DB::table('lesson_block_variants')->orderBy('id')->get()->toJson());
        $this->assertCount(0, $this->backups());
    }

    public function test_canonical_json_matches_js_for_objects_arrays_unicode_and_number_notation(): void
    {
        $value = json_decode('{"z":{},"a":[],"numbers":[-0.0,1.0,1e-7,1e-6,1e20,1e21],"keys":{"10":"ten","2":"two","01":"one"}}');
        $expected = '{"a":[],"keys":{"2":"two","10":"ten","01":"one"},"numbers":[0,1,1e-7,0.000001,100000000000000000000,1e+21],"z":{}}';
        $this->assertSame($expected, PublishCourseListeningRevision::canonicalJson($value));
        $this->assertSame(hash('sha256', $expected), PublishCourseListeningRevision::fingerprint($value));
        $this->assertNotSame(PublishCourseListeningRevision::fingerprint((object) []), PublishCourseListeningRevision::fingerprint([]));
        $this->assertSame('"'."\u{2028}".'"', PublishCourseListeningRevision::canonicalJson("\u{2028}"));
    }
}
