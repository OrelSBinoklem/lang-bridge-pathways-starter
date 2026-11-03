<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\Tutor\{AiProfiles, AiTrace};
use App\Services\Credits\CreditContext;
use Illuminate\Support\Facades\{Http, Schema};
use Tests\TestCase;

class AiStudioTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        config(['credits.enabled' => false]);
        Schema::create('app_settings', function ($t) { $t->string('key')->primary(); $t->text('value'); $t->timestamps(); });
    }

    private function actor(bool $admin): User
    {
        $user = \Mockery::mock(User::class)->makePartial();
        $user->forceFill(['id' => 101, 'name' => 'Fixture', 'email' => 'fixture@example.test']);
        $user->shouldReceive('isFrontendAdmin')->andReturn($admin);
        return $user;
    }

    public function test_catalog_and_writes_are_admin_only_and_initial_read_does_not_save(): void
    {
        $this->getJson('/api/tutor/flows/bots')->assertUnauthorized();
        $this->actingAs($this->actor(false))->getJson('/api/tutor/flows/bots')->assertForbidden();
        $this->putJson('/api/tutor/flows/bots/examiner', [])->assertForbidden();
        $response = $this->actingAs($this->actor(true))->getJson('/api/tutor/flows/bots')->assertOk();
        $response->assertJsonPath('data.examiner.config.reasoning', 'medium')->assertJsonPath('data.examiner.config.maxOutputTokens', 14000);
        $this->assertCount(10, $response->json('data'));
        $this->assertDatabaseCount('app_settings', 0);
        $this->assertStringNotContainsString('api_key', $response->getContent());
    }

    public function test_defaults_leave_every_provider_body_identical_and_saved_roles_are_isolated(): void
    {
        $profiles = app(AiProfiles::class);
        $body = ['model' => 'gpt-5.4', 'reasoning' => ['effort' => 'medium'], 'store' => false,
            'input' => [['role' => 'developer', 'content' => 'Original'], ['role' => 'user', 'content' => 'student']],
            'text' => ['format' => ['strict' => true]], 'max_output_tokens' => 14000];
        foreach (array_keys($profiles->defaults()) as $id) $this->assertSame($body, $profiles->apply($id, $body));
        $original = $profiles->all()['examiner'];
        $config = array_replace($original['config'], ['model' => 'gpt-4.1', 'reasoning' => 'none', 'maxOutputTokens' => 900, 'prompts' => ['Level {{level}}. No invented errors.']]);
        $this->actingAs($this->actor(true))->putJson('/api/tutor/flows/bots/examiner', ['expected_revision' => $original['revision'], 'config' => $config])->assertOk();
        $changed = $profiles->apply('examiner', $body, ['level' => 'B2']);
        $this->assertSame('gpt-4.1', $changed['model']);
        $this->assertArrayNotHasKey('reasoning', $changed);
        $this->assertSame('Level B2. No invented errors.', $changed['input'][0]['content']);
        $this->assertSame($body['input'][1], $changed['input'][1]);
        $this->assertSame($body['text'], $changed['text']);
        $this->assertSame($body, $profiles->apply('translation', $body));
        $this->assertSame(900, $changed['max_output_tokens']);
        $this->putJson('/api/tutor/flows/bots/examiner', ['expected_revision' => $original['revision'], 'config' => $config])->assertConflict();
    }

    public function test_validation_rejects_unknown_fields_unavailable_efforts_and_stt_limits(): void
    {
        $this->actingAs($this->actor(true));
        $profile = app(AiProfiles::class)->all()['examiner'];
        $base = ['expected_revision' => $profile['revision'], 'config' => $profile['config']];
        $this->putJson('/api/tutor/flows/bots/examiner', $base + ['api_key' => 'must-not-store'])->assertUnprocessable();
        $invalid = $base; $invalid['config']['model'] = 'unknown';
        $this->putJson('/api/tutor/flows/bots/examiner', $invalid)->assertUnprocessable();
        $invalid = $base; $invalid['config']['model'] = 'gpt-6.1-sol'; $invalid['config']['reasoning'] = 'none';
        $this->putJson('/api/tutor/flows/bots/examiner', $invalid)->assertUnprocessable();
        $stt = app(AiProfiles::class)->all()['exam_stt_primary']; $stt['config']['maxOutputTokens'] = 10;
        $this->putJson('/api/tutor/flows/bots/exam_stt_primary', ['expected_revision' => $stt['revision'], 'config' => $stt['config']])->assertUnprocessable();
        $this->assertDatabaseCount('app_settings', 0);
    }

    public function test_examiner_editor_prompts_match_the_real_default_request_and_override_preserves_grade_validation(): void
    {
        config(['services.openai.key' => 'fixture-only']);
        Http::preventStrayRequests();
        $grade = ['id' => 'one', 'points' => 2, 'feedback' => 'Хорошо.', 'example' => 'Labdien!', 'errors' => [], 'recommendation' => 'Продолжайте.'];
        $response = fn ($value) => ['status' => 'completed', 'output' => [['content' => [['type' => 'output_text', 'text' => json_encode(['answers' => [$value]])]]]]];
        Http::fake(['api.openai.com/*' => Http::sequence()->push($response($grade))->push($response(array_replace($grade, ['points' => 3])))]);
        $items = [['id' => 'one', 'skill' => 'writing', 'prompt' => 'Поздоровайтесь', 'context' => '', 'rubric' => 'Greeting', 'maximum' => 2, 'answer' => 'Labdien!']];
        app(\App\Services\Exams\ExamAi::class)->assess($items, 'B2');
        $defaults = app(AiProfiles::class)->all()['examiner'];
        Http::assertSent(function ($request) use ($defaults) {
            $prompts = array_map(fn ($text) => str_replace('{{level}}', 'B2', $text), $defaults['config']['prompts']);
            $prompts[0] .= "\n".\App\Services\Language\LatvianReferences::instructions();
            $this->assertSame($prompts, array_column(array_slice($request['input'], 0, 3), 'content'));
            return true;
        });
        app(AiProfiles::class)->save('examiner', ['expected_revision' => $defaults['revision'], 'config' => array_replace($defaults['config'], ['model' => 'gpt-4.1-mini', 'reasoning' => 'none', 'maxOutputTokens' => 1000])]);
        try { app(\App\Services\Exams\ExamAi::class)->assess($items, 'B2'); $this->fail('Invalid grade accepted'); }
        catch (\RuntimeException $error) { $this->assertStringContainsString('Invalid exam grade', $error->getMessage()); }
        Http::assertSent(fn ($request) => $request['model'] === 'gpt-4.1-mini' && !isset($request['reasoning']) && $request['max_output_tokens'] === 1000 && $request['text']['format']['strict']);
    }

    public function test_private_capture_uses_trusted_owner_real_request_and_excludes_credentials_and_audio(): void
    {
        config(['ai_studio.capture_in_tests' => true, 'credits.gateway_secret' => str_repeat('t', 40)]);
        Http::preventStrayRequests();
        Http::fake(function ($request) {
            if ($request->url() === config('ai_studio.capture_url')) return Http::response(match ($request['action']) {
                'status' => ['recording' => true], 'begin' => ['id' => 'fixture-record'], default => ['ok' => true],
            });
            return Http::response(['status' => 'completed', 'output_text' => 'fixture response', 'usage' => ['input_tokens' => 10]]);
        });
        $body = ['model' => 'fixture-model', 'input' => [['role' => 'developer', 'content' => str_repeat('instruction ', 1000)],
            ['type' => 'reasoning', 'encrypted_content' => 'encrypted-do-not-retain']], 'audio' => 'do-not-retain'];
        $result = app(CreditContext::class)->run(25, fn () => Http::withToken('private-provider-key')->withOptions(['ai_role' => 'examiner'])
            ->post('https://api.openai.com/v1/responses', $body), 'exam_check', null, ['type' => 'exam_attempt', 'id' => 123]);
        $this->assertSame('fixture response', $result->json('output_text'));
        Http::assertSent(fn ($request) => $request->url() === config('ai_studio.capture_url') && $request['action'] === 'begin'
            && $request['userId'] === 25 && $request['subject']['id'] === 123 && strlen($request['request']['input'][0]['content']) > 6000
            && $request['request']['input'][1]['encrypted_content'] === '[excluded]' && $request['request']['audio'] === '[excluded]'
            && !str_contains(json_encode($request->data()), 'private-provider-key'));
        Http::assertSent(fn ($request) => $request->url() === config('ai_studio.capture_url') && $request['action'] === 'finish' && $request['response']['usage']['input_tokens'] === 10);
        $this->assertNull(app(CreditContext::class)->userId);
        $this->assertNull(app(CreditContext::class)->debugSubject);
    }
}
