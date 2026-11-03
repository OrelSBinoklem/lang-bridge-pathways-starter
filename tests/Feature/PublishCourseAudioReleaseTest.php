<?php

namespace Tests\Feature;

use App\Console\Commands\PublishCourseAudioRelease;
use Illuminate\Support\Facades\{DB, File, Schema};
use Tests\TestCase;

class PublishCourseAudioReleaseTest extends TestCase
{
    private string $originalBase;
    private string $temporaryBase;
    private array $config;
    private array $pack;

    protected function setUp(): void
    {
        parent::setUp();
        $this->app->make(\Illuminate\Contracts\Console\Kernel::class)->registerCommand(new PublishCourseAudioRelease);
        $this->originalBase = base_path();
        $this->temporaryBase = base_path('.tmp/audio-release-test-'.bin2hex(random_bytes(5)));
        File::ensureDirectoryExists($this->temporaryBase);
        $this->app->setBasePath($this->temporaryBase);
        $this->app->useStoragePath($this->temporaryBase.'/storage');
        Schema::create('course_groups', function ($t) { $t->id(); $t->integer('category_id'); });
        Schema::create('lesson_pages', function ($t) {
            $t->id(); $t->integer('course_group_id'); $t->string('slug'); $t->string('skill'); $t->string('learn_lang'); $t->string('level');
        });
        Schema::create('lesson_blocks', function ($t) {
            $t->id(); $t->integer('lesson_page_id'); $t->string('type'); $t->integer('position'); $t->integer('source_block_id')->nullable();
        });
        Schema::create('lesson_block_variants', function ($t) {
            $t->id(); $t->integer('lesson_block_id'); $t->string('seed_key'); $t->json('config'); $t->timestamps();
        });
        DB::table('course_groups')->insert(['id' => 40, 'category_id' => 1763]);
        DB::table('lesson_pages')->insert(['id' => 20, 'course_group_id' => 40, 'slug' => 'course-1763-listening', 'skill' => 'listening', 'learn_lang' => 'lv', 'level' => 'A1']);
        DB::table('lesson_blocks')->insert(['id' => 30, 'lesson_page_id' => 20, 'type' => 'listening', 'position' => 10]);
        $this->config = ['transcript' => 'Labdien!', 'questions' => [['answer' => 'a']], 'audio_url' => '/old.mp3', 'audio_generation' => ['provider' => 'elevenlabs']];
        DB::table('lesson_block_variants')->insert(['id' => 999, 'lesson_block_id' => 30, 'seed_key' => 'variant:1', 'config' => json_encode($this->config)]);
        $bytes = str_repeat('audio-fixture', 200);
        $hash = hash('sha256', $bytes);
        $url = '/audio/course/listening/test-release/'.$hash.'.mp3';
        File::ensureDirectoryExists(base_path('frontend/public/audio/course/listening/test-release'));
        File::put(base_path('frontend/public'.$url), $bytes);
        $this->pack = ['schema_version' => 1, 'scope' => 'course_listening', 'release' => 'test-release', 'items' => [[
            'category_id' => 1763, 'level' => 'A1', 'seed_key' => 'variant:1',
            'content_sha256' => PublishCourseAudioRelease::fingerprint(PublishCourseAudioRelease::content($this->config)),
            'previous_audio_sha256' => PublishCourseAudioRelease::fingerprint(array_intersect_key($this->config, array_flip(['audio_url', 'audio_generation']))),
            'audio_url' => $url, 'file_sha256' => $hash,
            'audio_generation' => ['provider' => 'google', 'model' => 'gemini-3.8-flash-tts', 'file_sha256' => $hash, 'post_processing_speed' => false],
        ]]];
    }

    protected function tearDown(): void
    {
        $this->app->setBasePath($this->originalBase);
        parent::tearDown();
    }

    private function runRelease(bool $write, int $code): void
    {
        $path = $this->temporaryBase.'/manifest.json';
        File::put($path, json_encode($this->pack));
        $this->artisan('course:publish-audio-release', ['manifest' => $path, '--write' => $write])->assertExitCode($code);
    }

    public function test_dry_run_write_and_repeat_preserve_content_and_backup(): void
    {
        $this->runRelease(false, 0);
        $this->assertSame($this->config, json_decode(DB::table('lesson_block_variants')->value('config'), true));
        $this->runRelease(true, 0);
        $after = json_decode(DB::table('lesson_block_variants')->value('config'), true);
        $this->assertSame(PublishCourseAudioRelease::content($this->config), PublishCourseAudioRelease::content($after));
        $this->assertSame($this->pack['items'][0]['audio_url'], $after['audio_url']);
        $this->runRelease(true, 0);
        $backups = File::glob(storage_path('app/private/course/audio-backups/*.json'));
        $this->assertCount(1, $backups);
        $this->assertSame('/old.mp3', json_decode(File::get($backups[0]), true)['items'][0]['before']['audio_url']);
    }

    public function test_editor_content_or_audio_changes_are_not_overwritten(): void
    {
        foreach (['transcript', 'audio_url'] as $field) {
            $edited = [...$this->config, $field => 'editor-change'];
            DB::table('lesson_block_variants')->update(['config' => json_encode($edited)]);
            $this->runRelease(true, 1);
            $this->assertSame($edited, json_decode(DB::table('lesson_block_variants')->value('config'), true));
        }
    }

    public function test_corrupt_file_and_duplicate_entries_abort_without_writes(): void
    {
        $entry = $this->pack['items'][0];
        $this->pack['items'][] = $entry;
        $this->runRelease(true, 1);
        $this->pack['items'] = [$entry];
        File::put(base_path('frontend/public'.$entry['audio_url']), 'corrupt');
        $this->runRelease(true, 1);
        $this->assertSame($this->config, json_decode(DB::table('lesson_block_variants')->value('config'), true));
    }
}
