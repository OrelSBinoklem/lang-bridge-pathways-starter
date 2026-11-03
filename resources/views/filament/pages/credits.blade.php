<x-filament-panels::page>
    <p>1 кредит = $1. Комиссия задаётся в «Супернастройках». Новые аккаунты начинают с нуля.</p>
    <form wire:submit="grant" class="space-y-4">
        <label>Email пользователя <input type="email" wire:model.live.debounce.600ms="email" class="border rounded p-2" required></label>
        @error('email') <p role="alert">{{ $message }}</p> @enderror
        @if($account) <p>Баланс: {{ $account['balance'] }}; доступно: {{ $account['available'] }}; резерв: {{ $account['reserved'] }}.</p> @endif
        <label>Начислить кредитов <input type="text" inputmode="decimal" wire:model="amount" class="border rounded p-2" required></label>
        @error('amount') <p role="alert">{{ $message }}</p> @enderror
        <x-filament::button type="submit" wire:loading.attr="disabled" wire:confirm="Начислить указанную сумму этому пользователю?">Начислить</x-filament::button>
    </form>
    <div style="overflow-x:auto">
        <table style="width:100%;text-align:left;border-collapse:collapse">
            <thead><tr><th>Дата</th><th>Аккаунт</th><th>Модель</th><th>Расход API, $</th><th>Кредиты</th><th>Статус</th><th></th></tr></thead>
            <tbody>@foreach($operations as $op)<tr>
                <td style="padding:10px 6px">{{ $op->created_at }}</td><td>{{ $op->email }}</td><td>{{ $op->model ?? 'Начисление' }}</td>
                <td>{{ isset($op->cost_micros) ? $op->cost_micros / 1000000 : '—' }}</td><td>{{ $op->amount_micros / 1000000 }}</td><td>{{ $op->status }}</td>
                <td>@if(in_array($op->status, ['reserved','review']) && $op->created_at < now()->subMinutes(15))
                    <x-filament::button size="sm" color="gray" wire:click="release('{{ $op->id }}')" wire:confirm="Не списывать эту операцию? Возможный расход провайдера оплатит сайт.">Снять резерв</x-filament::button>
                @endif</td>
            </tr>@endforeach</tbody>
        </table>
    </div>
</x-filament-panels::page>
