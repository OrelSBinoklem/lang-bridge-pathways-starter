<?php

namespace Tests\Feature;

use App\Models\{CourseExam, ExamVariant, ExamVariantArchive};
use App\Services\Exams\{ExamAudioInspection, ExamAudioRecipe, ExamDefinition, ExamRevision};
use Illuminate\Support\Facades\{File, Http, Schema, Storage};
use Tests\TestCase;

class ExamAudioRevisionTest extends TestCase
{
    private string $directory;
    private array $markers = [];

    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        Storage::fake('local');
        Schema::create('users', fn ($t) => $t->id());
        (require database_path('migrations/2026_09_26_000001_create_course_exams.php'))->up();
        (require database_path('migrations/2026_10_03_000001_create_exam_variant_archives.php'))->up();
        $this->directory = base_path('.tmp/exam-audio-revision-tests/'.bin2hex(random_bytes(8)));
        File::ensureDirectoryExists($this->directory);
        config(['services.elevenlabs.exam_audio_workspace' => $this->directory]);
        File::partialMock()->shouldReceive('get')->with(base_path('tools/tutor-gateway/.env'))->andReturn("ELEVENLABS_API_KEY=fake-test-key\n");
        File::shouldReceive('exists')->with(base_path('tools/tutor-gateway/.env'))->andReturn(true);
    }

    protected function tearDown(): void
    {
        foreach ($this->markers as $path) if (is_file($path)) unlink($path);
        File::deleteDirectory($this->directory);
        parent::tearDown();
    }

    private function fixture(): array
    {
        $content = (require resource_path('course/exams/a2.php'))[0];
        $exam = CourseExam::create(['level' => 'A2', 'learn_lang' => 'lv', 'title' => 'A2']);
        $variant = ExamVariant::create(['course_exam_id' => $exam->id, 'position' => 1, 'title' => 'Fixture', 'content' => $content]);
        $section = $content['sections'][0];
        foreach ($section['tasks'] as $i => &$task) {
            unset($task['audio_path'], $task['audio_seconds']);
            $text = 'Labdien! Šodien sākam darbu. '.basename($this->directory).' '.$i;
            $task['segments'] = [['speaker' => 'male', 'text' => $text, 'delivery' => 'calm']];
            $task['transcript'] = $text;
            $recipe = app(ExamAudioRecipe::class)->build('A2', $task);
            $this->markers[] = $this->directory.'/'.$recipe['sha256'].'.request.json';
        }
        unset($task);
        $pack = ['revision' => 'Fixture', 'variants' => [['level' => 'A2', 'position' => 1,
            'expected_sha256' => app(ExamRevision::class)->contentHash($content), 'replace_sections' => ['listening' => $section]]]];
        $path = $this->directory.'/source.json';
        File::put($path, json_encode($pack, JSON_THROW_ON_ERROR));
        return [$path, $pack, $variant];
    }

    private function providers(int $credits = 100000): void
    {
        Http::fake([
            'api.elevenlabs.io/v1/user/subscription' => Http::response(['character_count' => 0, 'character_limit' => $credits]),
            'api.elevenlabs.io/v1/voices/*' => fn ($request) => Http::response(['voice_id' => basename($request->url())]),
            'api.elevenlabs.io/v1/text-to-dialogue*' => Http::response(str_repeat('audio-fixture-', 100), 200, ['Content-Type' => 'audio/mpeg']),
        ]);
        $mock = \Mockery::mock(ExamAudioInspection::class)->makePartial();
        $mock->shouldReceive('preflight')->andReturnNull();
        $mock->shouldReceive('inspect')->andReturn(20.0);
        $this->app->instance(ExamAudioInspection::class, $mock);
    }

    private function generationOptions(string $path): array
    {
        return ['pack' => $path, '--generate' => true, '--max-characters' => 10000, '--output' => $this->directory.'/ready.json'];
    }

    public function test_dry_run_does_not_call_provider_or_write_audio_output_or_database(): void
    {
        [$path, , $variant] = $this->fixture();
        $before = $variant->fresh()->getAttributes();
        $this->artisan('exams:voice-revision', ['pack' => $path])->assertSuccessful();
        $this->assertSame($before, $variant->fresh()->getAttributes());
        $this->assertSame([], Storage::disk('local')->allFiles());
        $this->assertFileDoesNotExist($this->directory.'/ready.json');
        $this->assertSame(0, ExamVariantArchive::count());
        Http::assertNothingSent();
    }

    public function test_budget_conflict_and_unsupported_voice_stop_before_provider_calls(): void
    {
        [$path, $pack, $variant] = $this->fixture();
        $this->artisan('exams:voice-revision', array_replace($this->generationOptions($path), ['--max-characters' => 1]))->assertFailed();
        $pack['variants'][0]['expected_sha256'] = str_repeat('0', 64);
        File::put($path, json_encode($pack));
        $this->artisan('exams:voice-revision', $this->generationOptions($path))->assertFailed();
        $pack['variants'][0]['expected_sha256'] = app(ExamRevision::class)->contentHash($variant->content);
        $pack['variants'][0]['replace_sections']['listening']['tasks'][0]['segments'][0]['voice_key'] = 'latvian-male-design-2';
        File::put($path, json_encode($pack));
        $this->artisan('exams:voice-revision', $this->generationOptions($path))->assertFailed();
        Http::assertNothingSent();
    }

    public function test_credit_and_missing_voice_preflight_never_generate_audio(): void
    {
        [$path] = $this->fixture();
        $this->providers(1);
        $this->artisan('exams:voice-revision', $this->generationOptions($path))->assertFailed();
        Http::assertNotSent(fn ($r) => $r->method() === 'POST');
        $this->providers();
        Http::fake(['api.elevenlabs.io/v1/user/subscription' => Http::response(['character_count' => 0, 'character_limit' => 100000]),
            'api.elevenlabs.io/v1/voices/*' => Http::response([], 404)]);
        $this->artisan('exams:voice-revision', $this->generationOptions($path))->assertFailed();
        Http::assertNotSent(fn ($r) => $r->method() === 'POST');
    }

    public function test_generation_prepares_separate_revision_and_resumes_from_cache_without_db_changes(): void
    {
        [$path, $pack, $variant] = $this->fixture();
        $before = $variant->fresh()->getAttributes();
        $this->providers();
        $this->artisan('exams:voice-revision', $this->generationOptions($path))->assertSuccessful();
        Http::assertSentCount(5);
        Http::assertSent(fn ($r) => $r->method() === 'POST' && $r['inputs'][0]['voice_id'] === 'fNhRyRrsnIya9NeKBmZ9' && str_starts_with($r['inputs'][0]['text'], '[calm] '));
        $ready = json_decode(File::get($this->directory.'/ready.json'), true);
        $this->assertSame($pack['variants'][0]['expected_sha256'], $ready['variants'][0]['expected_sha256']);
        foreach ($ready['variants'][0]['replace_sections']['listening']['tasks'] as $task) {
            $this->assertSame(2, $task['audio_generation']['version']);
            $this->assertSame(20, $task['audio_seconds']);
            Storage::disk('local')->assertExists($task['audio_path']);
        }
        Http::fake();
        $this->artisan('exams:voice-revision', $this->generationOptions($path))->assertSuccessful();
        Http::assertNothingSent();
        $this->assertSame($before, $variant->fresh()->getAttributes());
        $this->assertSame(0, ExamVariantArchive::count());
        $this->assertSame($pack, json_decode(File::get($path), true));
    }

    public function test_failed_paid_request_is_not_automatically_retried_in_this_or_later_run(): void
    {
        [$path] = $this->fixture();
        $this->providers();
        Http::fake(['api.elevenlabs.io/v1/user/subscription' => Http::response(['character_count' => 0, 'character_limit' => 100000]),
            'api.elevenlabs.io/v1/voices/*' => fn ($r) => Http::response(['voice_id' => basename($r->url())]),
            'api.elevenlabs.io/v1/text-to-dialogue*' => Http::failedConnection('Synthetic failure')]);
        $this->artisan('exams:voice-revision', $this->generationOptions($path))->assertFailed();
        Http::fake();
        $this->artisan('exams:voice-revision', $this->generationOptions($path))->assertFailed();
        Http::assertNothingSent();
        $this->assertFileDoesNotExist($this->directory.'/ready.json');
    }

    public function test_stale_audio_recipe_is_rejected_for_publication(): void
    {
        [$path, $pack, $variant] = $this->fixture();
        $content = $variant->content;
        $content['sections'][0] = $pack['variants'][0]['replace_sections']['listening'];
        foreach ($content['sections'][0]['tasks'] as &$task) {
            $recipe = app(ExamAudioRecipe::class)->build('A2', $task);
            $task['audio_path'] = $recipe['path'];
            $task['audio_seconds'] = 20;
            $task['audio_generation'] = ['version' => 2, 'sha256' => $recipe['sha256']];
            Storage::disk('local')->put($recipe['path'], 'test');
            // This unit fixture represents a trusted inspection, not a real MP3 decode.
            app(ExamAudioInspection::class)->receipt($recipe['path'], 20);
        }
        unset($task);
        app(ExamDefinition::class)->validate($content, true);
        $content['sections'][0]['tasks'][0]['segments'][0]['delivery'] = 'friendly';
        $this->expectException(\Illuminate\Validation\ValidationException::class);
        app(ExamDefinition::class)->validate($content, true);
    }

    public function test_transcript_tags_gender_and_preview_only_voices_are_rejected(): void
    {
        $base = ['segments' => [['speaker' => 'male', 'text' => 'Labdien!']], 'transcript' => 'Labdien!'];
        foreach ([['speaker' => 'male', 'text' => '[happy] Labdien!'],
            ['speaker' => 'male', 'text' => 'Labdien!', 'voice_key' => 'latvian-female-warm-2'],
            ['speaker' => 'male', 'text' => 'Labdien!', 'voice_key' => 'latvian-male-design-b-3']] as $segment) {
            try { app(ExamAudioRecipe::class)->build('A2', array_replace($base, ['segments' => [$segment]])); $this->fail('Invalid recipe accepted.'); }
            catch (\InvalidArgumentException) { $this->assertTrue(true); }
        }
        $this->expectException(\InvalidArgumentException::class);
        app(ExamAudioRecipe::class)->build('A2', array_replace($base, ['transcript' => 'Other text']));
    }

    public function test_slow_pace_changes_request_and_cache_but_not_transcript(): void
    {
        $base = ['segments' => [['speaker' => 'male', 'text' => 'Labdien!', 'delivery' => 'calm']], 'transcript' => 'Labdien!'];
        $normal = app(ExamAudioRecipe::class)->build('A2', $base);
        $base['segments'][0]['pace'] = 'slow';
        $slow = app(ExamAudioRecipe::class)->build('A2', $base);
        $this->assertSame('[slowly] [calm] Labdien!', $slow['request']['inputs'][0]['text']);
        $this->assertSame('Labdien!', $slow['segments'][0]['text']);
        $this->assertNotSame($normal['sha256'], $slow['sha256']);
        $this->assertNotSame($normal['path'], $slow['path']);
        $this->assertSame('slow', $slow['segments'][0]['pace']);
        $base['segments'][0]['pace'] = 'unsupported';
        $this->expectException(\InvalidArgumentException::class);
        app(ExamAudioRecipe::class)->build('A2', $base);
    }

    public function test_corrupt_cached_audio_stops_before_any_provider_request(): void
    {
        [$path, $pack] = $this->fixture();
        $recipe = app(ExamAudioRecipe::class)->build('A2', $pack['variants'][0]['replace_sections']['listening']['tasks'][0]);
        Storage::disk('local')->put($recipe['path'], 'corrupt fixture');
        $mock = \Mockery::mock(ExamAudioInspection::class);
        $mock->shouldReceive('preflight')->once()->andReturnNull();
        $mock->shouldReceive('inspect')->once()->andThrow(new \RuntimeException('Corrupt fixture.'));
        $this->app->instance(ExamAudioInspection::class, $mock);
        $this->artisan('exams:voice-revision', $this->generationOptions($path))->assertFailed();
        Http::assertNothingSent();
    }

    public function test_non_listening_scope_and_output_outside_tmp_are_rejected_without_provider(): void
    {
        [$path, $pack, $variant] = $this->fixture();
        $pack['variants'][0]['replace_sections']['reading'] = $variant->content['sections'][1];
        File::put($path, json_encode($pack));
        $this->artisan('exams:voice-revision', $this->generationOptions($path))->assertFailed();
        unset($pack['variants'][0]['replace_sections']['reading']);
        File::put($path, json_encode($pack));
        $this->artisan('exams:voice-revision', array_replace($this->generationOptions($path), ['--output' => base_path('should-not-exist.json')]))->assertFailed();
        $this->assertFileDoesNotExist(base_path('should-not-exist.json'));
        Http::assertNothingSent();
    }

    public function test_receipt_blocks_missing_or_changed_bytes_and_duration(): void
    {
        $service = app(ExamAudioInspection::class);
        $path = 'exams/shared/v2/fixture.mp3';
        Storage::disk('local')->put($path, 'synthetic inspected fixture');
        try { $service->verifyReceipt($path, 20); $this->fail('Missing receipt accepted.'); }
        catch (\RuntimeException) { $this->assertTrue(true); }
        $service->receipt($path, 20);
        $service->verifyReceipt($path, 20);
        try { $service->verifyReceipt($path, 25); $this->fail('Changed duration accepted.'); }
        catch (\RuntimeException) { $this->assertTrue(true); }
        Storage::disk('local')->put($path, 'different bytes');
        $this->expectException(\RuntimeException::class);
        $service->verifyReceipt($path, 20);
    }

    public function test_workspace_dot_segments_cannot_escape_tmp_even_with_safe_output(): void
    {
        [$path] = $this->fixture();
        config(['services.elevenlabs.exam_audio_workspace' => $this->directory.'/../../..']);
        $this->artisan('exams:voice-revision', $this->generationOptions($path))
            ->expectsOutputToContain('Audio workspace must stay inside repository .tmp.')->assertFailed();
        Http::assertNothingSent();
        $this->assertSame([], Storage::disk('local')->allFiles());
        $this->assertFileDoesNotExist($this->directory.'/ready.json');
    }

    public function test_workspace_link_outside_tmp_is_rejected_even_with_safe_output(): void
    {
        [$path] = $this->fixture();
        $link = $this->directory.'/workspace-link';
        try {
            // Laravel uses a directory junction on Windows and a symlink elsewhere.
            @File::link(base_path(), $link);
            if (!is_dir($link) || realpath($link) !== realpath(base_path())) {
                $this->markTestSkipped('Directory symlink/junction creation is unavailable.');
            }
            config(['services.elevenlabs.exam_audio_workspace' => $link]);
            $this->artisan('exams:voice-revision', $this->generationOptions($path))
                ->expectsOutputToContain('Audio workspace must stay inside repository .tmp.')->assertFailed();
            Http::assertNothingSent();
            $this->assertSame([], Storage::disk('local')->allFiles());
            $this->assertFileDoesNotExist($this->directory.'/ready.json');
        } finally {
            // Remove only the link itself before recursive fixture cleanup.
            if (is_link($link) || is_dir($link)) {
                $this->assertTrue(PHP_OS_FAMILY === 'Windows' ? rmdir($link) : unlink($link));
            }
        }
    }

    public function test_non_numeric_or_excessive_audio_duration_is_rejected_before_receipt(): void
    {
        [, $pack, $variant] = $this->fixture();
        $content = $variant->content;
        $content['sections'][0] = $pack['variants'][0]['replace_sections']['listening'];
        $task = &$content['sections'][0]['tasks'][0];
        $recipe = app(ExamAudioRecipe::class)->build('A2', $task);
        $task['audio_path'] = $recipe['path'];
        Storage::disk('local')->put($recipe['path'], 'fixture');
        foreach (['not-a-duration', 'INF', '20x', null, 0, -1, 7201, INF, NAN] as $duration) {
            $task['audio_seconds'] = $duration;
            try { app(ExamDefinition::class)->validate($content, true); $this->fail('Invalid duration accepted.'); }
            catch (\Illuminate\Validation\ValidationException) { $this->assertTrue(true); }
        }
    }

    public function test_identical_speech_shares_private_cache_across_levels(): void
    {
        $task = ['segments' => [['speaker' => 'male', 'text' => 'Labdien!']], 'transcript' => 'Labdien!'];
        $this->assertSame(app(ExamAudioRecipe::class)->build('A2', $task), app(ExamAudioRecipe::class)->build('B1', $task));
    }

    public function test_filesystem_lock_stops_generation_even_when_cache_driver_is_array(): void
    {
        [$path] = $this->fixture();
        $directory = $this->directory;
        File::ensureDirectoryExists($directory);
        $lock = fopen($directory.'/generation.lock', 'c');
        $this->assertTrue(flock($lock, LOCK_EX | LOCK_NB));
        try {
            $this->artisan('exams:voice-revision', $this->generationOptions($path))->assertFailed();
            Http::assertNothingSent();
        } finally { flock($lock, LOCK_UN); fclose($lock); }
    }

    public function test_filament_save_preserves_new_audio_metadata_casting_and_content_level(): void
    {
        \Illuminate\Support\Facades\DB::table('users')->insert(['id' => 1]);
        [, , $variant] = $this->fixture();
        $content = $variant->content;
        $content['sections'][0]['tasks'][0]['audio_generation'] = ['version' => 2, 'sha256' => str_repeat('a', 64)];
        $content['sections'][0]['tasks'][0]['segments'][0]['voice_key'] = 'latvian-male-design-1';
        $content['sections'][0]['tasks'][0]['segments'][0]['delivery'] = 'calm';
        $content['sections'][0]['tasks'][0]['segments'][0]['pace'] = 'slow';
        $variant->update(['content' => $content]);
        $user = \Mockery::mock(\App\Models\User::class)->makePartial();
        $user->id = 1;
        $user->shouldReceive('isFrontendAdmin')->andReturn(true);
        $user->shouldReceive('hasRole')->andReturn(true);
        $user->shouldReceive('getRoleNames')->andReturn(collect(['admin']));
        $this->actingAs($user);
        \Filament\Facades\Filament::setCurrentPanel(\Filament\Facades\Filament::getPanel('admin'));
        \Livewire\Livewire::test(\App\Filament\Resources\Exams\Pages\EditExamVariant::class, ['record' => (string) $variant->id])
            ->fillForm(['title' => 'Edited fixture'])->call('save')->assertHasNoFormErrors();
        $saved = $variant->fresh()->content;
        $this->assertSame('A2', $saved['level']);
        $this->assertSame($content['sections'][0]['tasks'][0]['audio_generation'], $saved['sections'][0]['tasks'][0]['audio_generation']);
        $this->assertSame('latvian-male-design-1', $saved['sections'][0]['tasks'][0]['segments'][0]['voice_key']);
        $this->assertSame('calm', $saved['sections'][0]['tasks'][0]['segments'][0]['delivery']);
        $this->assertSame('slow', $saved['sections'][0]['tasks'][0]['segments'][0]['pace']);
        Http::assertNothingSent();
    }
}
