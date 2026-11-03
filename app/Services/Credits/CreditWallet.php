<?php

namespace App\Services\Credits;

use App\Models\AppSetting;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreditWallet
{
    public static function charge(int $cost, int $bps): int
    {
        if ($cost < 0 || $bps < 0 || $bps > 9900) throw new \InvalidArgumentException('Invalid credit calculation');
        return intdiv($cost * 10000 + (10000 - $bps) - 1, 10000 - $bps);
    }

    public function commission(?string $tutorPreset = null): int
    {
        if ($tutorPreset !== null && !in_array($tutorPreset, \App\Services\Tutor\TutorPresets::IDS, true)) throw new \InvalidArgumentException('Invalid tutor preset');
        $percent = AppSetting::whereKey('credits_commission_percent')->value('value') ?? '50';
        $bps = max(0, min(9900, (int) round((float) $percent * 100)));
        return $tutorPreset === 'economy' ? intdiv($bps + 1, 2) : $bps;
    }

    private function account(int $user)
    {
        DB::table('credit_accounts')->insertOrIgnore(['user_id' => $user, 'created_at' => now(), 'updated_at' => now()]);
        return DB::table('credit_accounts')->where('user_id', $user)->lockForUpdate()->first();
    }

    public function balance(int $user): array
    {
        $a = DB::table('credit_accounts')->where('user_id', $user)->first();
        return ['balance' => ($a->balance_micros ?? 0) / 1000000, 'reserved' => ($a->reserved_micros ?? 0) / 1000000,
            'available' => (($a->balance_micros ?? 0) - ($a->reserved_micros ?? 0)) / 1000000,
            'commission_percent' => $this->commission() / 100, 'enabled' => (bool) config('credits.enabled')];
    }

    public function grant(int $user, int $micros, string $reference): void
    {
        if ($micros <= 0 || $micros > 100000000000) throw new \InvalidArgumentException('Invalid credit grant');
        DB::transaction(function () use ($user, $micros, $reference) {
            $a = $this->account($user);
            $existing = DB::table('credit_operations')->where('reference', $reference)->first();
            if ($existing) {
                if ($existing->user_id != $user || $existing->amount_micros != $micros || $existing->kind !== 'grant') throw new \RuntimeException('Grant reference conflict');
                return;
            }
            DB::table('credit_accounts')->where('user_id', $user)->update(['balance_micros' => $a->balance_micros + $micros, 'updated_at' => now()]);
            DB::table('credit_operations')->insert(['id' => (string) Str::uuid(), 'user_id' => $user, 'reference' => $reference,
                'kind' => 'grant', 'status' => 'settled', 'amount_micros' => $micros, 'balance_after_micros' => $a->balance_micros + $micros,
                'created_at' => now(), 'updated_at' => now()]);
        }, 3);
    }

    public function reserve(int $user, string $reference, array $request, ?string $tutorPreset = null): string
    {
        $pricing = app(CreditPricing::class)->quote($request);
        // Preset comes only from the authenticated gateway/server context, never request fields.
        $bps = $this->commission($tutorPreset);
        if ($tutorPreset !== null) $pricing['tutor_preset'] = $tutorPreset;
        $hold = self::charge($pricing['reserve_cost_micros'], $bps);
        return DB::transaction(function () use ($user, $reference, $request, $pricing, $bps, $hold) {
            $a = $this->account($user);
            $old = DB::table('credit_operations')->where('reference', $reference)->first();
            if ($old) throw new CreditException('Этот AI-запрос уже зарегистрирован.', 409);
            if ($a->balance_micros - $a->reserved_micros < $hold) {
                TutorDiagnostics::log('wallet.reserve.denied', ['user_id'=>$user,'reference'=>$reference,'model'=>$request['model'],'reserved_micros'=>$hold,'available_micros'=>(int)($a->balance_micros-$a->reserved_micros),'reason'=>'insufficient_balance']);
                throw new CreditException();
            }
            $id = (string) Str::uuid();
            DB::table('credit_operations')->insert(['id' => $id, 'user_id' => $user, 'reference' => $reference,
                'kind' => $pricing['kind'], 'model' => $request['model'], 'status' => 'reserved', 'reserved_micros' => $hold,
                'commission_bps' => $bps, 'pricing' => json_encode($pricing, JSON_THROW_ON_ERROR), 'created_at' => now(), 'updated_at' => now()]);
            DB::table('credit_accounts')->where('user_id', $user)->update(['reserved_micros' => $a->reserved_micros + $hold, 'updated_at' => now()]);
            TutorDiagnostics::log('wallet.reserved', ['user_id'=>$user,'operation'=>$id,'reference'=>$reference,'model'=>$request['model'],'kind'=>$pricing['kind'],'purpose'=>$pricing['purpose'],'reserved_micros'=>$hold,'commission_bps'=>$bps,'balance_micros'=>(int)$a->balance_micros,'available_micros'=>(int)($a->balance_micros-$a->reserved_micros-$hold)]);
            return $id;
        }, 3);
    }

    public function settle(int $user, string $id, ?array $usage, bool $rejected = false): void
    {
        DB::transaction(function () use ($user, $id, $usage, $rejected) {
            $a = $this->account($user);
            $op = DB::table('credit_operations')->where('id', $id)->where('user_id', $user)->lockForUpdate()->first();
            if (!$op) throw new CreditException('Операция не найдена.', 404);
            if (in_array($op->status, ['settled', 'released'])) {
                TutorDiagnostics::log('wallet.settle.duplicate', ['user_id'=>$user,'operation'=>$id,'status'=>$op->status]);
                return;
            }
            $cost = $rejected ? 0 : app(CreditPricing::class)->cost(json_decode($op->pricing, true, 512, JSON_THROW_ON_ERROR), $usage);
            if ($cost === null) {
                DB::table('credit_operations')->where('id', $id)->update(['status' => 'review', 'updated_at' => now()]);
                TutorDiagnostics::log('wallet.review', ['user_id'=>$user,'operation'=>$id,'model'=>$op->model,'kind'=>$op->kind,'reason'=>'missing_or_invalid_usage','has_usage'=>$usage!==null,'reserved_micros'=>(int)$op->reserved_micros]+($usage??[]));
                return;
            }
            // Never debit beyond the authorized reservation. Any provider overrun is absorbed by the site.
            $amount = min($op->reserved_micros, self::charge($cost, $op->commission_bps));
            DB::table('credit_accounts')->where('user_id', $user)->update(['balance_micros' => $a->balance_micros - $amount,
                'reserved_micros' => $a->reserved_micros - $op->reserved_micros, 'updated_at' => now()]);
            DB::table('credit_operations')->where('id', $id)->update(['status' => $rejected ? 'released' : 'settled', 'cost_micros' => $cost,
                'amount_micros' => -$amount, 'balance_after_micros' => $a->balance_micros - $amount,
                'usage' => json_encode($usage, JSON_THROW_ON_ERROR), 'updated_at' => now()]);
            TutorDiagnostics::log('wallet.'.($rejected?'released':'settled'), ['user_id'=>$user,'operation'=>$id,'model'=>$op->model,'kind'=>$op->kind,'cost_micros'=>$cost,'amount_micros'=>-$amount,'reserved_micros'=>(int)$op->reserved_micros,'commission_bps'=>(int)$op->commission_bps,'balance_micros'=>(int)($a->balance_micros-$amount),'available_micros'=>(int)($a->balance_micros-$amount-$a->reserved_micros+$op->reserved_micros),'rejected'=>$rejected]+($usage??[]));
        }, 3);
    }
}
