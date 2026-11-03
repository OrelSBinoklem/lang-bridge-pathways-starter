<?php

namespace App\Console\Commands;

use App\Models\User;
use App\Services\Credits\CreditWallet;
use Illuminate\Console\Command;

class GrantCredits extends Command
{
    protected $signature = 'credits:grant {email} {amount} {--reference= : Required unique business reference}';
    protected $description = 'Grant credits once; retries with the same reference do not add credits again';

    public function handle(CreditWallet $wallet): int
    {
        $value = $this->argument('amount');
        $reference = $this->option('reference');
        if (!preg_match('/^\d{1,5}(?:\.\d{1,6})?$/', $value) || !$reference || strlen($reference) > 130) {
            $this->error('Supply a positive amount (up to 6 decimals) and an explicit unique reference.');
            return self::FAILURE;
        }
        $user = User::where('email', $this->argument('email'))->sole();
        [$whole, $fraction] = array_pad(explode('.', $value), 2, '');
        $wallet->grant($user->id, (int) $whole * 1000000 + (int) str_pad($fraction, 6, '0'), 'grant:'.$reference);
        $this->info('Balance: '.$wallet->balance($user->id)['balance'].' credits.');
        return self::SUCCESS;
    }
}
