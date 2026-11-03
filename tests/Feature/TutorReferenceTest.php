<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\{Cache, Http};
use Laravel\Sanctum\Sanctum;
use Tests\TestCase;

class TutorReferenceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['cache.default' => 'array']);
        Cache::flush();
        Http::preventStrayRequests();
    }

    public function test_guest_cannot_use_the_reference_proxy(): void
    {
        $this->postJson('/api/tutor/references', ['operation' => 'analyze', 'query' => 'mājā'])->assertUnauthorized();
        Http::assertNothingSent();
    }

    public function test_signed_in_user_gets_forms_but_cannot_read_an_arbitrary_host(): void
    {
        $user = new User();
        $user->id = 123;
        Sanctum::actingAs($user);
        Http::fake(['morpho-api.tezaurs.lv/*' => Http::response([['Wordform' => 'mājā', 'Case' => 'Locative']])]);
        $this->postJson('/api/tutor/references', ['operation' => 'analyze', 'query' => 'mājā'])
            ->assertOk()->assertJsonPath('data.forms.0.Case', 'Locative');
        $this->postJson('/api/tutor/references', ['operation' => 'read', 'query' => 'https://127.0.0.1/'])
            ->assertUnprocessable()->assertJsonPath('data.error.code', 'invalid_reference_request');
        Http::assertSentCount(1);
    }

    public function test_provider_failure_is_not_reported_as_a_successful_verification(): void
    {
        $user = new User();
        $user->id = 124;
        Sanctum::actingAs($user);
        Http::fake(['morpho-api.tezaurs.lv/*' => Http::response('', 503)]);
        $this->postJson('/api/tutor/references', ['operation' => 'analyze', 'query' => 'mājā'])
            ->assertStatus(503)->assertJsonPath('data.ok', false)->assertJsonPath('data.error.code', 'reference_unavailable');
    }
}
