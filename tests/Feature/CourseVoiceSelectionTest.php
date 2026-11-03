<?php

namespace Tests\Feature;

use App\Console\Commands\GenerateCourseListeningAudio;
use App\Models\LessonBlock;
use App\Models\LessonBlockVariant;
use App\Models\LessonPage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CourseVoiceSelectionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('course_groups', function ($table) {
            $table->id();
            $table->integer('category_id');
        });
        (require database_path('migrations/2026_09_11_000002_create_lesson_pages_table.php'))->up();
        (require database_path('migrations/2026_09_11_000003_create_lesson_blocks_table.php'))->up();
        (require database_path('migrations/2026_09_22_000001_add_course_skill_lesson_framework.php'))->up();
        File::partialMock()->shouldReceive('exists')->with(base_path('tools/tutor-gateway/.env'))->andReturn(true);
        File::shouldReceive('get')->with(base_path('tools/tutor-gateway/.env'))->andReturn(
            "ELEVENLABS_API_KEY=fake-test-key\nELEVENLABS_DIALOGUE_VOICE_A_ID=legacy-male\nELEVENLABS_DIALOGUE_VOICE_B_ID=test-female"
        );
        Http::fake(['api.elevenlabs.io/*' => Http::response([], 503)]);
    }

    private function variant(bool $hasAudio = false, bool $generated = true): LessonBlockVariant
    {
        DB::table('course_groups')->insert(['id' => 1, 'category_id' => 1763]);
        $page = LessonPage::create(['slug' => 'voice-test', 'title' => 'Voice test', 'course_group_id' => 1, 'skill' => 'listening']);
        $block = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'listening']);
        $config = ['task_kind' => 'listening', 'dialogue_segments' => [
            ['speaker' => 'a', 'text' => 'Labdien!'],
            ['speaker' => 'b', 'text' => 'Prieks iepazīties!'],
        ]];
        if ($hasAudio) $config['audio_url'] = '/audio/existing.mp3';
        if ($hasAudio && $generated) $config['audio_generation'] = ['sha256' => 'legacy-hash', 'voice_ids' => ['a' => 'legacy-male', 'b' => 'test-female']];
        return LessonBlockVariant::create(['lesson_block_id' => $block->id, 'position' => 1, 'title' => 'Test', 'config' => $config]);
    }

    public function test_selected_toms_overrides_legacy_male_environment_and_preserves_female(): void
    {
        $settings = (new \ReflectionMethod(GenerateCourseListeningAudio::class, 'settings'))->invoke(new GenerateCourseListeningAudio);
        $this->assertSame('fNhRyRrsnIya9NeKBmZ9', $settings['voice_a']);
        $this->assertSame('test-female', $settings['voice_b']);
        $catalog = json_decode(file_get_contents(resource_path('course/voice-previews/shortlist.json')), true, 512, JSON_THROW_ON_ERROR);
        $candidates = collect($catalog['candidates'])->keyBy('key');
        $this->assertSame('latvian-male-ref1-1', $catalog['defaults']['male_playful']);
        $this->assertSame(18, $candidates['latvian-male-design-b-3']['perceived_age_years']);
        $this->assertSame('owner', $candidates['latvian-male-design-b-3']['assessment_source']);
        $this->assertArrayNotHasKey('voice_id', $candidates['latvian-male-design-b-3']);
        Http::assertNothingSent();
    }

    public function test_existing_audio_is_not_regenerated_after_default_changes(): void
    {
        $variant = $this->variant(true);
        $before = $variant->config;
        $this->artisan('course:generate-listening-audio', ['--generate' => true])->assertExitCode(0);
        $this->assertSame($before, $variant->fresh()->config);
        Http::assertNothingSent();
    }

    public function test_explicit_regeneration_still_checks_budget_before_requests(): void
    {
        $variant = $this->variant(true);
        $before = $variant->config;
        $this->artisan('course:generate-listening-audio', ['--generate' => true, '--regenerate' => true, '--max-characters' => 1])->assertExitCode(1);
        $this->assertSame($before, $variant->fresh()->config);
        Http::assertNothingSent();
    }

    public function test_editor_audio_is_preserved_even_with_regeneration_requested(): void
    {
        $variant = $this->variant(true, false);
        $before = $variant->config;
        $this->artisan('course:generate-listening-audio', ['--generate' => true, '--regenerate' => true])->assertExitCode(0);
        $this->assertSame($before, $variant->fresh()->config);
        Http::assertNothingSent();
    }

    public function test_new_audio_uses_toms_and_allows_explicit_casting_override(): void
    {
        $variant = $this->variant();
        foreach ([[], ['--voice-a' => 'playful-male']] as $options) {
            $this->artisan('course:generate-listening-audio', ['--generate' => true, ...$options])->assertExitCode(1);
            Http::assertSent(fn ($request) => $request['inputs'][0]['voice_id'] === ($options['--voice-a'] ?? 'fNhRyRrsnIya9NeKBmZ9'));
        }
        $this->assertArrayNotHasKey('audio_url', $variant->fresh()->config);
    }

    public function test_swapped_genders_and_same_gender_pairs_are_cast_by_profile(): void
    {
        $variant = $this->variant();
        foreach ([['female', 'male', 'test-female', 'fNhRyRrsnIya9NeKBmZ9'],
            ['male', 'male', 'fNhRyRrsnIya9NeKBmZ9', 'SqGJaEOnW97EMDTsC4pw'],
            ['female', 'female', 'test-female', '30eSufz0JUezhBQBmpD7']] as [$a, $b, $voiceA, $voiceB]) {
            Http::fake(['api.elevenlabs.io/*' => Http::response([], 503)]);
            $variant->update(['config' => [...$variant->config, 'speaker_profiles' => ['a' => ['gender' => $a], 'b' => ['gender' => $b]]]]);
            $this->artisan('course:generate-listening-audio', ['--generate' => true])->assertExitCode(1);
            Http::assertSent(fn ($request) => $request['inputs'][0]['voice_id'] === $voiceA && $request['inputs'][1]['voice_id'] === $voiceB);
        }
        $this->assertArrayNotHasKey('audio_url', $variant->fresh()->config);
    }

    public function test_preview_only_wrong_gender_and_incomplete_profiles_stop_before_paid_request(): void
    {
        $variant = $this->variant();
        foreach ([['a' => ['gender' => 'male', 'voice_key' => 'latvian-male-design-2'], 'b' => ['gender' => 'female']],
            ['a' => ['gender' => 'female', 'voice_key' => 'latvian-male-design-1'], 'b' => ['gender' => 'male']],
            ['a' => ['gender' => 'female']]] as $profiles) {
            $variant->update(['config' => [...$variant->config, 'speaker_profiles' => $profiles]]);
            $this->artisan('course:generate-listening-audio', ['--generate' => true])->assertExitCode(1);
            Http::assertNothingSent();
        }
    }

    public function test_explicit_voice_key_and_cli_override_are_preserved_for_authored_roles(): void
    {
        $variant = $this->variant();
        $variant->update(['config' => [...$variant->config, 'speaker_profiles' => [
            'a' => ['gender' => 'male', 'voice_key' => 'latvian-male-ref1-1'], 'b' => ['gender' => 'female']]]]);
        $this->artisan('course:generate-listening-audio', ['--generate' => true])->assertExitCode(1);
        Http::assertSent(fn ($request) => $request['inputs'][0]['voice_id'] === 'SqGJaEOnW97EMDTsC4pw');
        Http::fake(['api.elevenlabs.io/*' => Http::response([], 503)]);
        $this->artisan('course:generate-listening-audio', ['--generate' => true, '--voice-a' => 'owner-selected'])->assertExitCode(1);
        Http::assertSent(fn ($request) => $request['inputs'][0]['voice_id'] === 'owner-selected');
    }

    public function test_connection_failure_stops_without_retry_or_progress_changes(): void
    {
        $variant = $this->variant();
        Http::fake(fn () => throw new \Illuminate\Http\Client\ConnectionException('test connection failure'));
        $before = $variant->config;
        $this->artisan('course:generate-listening-audio', ['--generate' => true])
            ->expectsOutputToContain('результат списания неизвестен')->assertExitCode(1);
        $this->assertSame($before, $variant->fresh()->config);
    }

    public function test_quota_exhaustion_stops_remaining_files_and_notifies_owner(): void
    {
        $variant = $this->variant();
        $other = $variant->replicate();
        $other->position = 2;
        $other->save();
        Http::swap(new \Illuminate\Http\Client\Factory);
        Http::fake(['api.elevenlabs.io/*' => Http::response(['detail' => ['status' => 'quota_exceeded']], 401)]);
        $this->assertSame(1, \Illuminate\Support\Facades\Artisan::call('course:generate-listening-audio', ['--generate' => true]));
        $this->assertStringContainsString('Лимит ElevenLabs исчерпан', \Illuminate\Support\Facades\Artisan::output());
        Http::assertSentCount(1);
        $this->assertArrayNotHasKey('audio_url', $variant->fresh()->config);
        $this->assertArrayNotHasKey('audio_url', $other->fresh()->config);
    }
}
