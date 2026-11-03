<?php

namespace App\Filament\Pages;

use App\Models\User;
use App\Services\Credits\CreditWallet;
use BackedEnum;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Support\Icons\Heroicon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Livewire\Attributes\Locked;

class Credits extends Page
{
    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedWallet;
    protected static ?string $navigationLabel = 'Кредиты';
    protected static ?string $title = 'Кредиты';
    protected string $view = 'filament.pages.credits';
    public string $email = '';
    public string $amount = '';
    #[Locked] public string $grantReference = '';

    public static function canAccess(): bool { return Auth::user()?->isSuperAdmin() ?? false; }
    public function mount(): void { $this->grantReference = 'admin:'.Auth::id().':'.Str::uuid(); }

    public function grant(): void
    {
        abort_unless(static::canAccess(), 403);
        $this->validate(['email' => 'required|email|exists:users,email', 'amount' => ['required', 'regex:/^[0-9]{1,5}(\.[0-9]{1,6})?$/']]);
        [$whole, $fraction] = array_pad(explode('.', $this->amount), 2, '');
        $micros = (int) $whole * 1000000 + (int) str_pad($fraction, 6, '0');
        if ($micros <= 0) { $this->addError('amount', 'Укажите положительную сумму.'); return; }
        app(CreditWallet::class)->grant(User::where('email', $this->email)->sole()->id, $micros, $this->grantReference);
        $this->amount = '';
        $this->grantReference = 'admin:'.Auth::id().':'.Str::uuid();
        Notification::make()->title('Кредиты начислены')->success()->send();
        $this->notifyBalanceChanged();
    }

    public function release(string $id): void
    {
        abort_unless(static::canAccess(), 403);
        $op = DB::table('credit_operations')->where('id', $id)->whereIn('status', ['review', 'reserved'])->where('created_at', '<', now()->subMinutes(15))->first();
        abort_unless($op, 409);
        app(CreditWallet::class)->settle($op->user_id, $id, null, true);
        \Illuminate\Support\Facades\Log::notice('Credit reservation waived by administrator', ['operation' => $id, 'admin_id' => Auth::id()]);
        Notification::make()->title('Резерв возвращён, расход принят сайтом')->success()->send();
        $this->notifyBalanceChanged();
    }

    private function notifyBalanceChanged(): void
    {
        $this->js("window.dispatchEvent(new Event('lbp:credits-changed')); try { localStorage.setItem('lbp:credits-changed', Date.now() + ':' + Math.random()); } catch {} ");
    }

    protected function getViewData(): array
    {
        abort_unless(static::canAccess(), 403);
        return ['operations' => DB::table('credit_operations')->join('users', 'users.id', '=', 'credit_operations.user_id')
            ->when($this->email, fn ($q) => $q->where('users.email', $this->email))
            ->orderByDesc('credit_operations.created_at')->limit(100)->get(['credit_operations.*', 'users.email']),
            'account' => ($user = User::where('email', $this->email)->first()) ? app(CreditWallet::class)->balance($user->id) : null];
    }
}
