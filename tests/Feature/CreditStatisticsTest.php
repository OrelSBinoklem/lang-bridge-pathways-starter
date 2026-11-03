<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\{DB, Schema};
use Illuminate\Support\Str;
use Tests\TestCase;

class CreditStatisticsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('users', function ($table) { $table->id(); $table->string('email'); $table->string('name'); $table->timestamps(); });
        (require database_path('migrations/2026_10_16_000001_create_credit_accounts.php'))->up();
    }

    private function user(): User { return User::create(['name' => 'Test', 'email' => Str::uuid().'@example.test']); }

    private function operation(User $user, string $date, int $amount, string $status = 'settled', string $kind = 'text'): void
    {
        DB::table('credit_operations')->insert(['id' => (string) Str::uuid(), 'reference' => (string) Str::uuid(),
            'user_id' => $user->id, 'kind' => $kind, 'status' => $status, 'amount_micros' => $amount,
            'created_at' => $date, 'updated_at' => $date]);
    }

    public function test_totals_include_all_history_but_only_own_settled_operations_with_microprecision(): void
    {
        $user = $this->user(); $other = $this->user();
        for ($i = 0; $i < 61; $i++) $this->operation($user, '2026-10-16 10:00:00', -7);
        $this->operation($user, '2026-10-16 11:00:00', 50000000, kind: 'grant');
        $this->operation($user, '2026-10-16 12:00:00', -5000000, kind: 'subscription');
        foreach (['reserved', 'review', 'released'] as $status) $this->operation($user, '2026-10-16 11:00:00', -9999999, $status);
        $this->operation($other, '2026-10-16 11:00:00', 99999999, kind: 'grant');
        $result = $this->actingAs($user)->getJson('/api/me/credits/statistics?period=hour&date=2026-10-16&timezone=UTC&user_id='.$other->id)
            ->assertOk()->assertHeader('Cache-Control', 'no-store, private')->json('data');
        $this->assertCount(24, $result['buckets']);
        $this->assertSame(['incoming_micros' => 50000000, 'spent_micros' => 5000427, 'operations' => 63], $result['totals']);
        $this->assertSame(427, $result['buckets'][10]['spent_micros']);
        $this->assertSame(50000000, $result['buckets'][11]['incoming_micros']);
        $this->assertSame(5000000, $result['buckets'][12]['spent_micros']);
    }

    public function test_calendar_months_include_empty_buckets_and_exclude_upper_bound(): void
    {
        $user = $this->user();
        $this->operation($user, '2024-02-01 00:00:00', -1);
        $this->operation($user, '2024-02-29 23:59:59', -2);
        $this->operation($user, '2024-03-01 00:00:00', -4);
        $result = $this->actingAs($user)->getJson('/api/me/credits/statistics?period=day&date=2024-02-15')->assertOk()->json('data');
        $this->assertCount(29, $result['buckets']);
        $this->assertSame(3, $result['totals']['spent_micros']);
        $this->assertSame(0, $result['buckets'][10]['operations']);
        $year = $this->getJson('/api/me/credits/statistics?period=month&date=2024-06-01')->assertOk()->json('data');
        $this->assertCount(12, $year['buckets']);
        $this->assertSame(7, $year['totals']['spent_micros']);
        $this->assertSame(3, $year['buckets'][1]['spent_micros']);
        $this->assertSame(4, $year['buckets'][2]['spent_micros']);
    }

    public function test_timezone_boundary_and_both_repeated_daylight_saving_hours_are_preserved(): void
    {
        $user = $this->user();
        $this->operation($user, '2026-10-24 20:59:59', -99);
        $this->operation($user, '2026-10-24 21:00:00', -1);
        $this->operation($user, '2026-10-25 00:30:00', -2);
        $this->operation($user, '2026-10-25 01:30:00', -3);
        $this->operation($user, '2026-10-25 22:00:00', -99);
        $result = $this->actingAs($user)->getJson('/api/me/credits/statistics?period=hour&date=2026-10-25&timezone=Europe%2FRiga')->assertOk()->json('data');
        $this->assertCount(25, $result['buckets']);
        $this->assertSame(6, $result['totals']['spent_micros']);
        $this->assertSame('2026-10-25T03:00:00+03:00', $result['buckets'][3]['start']);
        $this->assertSame('2026-10-25T03:00:00+02:00', $result['buckets'][4]['start']);
        $this->assertSame(2, $result['buckets'][3]['spent_micros']);
        $this->assertSame(3, $result['buckets'][4]['spent_micros']);
        $spring = $this->getJson('/api/me/credits/statistics?period=hour&date=2026-03-29&timezone=Europe%2FRiga')->assertOk()->json('data');
        $this->assertCount(23, $spring['buckets']);
    }

    public function test_requires_login_and_rejects_invalid_calendar_and_timezone(): void
    {
        $this->getJson('/api/me/credits/statistics')->assertUnauthorized();
        $this->actingAs($this->user());
        foreach (['period=year', 'date=2026-02-30', 'timezone=Not%2FAZone', 'date=2026-01-01%20OR%201%3D1'] as $query) {
            $this->getJson('/api/me/credits/statistics?'.$query)->assertUnprocessable();
        }
        $this->getJson('/api/me/credits/statistics')->assertOk()->assertJsonPath('data.totals.operations', 0);
        config(['subscriptions.enabled' => true]);
        $this->getJson('/api/me/credits/statistics?timezone=Europe%2FKiev')->assertOk()->assertJsonPath('data.totals.operations', 0);
        $this->assertSame(0, DB::table('credit_operations')->count());
    }
}
