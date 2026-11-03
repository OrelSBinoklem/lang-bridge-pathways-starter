<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use App\Support\RoleHierarchy;
use Database\Factories\UserFactory;
use Filament\Models\Contracts\FilamentUser;
use Filament\Panel;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;
use Laravel\Fortify\Contracts\PasskeyUser;
use Laravel\Fortify\PasskeyAuthenticatable;
use Laravel\Fortify\TwoFactorAuthenticatable;
use Laravel\Sanctum\HasApiTokens;
use Spatie\Permission\Traits\HasRoles;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property int|null $wp_user_id
 * @property string|null $google_id
 * @property string|null $avatar
 * @property string|null $preferred_learn_lang
 * @property int $course_target_score
 * @property Carbon|null $email_verified_at
 * @property string|null $password
 * @property string|null $two_factor_secret
 * @property string|null $two_factor_recovery_codes
 * @property Carbon|null $two_factor_confirmed_at
 * @property string|null $remember_token
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'email', 'password', 'google_id', 'avatar', 'email_verified_at', 'wp_user_id', 'preferred_learn_lang'])]
#[Hidden(['password', 'two_factor_secret', 'two_factor_recovery_codes', 'remember_token'])]
class User extends Authenticatable implements FilamentUser, PasskeyUser
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, HasRoles, Notifiable, PasskeyAuthenticatable, TwoFactorAuthenticatable;

    public function canAccessPanel(Panel $panel): bool
    {
        return $this->hasAnyRole(RoleHierarchy::PANEL_ROLES);
    }

    public function highestRoleRank(): int
    {
        $max = 0;
        foreach ($this->getRoleNames() as $role) {
            $max = max($max, RoleHierarchy::rank((string) $role));
        }

        return $max;
    }

    public function isSuperAdmin(): bool
    {
        return $this->hasRole('super_admin');
    }

    /** Может ли управлять карточкой другого юзера (не себя) */
    public function canManageUser(User $target): bool
    {
        if ($this->isSuperAdmin()) {
            return true;
        }

        if (! $this->hasRole('admin')) {
            return false;
        }

        return $target->highestRoleRank() < $this->highestRoleRank();
    }

    /** Роли, которые этот юзер может назначать в форме */
    public function assignableRoleNames(): array
    {
        return RoleHierarchy::assignableBy(...$this->getRoleNames()->all());
    }

    public function isFrontendAdmin(): bool
    {
        return $this->hasAnyRole(RoleHierarchy::FRONTEND_ADMIN_ROLES);
    }

    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
    }

    public function dictionaryProgress(): HasMany
    {
        return $this->hasMany(UserDictionaryWord::class);
    }

    public function tutorConversations(): HasMany
    {
        return $this->hasMany(TutorConversation::class);
    }

    public function tutorMessages(): HasMany
    {
        return $this->hasMany(TutorMessage::class);
    }

    /** Полностью выученные: ≥2 балла в прямом и обратном, не в лёгком режиме */
    public function fullyLearnedWords(): HasMany
    {
        return $this->hasMany(UserDictionaryWord::class)
            ->where('correct_attempts', '>=', 2)
            ->where('correct_attempts_revert', '>=', 2)
            ->where(function ($q) {
                $q->where('mode_education', false)->orWhereNull('mode_education');
            })
            ->where(function ($q) {
                $q->where('mode_education_revert', false)->orWhereNull('mode_education_revert');
            });
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'course_target_score' => 'integer',
            'password' => 'hashed',
            'two_factor_confirmed_at' => 'datetime',
        ];
    }
}
