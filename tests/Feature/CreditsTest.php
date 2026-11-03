<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\User;
use App\Services\Credits\{CreditException, CreditPricing, CreditWallet};
use Illuminate\Support\Facades\{DB, Http, Schema};
use Tests\TestCase;

class CreditsTest extends TestCase
{
    public function test_gateway_reports_canonical_settlement_cost_without_changing_debit_or_treating_review_as_zero(): void
    {
        $user = $this->user(); $wallet = $this->wallet(); $wallet->grant($user->id, 50000000, 'loop-observation-grant');
        $this->withHeader('X-Credit-Gateway', str_repeat('s', 32));
        $ticket = $this->actingAs($user)->postJson('/api/tutor/ticket')->json('ticket');
        $session = $this->postJson('/api/internal/credits', ['action' => 'authenticate', 'ticket' => $ticket])->assertOk()->json('session');
        $operation = $wallet->reserve($user->id, 'loop-observation', ['model' => 'gpt-5.4', 'kind' => 'text', 'input_bytes' => 200, 'max_output_tokens' => 700]);
        $payload = ['action' => 'settle', 'session' => $session, 'operation' => $operation, 'usage' => ['input_tokens' => 100, 'output_tokens' => 10]];
        $response = $this->postJson('/api/internal/credits', $payload)->assertOk()->assertJsonPath('status', 'settled');
        $record = DB::table('credit_operations')->where('id', $operation)->first();
        $response->assertJsonPath('cost_micros', (int) $record->cost_micros);
        $balance = $wallet->balance($user->id);
        $this->postJson('/api/internal/credits', $payload)->assertOk()->assertJsonPath('cost_micros', (int) $record->cost_micros);
        $this->assertSame($balance, $wallet->balance($user->id));
        $unknown = $wallet->reserve($user->id, 'loop-observation-unknown', ['model' => 'gpt-5.4', 'kind' => 'text', 'input_bytes' => 200, 'max_output_tokens' => 700]);
        $this->postJson('/api/internal/credits', ['action' => 'settle', 'session' => $session, 'operation' => $unknown, 'usage' => null])
            ->assertOk()->assertJsonPath('status', 'review')->assertJsonPath('cost_micros', null);
    }

