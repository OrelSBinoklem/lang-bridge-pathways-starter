<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\CourseSubscription;
use App\Services\Credits\{CreditWallet, CreditException};
use Illuminate\Support\Facades\{DB, Http, Route, Schema};
use Illuminate\Support\Str;
use Tests\TestCase;

class CourseSubscriptionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Http::preventStrayRequests();
        $this->travelTo(\Carbon\CarbonImmutable::parse('2026-10-25T12:00:00Z'));
        Schema::create('users', function ($t) { $t->id(); $t->string('email')->unique(); $t->string('name'); $t->timestamps(); });
        Schema::create('app_settings', function ($t) { $t->string('key')->primary(); $t->text('value'); $t->timestamps(); });
        foreach (['2026_08_01_163324_create_permission_tables', '2026_10_16_000001_create_credit_accounts', '2026_10_16_000002_create_course_subscriptions'] as $migration) (require database_path('migrations/'.$migration.'.php'))->up();
        // A production host may still have its former subscription flag enabled.
        config(['subscriptions.enabled' => true, 'credits.enabled' => true]);
        Route::middleware('api')->get('/api/training/subscription-probe', fn () => ['ok' => true]);
    }

    private function user(?string $created = null): User
    {
        $user = User::create(['email' => Str::uuid().'@example.test', 'name' => 'Test']);
        if ($created) { $user->created_at = $created; $user->save(); }
        return $user;
    }

    public function test_old_and_new_accounts_have_permanently_free_access_even_with_the_old_flag_enabled(): void
    {
        foreach ([$this->user('2020-01-01 00:00:00'), $this->user()] as $user) {
            foreach (['2026-10-25T12:00:00Z', '2040-01-01T00:00:00Z'] as $date) {
                $this->travelTo(\Carbon\CarbonImmutable::parse($date));
                $status = app(CourseSubscription::class)->status($user);
                $this->assertTrue($status['active']);
                $this->assertFalse($status['enabled']);
                $this->assertSame('free', $status['status']);
                $this->assertSame(0, $status['price_credits']);
                $this->assertNull($status['access_until']);
                $this->assertNull($status['trial_until']);
                app(CourseSubscription::class)->requireActive($user);
            }
        }
        $this->assertSame(0, DB::table('credit_operations')->count());
    }

    public function test_zero_balance_does_not_block_ordinary_access_but_still_blocks_paid_ai(): void
    {
        $user = $this->user('2020-01-01 00:00:00');
        $this->actingAs($user)->getJson('/api/training/subscription-probe')->assertOk();
        $this->getJson('/api/me/subscription')->assertOk()->assertJsonPath('data.status', 'free')->assertJsonPath('data.price_credits', 0);
        try {
            app(CreditWallet::class)->reserve($user->id, 'zero-balance-ai', ['model' => 'gpt-5.4', 'kind' => 'text']);
            $this->fail('Zero balance must not permit a paid AI request');
        } catch (CreditException $error) {
            $this->assertEquals(0, app(CreditWallet::class)->balance($user->id)['balance']);
        }
        $this->assertSame(0, DB::table('credit_operations')->count());
        Http::assertNothingSent();
    }

    public function test_legacy_purchase_requests_never_charge_or_create_a_subscription(): void
    {
        $user = $this->user();
        $wallet = app(CreditWallet::class);
        $wallet->grant($user->id, 50000000, 'fixture');
        $this->actingAs($user);
        $id = (string) Str::uuid();
        foreach ([$id, $id, (string) Str::uuid()] as $requestId) {
            $this->postJson('/api/me/subscription', ['request_id' => $requestId, 'price' => 999])->assertOk()
                ->assertJsonPath('data.status', 'free')->assertJsonPath('data.price_credits', 0);
        }
        $this->assertEquals(50, $wallet->balance($user->id)['balance']);
        $this->assertSame(0, DB::table('course_subscriptions')->count());
        $this->assertSame(0, DB::table('credit_operations')->where('kind', 'subscription')->count());
        $this->postJson('/api/me/subscription', ['request_id' => 'invalid'])->assertUnprocessable();
    }

    public function test_legacy_purchase_with_zero_balance_is_free_too(): void
    {
        $user = $this->user();
        $this->actingAs($user)->postJson('/api/me/subscription', ['request_id' => (string) Str::uuid()])->assertOk()->assertJsonPath('data.active', true);
        $this->assertSame(0, DB::table('credit_operations')->count());
        $this->assertSame(0, DB::table('credit_accounts')->count());
    }

    public function test_old_paid_records_and_balances_are_preserved_without_renewal_or_refund(): void
    {
        $user = $this->user();
        app(CreditWallet::class)->grant($user->id, 12000000, 'fixture');
        DB::table('course_subscriptions')->insert(['user_id' => $user->id, 'paid_until' => '2026-11-01 00:00:00', 'created_at' => now(), 'updated_at' => now()]);
        $before = (array) DB::table('course_subscriptions')->where('user_id', $user->id)->first();
        app(CourseSubscription::class)->purchase($user, (string) Str::uuid());
        $this->assertSame($before, (array) DB::table('course_subscriptions')->where('user_id', $user->id)->first());
        $this->assertEquals(12, app(CreditWallet::class)->balance($user->id)['balance']);
        $this->assertSame(1, DB::table('credit_operations')->count());
    }

    public function test_gateway_can_reserve_ai_credits_after_the_former_trial_would_have_expired(): void
    {
        $user = $this->user('2020-01-01 00:00:00');
        app(CreditWallet::class)->grant($user->id, 50000000, 'fixture');
        $this->travelTo(\Carbon\CarbonImmutable::parse('2040-01-01T00:00:00Z'));
        $secret = str_repeat('s', 32); $session = str_repeat('a', 64);
        config(['credits.gateway_secret' => $secret]);
        DB::table('credit_gateway_sessions')->insert(['ticket_hash' => hash('sha256', 'fixture'), 'session_hash' => hash('sha256', $session),
            'user_id' => $user->id, 'ticket_expires_at' => now()->addMinute(), 'expires_at' => now()->addHour(), 'created_at' => now()]);
        $this->withHeader('X-Credit-Gateway', $secret)->postJson('/api/internal/credits', [
            'action' => 'reserve', 'session' => $session, 'reference' => (string) Str::uuid(), 'model' => 'gpt-5.4', 'kind' => 'text',
        ])->assertOk()->assertJsonStructure(['operation']);
        $this->assertSame(1, DB::table('credit_operations')->where('kind', 'text')->count());
    }

    public function test_authentication_is_preserved_but_public_preset_prices_need_no_subscription(): void
    {
        $this->getJson('/api/dictionaries/999/words')->assertUnauthorized();
        $this->getJson('/api/training/subscription-probe')->assertUnauthorized();
        $this->postJson('/api/me/subscription', ['request_id' => (string) Str::uuid()])->assertUnauthorized();
        $this->getJson('/api/tutor/presets')->assertOk()->assertJsonStructure(['data' => ['presets', 'commission_percent']]);
    }

    public function test_session_authentication_precedes_the_account_gate_and_dictionary_cache(): void
    {
        $route = app('router')->getRoutes()->match(\Illuminate\Http\Request::create('/api/dictionaries/20/words'));
        $middleware = app('router')->gatherRouteMiddleware($route);
        $session = array_search(\Laravel\Sanctum\Http\Middleware\EnsureFrontendRequestsAreStateful::class, $middleware, true);
        $access = array_search(\App\Http\Middleware\RequireCourseSubscription::class, $middleware, true);
        $cache = array_search(\App\Http\Middleware\CacheDictionaryResponse::class, $middleware, true);
        $this->assertNotFalse($session); $this->assertNotFalse($access); $this->assertNotFalse($cache);
        $this->assertLessThan($access, $session); $this->assertLessThan($cache, $access);
    }
}
