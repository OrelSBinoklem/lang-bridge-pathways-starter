<?php

namespace App\Filament\Resources\Users\Schemas;

use App\Models\User;
use Filament\Forms\Components\DateTimePicker;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Schemas\Schema;
use Illuminate\Database\Eloquent\Builder;

class UserForm
{
    public static function configure(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('name')
                    ->required()
                    ->maxLength(255),
                TextInput::make('email')
                    ->label('Email address')
                    ->email()
                    ->required()
                    ->maxLength(255)
                    ->unique(ignoreRecord: true),
                Select::make('roles')
                    ->relationship(
                        name: 'roles',
                        titleAttribute: 'name',
                        modifyQueryUsing: function (Builder $query): Builder {
                            /** @var User|null $actor */
                            $actor = auth()->user();
                            $allowed = $actor?->assignableRoleNames() ?? [];

                            return $allowed === []
                                ? $query->whereRaw('1 = 0')
                                : $query->whereIn('name', $allowed);
                        },
                    )
                    ->multiple()
                    ->preload()
                    ->required()
                    ->disabled(function (?User $record): bool {
                        /** @var User|null $actor */
                        $actor = auth()->user();
                        if (! $actor) {
                            return true;
                        }
                        if ($record === null) {
                            return $actor->assignableRoleNames() === [];
                        }
                        // свою роль обычный админ не эскалирует через полный список — список уже урезан
                        if ($actor->id === $record->id) {
                            return ! $actor->isSuperAdmin() && ! $actor->hasRole('admin');
                        }

                        return ! $actor->canManageUser($record);
                    })
                    ->helperText('super_admin назначает всех; admin — только moderator и user'),
                DateTimePicker::make('email_verified_at')
                    ->label('Email verified at'),
                TextInput::make('password')
                    ->password()
                    ->revealable()
                    ->minLength(8)
                    ->dehydrated(fn (?string $state): bool => filled($state))
                    ->required(fn (string $operation): bool => $operation === 'create')
                    ->helperText('Leave empty to keep the current password.')
                    ->afterStateHydrated(function (TextInput $component): void {
                        $component->state(null);
                    }),
            ]);
    }
}