    public function test_debug_authorization_rechecks_admin_role_and_session_expiry_without_reserving_credits(): void
    {
        $user = $this->user();
        $role = DB::table('roles')->insertGetId(['name' => 'admin', 'guard_name' => 'web']);
        DB::table('model_has_roles')->insert(['role_id' => $role, 'model_type' => User::class, 'model_id' => $user->id]);
        $this->withHeader('X-Credit-Gateway', str_repeat('s', 32));
        $ticket = $this->actingAs($user)->postJson('/api/tutor/ticket')->json('ticket');
        $auth = $this->postJson('/api/internal/credits', ['action' => 'authenticate', 'ticket' => $ticket])->assertOk()->assertJsonPath('user_id', $user->id)->assertJsonPath('is_admin', true);
        $payload = ['action' => 'debug.authorize', 'session' => $auth->json('session')];
        $this->postJson('/api/internal/credits', $payload)->assertOk();
        DB::table('model_has_roles')->where('model_id', $user->id)->delete();
        $this->postJson('/api/internal/credits', $payload)->assertForbidden();
        DB::table('credit_gateway_sessions')->update(['expires_at' => now()->subSecond()]);
        $this->postJson('/api/internal/credits', $payload)->assertUnauthorized();
        $this->assertSame(0, DB::table('credit_operations')->count());
    }

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('users', function ($t) { $t->id(); $t->string('email')->unique(); $t->string('name')->default('Test'); $t->timestamps(); });
        Schema::create('app_settings', function ($t) { $t->string('key')->primary(); $t->text('value'); $t->timestamps(); });
        Schema::create('personal_access_tokens', function ($t) { $t->id(); $t->unsignedBigInteger('tokenable_id'); $t->timestamp('expires_at')->nullable(); });
        // Gateway authentication now returns the verified admin capability for preset editing.
        Schema::create('roles', function ($t) { $t->id(); $t->string('name'); $t->string('guard_name'); $t->timestamps(); });
        Schema::create('model_has_roles', function ($t) { $t->unsignedBigInteger('role_id'); $t->string('model_type'); $t->unsignedBigInteger('model_id'); });
        (require database_path('migrations/2026_10_16_000001_create_credit_accounts.php'))->up();
        config(['credits.enabled' => true, 'credits.gateway_secret' => str_repeat('s', 32)]);
    }

    private function user(): User { return User::create(['email' => uniqid().'@example.test', 'name' => 'Test']); }
    private function wallet(): CreditWallet { return app(CreditWallet::class); }
    private function reserve(User $u, string $reference = 'request'): string
    {
        return $this->wallet()->reserve($u->id, $reference, ['model' => 'gpt-5.4', 'kind' => 'text', 'input_bytes' => 200, 'max_output_tokens' => 1000]);
    }

    public function test_margin_formula_and_microprecision(): void
    {
        $this->assertSame(10000000, CreditWallet::charge(5000000, 5000));
        $this->assertSame(2, CreditWallet::charge(1, 5000));
        $this->assertSame(4, CreditWallet::charge(3, 1000));
    }

    public function test_diagnostic_file_tracks_wallet_lifecycle_without_private_payloads(): void
    {
        $directory=base_path('.tmp/tutor-diagnostic-php-'.\Illuminate\Support\Str::uuid());
        config(['credits.diagnostics_directory'=>$directory,'credits.diagnostics_enabled'=>true]);
        try {
            $u=$this->user();$wallet=$this->wallet();$wallet->grant($u->id,1000000,'test');
            $id=$this->reserve($u);$wallet->settle($u->id,$id,null);$wallet->settle($u->id,$id,null,true);
            \App\Services\Credits\TutorDiagnostics::log('test.private',['operation'=>$id,'text'=>'private-message','audio'=>'private-audio','headers'=>['Authorization'=>'private-key'],'input_tokens'=>123]);
            $files=glob($directory.'/*.jsonl');$this->assertCount(1,$files);
            $raw=file_get_contents($files[0]);$this->assertStringNotContainsString('private-message',$raw);$this->assertStringNotContainsString('private-key',$raw);$this->assertStringNotContainsString('private-audio',$raw);
            $events=array_map(fn($line)=>json_decode($line,true,512,JSON_THROW_ON_ERROR),array_filter(explode("\n",$raw)));
            $this->assertSame(['wallet.reserved','wallet.review','wallet.released','test.private'],array_column($events,'event'));
            $this->assertEquals(0,$wallet->balance($u->id)['reserved']);
        } finally {
            foreach(glob($directory.'/*.jsonl')?:[] as $file)unlink($file);
            if(is_dir($directory))rmdir($directory);
        }
    }

    public function test_gpt6_sol_snapshots_its_cached_input_write_and_output_prices(): void
    {
        $u = $this->user(); $wallet = $this->wallet(); $wallet->grant($u->id, 50000000, 'test');
        $id = $wallet->reserve($u->id, 'sol6', ['model' => 'gpt-6-sol', 'kind' => 'text', 'input_bytes' => 200, 'max_output_tokens' => 700], 'uncompromising');
        $op = DB::table('credit_operations')->where('id', $id)->first();
        $this->assertSame([2000, 200, 10000, 2500], json_decode($op->pricing, true)['rate']);
        $wallet->settle($u->id, $id, ['input_tokens' => 1000, 'cached_tokens' => 600, 'cache_write_tokens' => 100, 'output_tokens' => 50]);
        $op = DB::table('credit_operations')->where('id', $id)->first();
        $this->assertEquals(1470, $op->cost_micros);
        $this->assertEquals(-2940, $op->amount_micros);
    }

    public function test_terra61_cached_input_writes_and_output_settle_at_its_own_rate(): void
    {
        $u = $this->user(); $wallet = $this->wallet(); $wallet->grant($u->id, 50000000, 'test');
        $id = $wallet->reserve($u->id, 'terra61', ['model' => 'gpt-6.1-terra', 'kind' => 'text',
            'input_bytes' => 200, 'max_output_tokens' => 700], 'uncompromising');
        $op = DB::table('credit_operations')->where('id', $id)->first();
        $this->assertSame([1000, 50, 5000, 1250], json_decode($op->pricing, true)['rate']);
        $wallet->settle($u->id, $id, ['input_tokens' => 1000, 'cached_tokens' => 600,
            'cache_write_tokens' => 100, 'output_tokens' => 50]);
        $op = DB::table('credit_operations')->where('id', $id)->first();
        $this->assertEquals(705, $op->cost_micros);
        $this->assertEquals(-1410, $op->amount_micros);
        $this->assertSame('settled', $op->status);
    }

    public function test_luna6_cached_input_writes_and_output_settle_at_its_own_rate(): void
    {
        $u = $this->user(); $wallet = $this->wallet(); $wallet->grant($u->id, 50000000, 'test');
        foreach (['economy' => 99, 'standard' => 148] as $preset => $charge) {
            $id = $wallet->reserve($u->id, 'luna6-'.$preset, ['model' => 'gpt-6-luna', 'kind' => 'text',
                'input_bytes' => 200, 'max_output_tokens' => 700], $preset);
            $op = DB::table('credit_operations')->where('id', $id)->first();
            $this->assertSame([100, 10, 500, 125], json_decode($op->pricing, true)['rate']);
            $wallet->settle($u->id, $id, ['input_tokens' => 1000, 'cached_tokens' => 600,
                'cache_write_tokens' => 100, 'output_tokens' => 50]);
            $op = DB::table('credit_operations')->where('id', $id)->first();
            $this->assertEquals(74, $op->cost_micros);
            $this->assertEquals(-$charge, $op->amount_micros);
            $this->assertSame('settled', $op->status);
        }
    }

    public function test_economy_commission_is_halved_and_snapshotted_without_affecting_other_requests(): void
    {
        $u = $this->user(); $wallet = $this->wallet(); $wallet->grant($u->id, 50000000, 'test');
        $request = ['model' => 'gpt-5.4', 'kind' => 'text', 'input_bytes' => 200, 'max_output_tokens' => 1000,
            'commission_bps' => 0, 'tutor_preset' => 'economy'];
        $economy = $wallet->reserve($u->id, 'economy', $request, 'economy');
        $standard = $wallet->reserve($u->id, 'standard', $request, 'standard');
        $ordinary = $wallet->reserve($u->id, 'ordinary', $request);
        $this->assertEquals(2500, DB::table('credit_operations')->where('id', $economy)->value('commission_bps'));
        foreach ([$standard, $ordinary] as $id) $this->assertEquals(5000, DB::table('credit_operations')->where('id', $id)->value('commission_bps'));
        AppSetting::create(['key' => 'credits_commission_percent', 'value' => '50.01']);
        $this->assertSame(2501, $wallet->commission('economy'));
        AppSetting::whereKey('credits_commission_percent')->update(['value' => '90']);
        $wallet->settle($u->id, $economy, ['input_tokens' => 1000, 'cached_tokens' => 800, 'output_tokens' => 100]);
        $op = DB::table('credit_operations')->where('id', $economy)->first();
        $this->assertEquals(2200, $op->cost_micros);
        $this->assertEquals(-2934, $op->amount_micros);
        $this->assertEquals(2500, $op->commission_bps);
        $this->assertSame('economy', json_decode($op->pricing, true)['tutor_preset']);
    }

    public function test_tutor_commission_context_is_nested_and_does_not_leak_into_exam_or_http_requests(): void
    {
        $context = app(\App\Services\Credits\CreditContext::class);
        $u = $this->user(); $this->actingAs($u); $this->wallet()->grant($u->id, 50000000, 'test');
        request()->setUserResolver(fn () => $u);
        Http::fake(['api.openai.com/*' => Http::response(['usage' => ['input_tokens' => 1000, 'output_tokens' => 100]])]);
        $context->run($u->id, function () use ($context, $u) {
            Http::post('https://api.openai.com/v1/responses', ['model' => 'gpt-5.4']);
            $this->assertSame('economy', $context->tutorPreset);
            $context->run($u->id, function () use ($context) {
                $this->assertNull($context->tutorPreset);
                Http::post('https://api.openai.com/v1/responses', ['model' => 'gpt-5.4']);
            }, 'exam_check');
            $this->assertSame('economy', $context->tutorPreset);
        }, 'memory', 'economy');
        $this->assertNull($context->tutorPreset);
        $this->assertEqualsCanonicalizing([2500, 5000], DB::table('credit_operations')->where('kind', 'text')->pluck('commission_bps')->all());
    }

    public function test_gateway_reservation_uses_only_validated_preset_and_server_commission(): void
    {
        $u = $this->user(); $this->wallet()->grant($u->id, 50000000, 'test');
        $session = str_repeat('x', 64);
        DB::table('credit_gateway_sessions')->insert(['ticket_hash' => hash('sha256', 'test'), 'session_hash' => hash('sha256', $session),
            'user_id' => $u->id, 'ticket_expires_at' => now()->addMinute(), 'expires_at' => now()->addHour(), 'created_at' => now()]);
        $payload = ['action' => 'reserve', 'session' => $session, 'reference' => (string) \Illuminate\Support\Str::uuid(),
            'model' => 'gemini-3.8-flash-lite-tts', 'kind' => 'speech', 'characters' => 20, 'tutor_preset' => 'economy', 'commission_bps' => 0];
        $this->postJson('/api/internal/credits', $payload)->assertForbidden();
        $id = $this->withHeader('X-Credit-Gateway', str_repeat('s', 32))->postJson('/api/internal/credits', $payload)->assertOk()->json('operation');
        $this->assertEquals(2500, DB::table('credit_operations')->where('id', $id)->value('commission_bps'));
        $payload['reference'] = (string) \Illuminate\Support\Str::uuid(); $payload['tutor_preset'] = 'forged';
        $this->postJson('/api/internal/credits', $payload)->assertUnprocessable();
        $this->assertDatabaseCount('credit_operations', 2);
    }

    public function test_history_explains_purpose_without_exposing_pricing_snapshot(): void
    {
        $u = $this->user(); $this->wallet()->grant($u->id, 1000000, 'test');
        $this->wallet()->reserve($u->id, 'translation', ['model' => 'gpt-5.4', 'kind' => 'text', 'purpose' => 'translation_check']);
        $history = $this->actingAs($u)->getJson('/api/me/credits')->assertOk()->json('data.history');
        $op = collect($history)->firstWhere('model', 'gpt-5.4');
        $this->assertSame('translation_check', $op['purpose']);
        $this->assertArrayNotHasKey('pricing', $op);
        $this->assertSame('grant', collect($history)->firstWhere('kind', 'grant')['purpose']);
    }

    public function test_new_user_has_zero_and_cannot_reserve(): void
    {
        $u = $this->user();
        $this->assertEquals(0, $this->wallet()->balance($u->id)['available']);
        $this->expectException(CreditException::class);
        $this->reserve($u);
    }

    public function test_grant_is_once_and_owner_only(): void
    {
        $a = $this->user(); $b = $this->user();
        $this->wallet()->grant($a->id, 50000000, 'owner-test');
        $this->wallet()->grant($a->id, 50000000, 'owner-test');
        $this->assertEquals(50, $this->wallet()->balance($a->id)['available']);
        $this->assertEquals(0, $this->wallet()->balance($b->id)['available']);
        $this->assertSame(1, DB::table('credit_operations')->count());
    }

    public function test_actual_usage_cache_commission_snapshot_and_duplicate_settlement(): void
    {
        $u = $this->user(); $this->wallet()->grant($u->id, 50000000, 'test');
        $id = $this->reserve($u);
        AppSetting::create(['key' => 'credits_commission_percent', 'value' => '90']);
        $usage = ['input_tokens' => 1000, 'cached_tokens' => 800, 'output_tokens' => 100];
        $this->wallet()->settle($u->id, $id, $usage);
        $this->wallet()->settle($u->id, $id, $usage);
        $op = DB::table('credit_operations')->where('id', $id)->first();
        $this->assertSame(2200, $op->cost_micros);
        $this->assertSame(-4400, $op->amount_micros);
        $this->assertEquals(49.9956, $this->wallet()->balance($u->id)['balance']);
        $this->assertEquals(0, $this->wallet()->balance($u->id)['reserved']);
    }

    public function test_uncertain_usage_keeps_hold_and_rejected_request_releases_it(): void
    {
        $u = $this->user(); $this->wallet()->grant($u->id, 1000000, 'test');
        $id = $this->reserve($u);
        $this->wallet()->settle($u->id, $id, null);
        $this->assertSame('review', DB::table('credit_operations')->where('id', $id)->value('status'));
        $this->assertGreaterThan(0, $this->wallet()->balance($u->id)['reserved']);
        $this->wallet()->settle($u->id, $id, null, true);
        $this->assertEquals(1, $this->wallet()->balance($u->id)['available']);
    }

    public function test_reserved_money_cannot_be_spent_by_second_request(): void
    {
        $u = $this->user(); $this->wallet()->grant($u->id, 200000, 'test');
        $this->reserve($u, 'one');
        $this->expectException(CreditException::class);
        $this->reserve($u, 'two');
    }

    public function test_personal_history_cannot_leak_other_user(): void
    {
        $a = $this->user(); $b = $this->user();
        $this->wallet()->grant($a->id, 50000000, 'owner');
        $this->actingAs($b)->getJson('/api/me/credits?user_id='.$a->id)->assertOk()->assertJsonPath('data.balance', 0)->assertJsonCount(0, 'data.history');
    }

    public function test_ticket_is_one_use_and_internal_api_is_private(): void
    {
        $u = $this->user();
        $this->postJson('/api/internal/credits', ['action' => 'authenticate'])->assertForbidden();
        $ticket = $this->actingAs($u)->postJson('/api/tutor/ticket')->assertOk()->json('ticket');
        $this->withHeader('X-Credit-Gateway', str_repeat('s', 32))->postJson('/api/internal/credits', ['action' => 'authenticate', 'ticket' => $ticket])->assertOk();
        $this->postJson('/api/internal/credits', ['action' => 'authenticate', 'ticket' => $ticket])->assertUnauthorized();
    }

    public function test_php_provider_is_not_called_without_credit(): void
    {
        $u = $this->user(); $this->actingAs($u);
        request()->setUserResolver(fn () => $u);
        Http::fake(['api.openai.com/*' => Http::response(['usage' => ['input_tokens' => 1, 'output_tokens' => 1]])]);
        try { Http::post('https://api.openai.com/v1/responses', ['model' => 'gpt-5.4']); $this->fail('Provider was reached'); }
        catch (CreditException $error) { $this->assertSame(402, $error->status); Http::assertNothingSent(); }
    }

    public function test_php_provider_settles_usage(): void
    {
        $u = $this->user(); $this->actingAs($u); $this->wallet()->grant($u->id, 50000000, 'test');
        request()->setUserResolver(fn () => $u);
        Http::fake(['api.openai.com/*' => Http::response(['usage' => ['input_tokens' => 1000, 'output_tokens' => 100]])]);
        Http::post('https://api.openai.com/v1/responses', ['model' => 'gpt-5.4']);
        $this->assertEquals(49.992, $this->wallet()->balance($u->id)['balance']);
    }

    public function test_stt_tts_and_embedding_prices(): void
    {
        $p = app(CreditPricing::class);
        $this->assertSame(4500, $p->cost($p->quote(['model' => 'gpt-transcribe', 'kind' => 'transcription']), ['seconds' => 60]));
        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-12-31T23:59:59Z'));
        $this->assertSame(18010, $p->cost($p->quote(['model' => 'gemini-3.8-flash-tts', 'kind' => 'speech']), ['input_tokens' => 20, 'output_tokens' => 2000]));
        $liteQuote = $p->quote(['model' => 'gemini-3.8-flash-lite-tts', 'kind' => 'speech']);
        $this->assertSame(12010, $p->cost($liteQuote, ['input_tokens' => 20, 'output_tokens' => 2000]));
        $this->travelTo(\Carbon\CarbonImmutable::parse('2027-01-01T00:00:00Z'));
        $this->assertSame(36020, $p->cost($p->quote(['model' => 'gemini-3.8-flash-tts', 'kind' => 'speech']), ['input_tokens' => 20, 'output_tokens' => 2000]));
        $this->assertSame(24020, $p->cost($p->quote(['model' => 'gemini-3.8-flash-lite-tts', 'kind' => 'speech']), ['input_tokens' => 20, 'output_tokens' => 2000]));
        $this->assertSame(12010, $p->cost($liteQuote, ['input_tokens' => 20, 'output_tokens' => 2000]));
        $this->travelBack();
        $this->assertSame(1500, $p->cost($p->quote(['model' => 'tts-1', 'kind' => 'speech', 'characters' => 100]), []));
        $this->assertNull($p->cost($p->quote(['model' => 'tts-1', 'kind' => 'speech', 'characters' => 100]), null));
        $this->assertSame(13, $p->cost($p->quote(['model' => 'text-embedding-3-large', 'kind' => 'embedding']), ['input_tokens' => 100, 'output_tokens' => 0]));
    }

    public function test_expired_and_revoked_tickets_cannot_authenticate(): void
    {
        $u = $this->user();
        $this->withHeader('X-Credit-Gateway', str_repeat('s', 32));
        $ticket = $this->actingAs($u)->postJson('/api/tutor/ticket')->json('ticket');
        DB::table('credit_gateway_sessions')->update(['ticket_expires_at' => now()->subSecond()]);
        $this->postJson('/api/internal/credits', ['action' => 'authenticate', 'ticket' => $ticket])->assertUnauthorized();
        $ticket = $this->postJson('/api/tutor/ticket')->json('ticket');
        DB::table('credit_gateway_sessions')->where('ticket_hash', hash('sha256', $ticket))->update(['access_token_id' => 999]);
        $this->postJson('/api/internal/credits', ['action' => 'authenticate', 'ticket' => $ticket])->assertUnauthorized();
    }

    public function test_expired_session_can_settle_but_cannot_spend_again(): void
    {
        $u = $this->user(); $this->wallet()->grant($u->id, 1000000, 'test');
        $this->withHeader('X-Credit-Gateway', str_repeat('s', 32));
        $ticket = $this->actingAs($u)->postJson('/api/tutor/ticket')->json('ticket');
        $session = $this->postJson('/api/internal/credits', ['action' => 'authenticate', 'ticket' => $ticket])->json('session');
        $id = $this->reserve($u);
        DB::table('credit_gateway_sessions')->update(['expires_at' => now()->subSecond()]);
        $this->postJson('/api/internal/credits', ['action' => 'reserve', 'session' => $session, 'reference' => (string) \Illuminate\Support\Str::uuid(), 'model' => 'gpt-5.4', 'kind' => 'text'])->assertUnauthorized();
        $this->postJson('/api/internal/credits', ['action' => 'settle', 'session' => $session, 'operation' => $id, 'usage' => ['input_tokens' => 100, 'output_tokens' => 10]])->assertOk();
        $this->assertEquals(0, $this->wallet()->balance($u->id)['reserved']);
    }

    public function test_settlement_cannot_touch_another_account(): void
    {
        $a = $this->user(); $b = $this->user(); $this->wallet()->grant($a->id, 1000000, 'test');
        $id = $this->reserve($a);
        try { $this->wallet()->settle($b->id, $id, null, true); $this->fail('Foreign operation accepted'); }
        catch (CreditException $error) { $this->assertSame(404, $error->status); }
        $this->assertSame('reserved', DB::table('credit_operations')->where('id', $id)->value('status'));
    }

    public function test_provider_overrun_never_creates_negative_balance_and_waiver_is_final(): void
    {
        $u = $this->user(); $this->wallet()->grant($u->id, 1000000, 'test');
        $id = $this->reserve($u);
        $hold = DB::table('credit_operations')->where('id', $id)->value('reserved_micros');
        $this->wallet()->settle($u->id, $id, ['input_tokens' => 1000000, 'output_tokens' => 100000]);
        $this->assertEquals((1000000 - $hold) / 1000000, $this->wallet()->balance($u->id)['available']);
        $id = $this->reserve($u, 'second');
        $this->wallet()->settle($u->id, $id, null, true);
        $this->wallet()->settle($u->id, $id, ['input_tokens' => 1000, 'output_tokens' => 100]);
        $this->assertSame('released', DB::table('credit_operations')->where('id', $id)->value('status'));
        $this->assertEquals(0, $this->wallet()->balance($u->id)['reserved']);
    }

    public function test_exam_transcription_pool_cannot_call_provider_at_zero_balance(): void
    {
        $u = $this->user(); $this->actingAs($u); request()->setUserResolver(fn () => $u);
        config(['services.openai.key' => 'fake-test-key']);
        Http::fake(['api.openai.com/*' => Http::response(['text' => 'test', 'usage' => ['seconds' => 1]])]);
        try { app(\App\Services\Exams\ExamAi::class)->transcribe('test', 'wav'); $this->fail('Transcription accepted'); }
        catch (CreditException $error) { $this->assertSame(402, $error->status); Http::assertNothingSent(); }
    }
}
