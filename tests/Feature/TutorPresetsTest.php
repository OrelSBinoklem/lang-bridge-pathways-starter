<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Tutor\TutorPresets;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TutorPresetsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('app_settings', function ($t) { $t->string('key')->primary(); $t->text('value'); $t->timestamps(); });
    }

    private function payload(): array
    {
        return ['config' => array_merge(app(TutorPresets::class)->all()['economy']['config'], [
            'primaryTranscriptionLanguage' => '', 'secondaryTranscriptionModel' => 'gpt-4o-transcribe', 'secondaryTranscriptionLanguage' => 'lv',
            'ttsModel' => 'gemini-3.8-flash-tts', 'ttsVoice' => 'Enceladus', 'ttsStartMode' => 'first_sentence',
            'contextSummaryModel' => 'gpt-5.6-luna', 'messageEmbeddingModel' => 'text-embedding-3-small', 'summaryEmbeddingModel' => 'text-embedding-3-small',
            'tutorPipeline' => 'stt_text_tts', 'liveTranscriptionModel' => '', 'liveDelay' => 'medium', 'voiceModel' => 'gpt-realtime-2.1',
        ]), 'scenario' => ['dialogueActs' => '30', 'memorySearchesPerHour' => '3'], 'loadedScenario' => ['dialogueActs' => '60']];
    }

    private function actor(bool $admin): User
    {
        $user = \Mockery::mock(User::class)->makePartial();
        $user->forceFill(['id' => 101, 'name' => 'Fixture', 'email' => 'fixture@example.test']);
        $user->shouldReceive('isFrontendAdmin')->andReturn($admin);
        return $user;
    }

    public function test_public_can_view_four_presets_and_commission_without_private_data(): void
    {
        $data = $this->getJson('/api/tutor/presets')->assertOk()->json('data');
        $this->assertSame(TutorPresets::IDS, array_keys($data['presets']));
        $this->assertEquals(50, $data['commission_percent']);
        $this->assertSame('api', $data['presets']['economy']['config']['ttsMode']);
        $this->assertSame('gemini-3.8-flash-lite-tts', $data['presets']['economy']['config']['ttsModel']);
        foreach (['economy', 'standard'] as $id) {
            $this->assertSame('gpt-6-luna', $data['presets'][$id]['config']['tutorModel']);
            $this->assertSame('gpt-transcribe', $data['presets'][$id]['config']['transcriptionModel']);
            $this->assertFalse($data['presets'][$id]['config']['dualTranscriptionEnabled']);
        }
        $this->assertSame('gpt-6-sol', $data['presets']['uncompromising']['config']['tutorModel']);
        $this->assertFalse($data['presets']['uncompromising']['config']['reasoningEnabled']);
        $this->assertSame('none', $data['presets']['uncompromising']['config']['reasoningEffort']);
        $this->assertSame('gpt-6.1-terra', $data['presets']['quality']['config']['tutorModel']);
        foreach ($data['presets'] as $preset) $this->assertTrue($preset['config']['contextCompressionEnabled']);
        $this->assertArrayNotHasKey('user_id', $data);
    }

    public function test_quality_copies_saved_maximum_and_remains_independent_when_maximum_is_edited(): void
    {
        $this->actingAs($this->actor(true));
        $payload = $this->payload();
        $payload['config']['tutorModel'] = 'gpt-6.1-terra';
        \App\Models\AppSetting::create(['key' => 'tutor_preset_uncompromising', 'value' => json_encode($payload)]);
        $before = app(TutorPresets::class)->all();
        $this->assertSame('gpt-6.1-terra', $before['quality']['config']['tutorModel']);
        $this->assertSame('gpt-6-sol', $before['uncompromising']['config']['tutorModel']);
        $this->assertSame($before['uncompromising']['scenario'], $before['quality']['scenario']);
        $payload['scenario']['dialogueActs'] = '45';
        $this->putJson('/api/tutor/presets/uncompromising', $payload)->assertOk();
        $after = app(TutorPresets::class)->all();
        $this->assertSame($before['quality'], $after['quality']);
        $this->assertSame('45', $after['uncompromising']['scenario']['dialogueActs']);
    }

    public function test_embeddings_default_to_large_but_can_be_changed_and_saved(): void
    {
        $payload = $this->payload();
        \App\Models\AppSetting::create(['key' => 'tutor_preset_standard', 'value' => json_encode($payload)]);
        $this->assertSame('text-embedding-3-large', app(TutorPresets::class)->all()['standard']['config']['messageEmbeddingModel']);
        $this->actingAs($this->actor(true))->putJson('/api/tutor/presets/standard', $payload)->assertOk()
            ->assertJsonPath('data.presets.standard.config.messageEmbeddingModel', 'text-embedding-3-small')
            ->assertJsonPath('data.presets.standard.config.summaryEmbeddingModel', 'text-embedding-3-small');
    }

    public function test_standard_scenario_defaults_apply_to_legacy_settings_but_new_edits_are_preserved(): void
    {
        $payload = $this->payload();
        \App\Models\AppSetting::create(['key' => 'tutor_preset_standard', 'value' => json_encode($payload)]);
        $scenario = app(TutorPresets::class)->all()['standard']['scenario'];
        $this->assertSame('120', $scenario['dialogueActs']);
        $this->assertSame('60', $scenario['userTokensPerAct']);
        $this->assertSame('120', $scenario['outputTokensPerCall']);
        $this->assertSame('60', app(TutorPresets::class)->all()['standard']['loadedScenario']['dialogueActs']);
        $payload['scenario']['dialogueActs'] = '75';
        $this->actingAs($this->actor(true))->putJson('/api/tutor/presets/standard', $payload)->assertOk()
            ->assertJsonPath('data.presets.standard.scenario.dialogueActs', '75');
    }

    public function test_user_and_guest_cannot_edit_presets_even_with_forged_admin_field(): void
    {
        $this->putJson('/api/tutor/presets/economy', $this->payload())->assertUnauthorized();
        $this->actingAs($this->actor(false))->putJson('/api/tutor/presets/economy', $this->payload() + ['is_admin' => true])->assertForbidden();
        $this->assertDatabaseCount('app_settings', 0);
    }

    public function test_admin_saves_each_preset_independently_with_both_scenarios(): void
    {
        $payload = $this->payload();
        $payload['config']['tutorModel'] = 'gpt-5.4-mini';
        $payload['config']['longMemoryEnabled'] = true;
        $payload['config']['forged'] = 'never-save';
        $this->actingAs($this->actor(true))->putJson('/api/tutor/presets/economy', $payload)->assertOk()
            ->assertJsonPath('data.presets.economy.config.tutorModel', 'gpt-5.4-mini')
            ->assertJsonPath('data.presets.economy.scenario.dialogueActs', '30')
            ->assertJsonPath('data.presets.economy.loadedScenario.dialogueActs', '60')
            ->assertJsonPath('data.presets.standard.config.tutorModel', 'gpt-6-luna');
        $saved = app(TutorPresets::class)->all()['economy']['config'];
        $this->assertTrue($saved['contextCompressionEnabled']);
        $this->assertArrayNotHasKey('forged', $saved);
        $this->assertDatabaseCount('app_settings', 1);
    }

    public function test_global_output_cap_is_validated_and_saved_for_only_the_selected_preset(): void
    {
        $this->actingAs($this->actor(true));
        $payload = $this->payload(); $payload['config']['maxOutputTokens'] = 2400;
        $this->putJson('/api/tutor/presets/economy', $payload)->assertOk()
            ->assertJsonPath('data.presets.economy.config.maxOutputTokens', 2400)
            ->assertJsonPath('data.presets.standard.config.maxOutputTokens', 8192);
        foreach ([699, 8193, 'forged'] as $bad) {
            $payload['config']['maxOutputTokens'] = $bad;
            $this->putJson('/api/tutor/presets/economy', $payload)->assertUnprocessable();
        }
        $this->assertSame(2400, app(TutorPresets::class)->all()['economy']['config']['maxOutputTokens']);
    }

    public function test_invalid_models_voice_pairs_and_scenarios_are_rejected_without_changes(): void
    {
        $this->actingAs($this->actor(true));
        $payload = $this->payload(); $payload['config']['tutorModel'] = 'unknown';
        $this->putJson('/api/tutor/presets/economy', $payload)->assertUnprocessable();
        $payload = $this->payload(); $payload['config']['ttsVoice'] = 'onyx';
        $this->putJson('/api/tutor/presets/economy', $payload)->assertUnprocessable();
        $payload = $this->payload(); $payload['scenario']['dialogueActs'] = -1;
        $this->putJson('/api/tutor/presets/economy', $payload)->assertUnprocessable();
        $this->assertDatabaseCount('app_settings', 0);
    }

    public function test_admin_can_save_terra61_without_reasoning_for_uncompromising(): void
    {
        $payload = $this->payload();
        $payload['config']['tutorModel'] = 'gpt-6.1-terra';
        $payload['config']['reasoningEnabled'] = false;
        $payload['config']['reasoningEffort'] = 'none';
        $this->actingAs($this->actor(true))->putJson('/api/tutor/presets/uncompromising', $payload)->assertOk()
            ->assertJsonPath('data.presets.uncompromising.config.tutorModel', 'gpt-6.1-terra')
            ->assertJsonPath('data.presets.uncompromising.config.reasoningEnabled', false)
            ->assertJsonPath('data.presets.uncompromising.config.reasoningEffort', 'none')
            ->assertJsonPath('data.presets.standard.config.tutorModel', 'gpt-6-luna');
    }
}
