<?php

namespace App\Providers;

use App\Policies\RolePolicy;
use Carbon\CarbonImmutable;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;
use Spatie\Permission\Models\Role;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->scoped(\App\Services\Credits\CreditContext::class);
        $this->app->scoped(\App\Services\Tutor\AiProfiles::class);
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
        \Illuminate\Support\Facades\Http::globalMiddleware(app(\App\Services\Credits\MeteredHttp::class)->middleware());
        \Illuminate\Support\Facades\Http::globalMiddleware(app(\App\Services\Tutor\AiTrace::class)->middleware());

        foreach ([\App\Models\Dictionary::class, \App\Models\DictionaryWord::class,
            \App\Models\DictionaryCategory::class, \App\Models\DictionaryWordTranslation::class,
            \App\Models\DictionaryCategoryTranslation::class] as $model) {
            $invalidate = function ($record): void {
                $record->getConnection()->afterCommit(fn () => \App\Services\DictionaryCache::invalidate());
            };
            $model::saved($invalidate);
            $model::deleted($invalidate);
        }

        // Query-builder bulk writes and pivot sync bypass Eloquent model events.
        DB::listen(function (\Illuminate\Database\Events\QueryExecuted $event): void {
            if (preg_match('/^\s*(?:insert(?:\s+ignore)?\s+into|replace\s+into|update|delete\s+from)\s+[`"]?(dictionaries|dictionary_words|dictionary_categories|dictionary_word_translations|dictionary_category_translations|dictionary_word_category)[`"]?(?=\s|\()/i', $event->sql)) {
                $event->connection->afterCommit(fn () => \App\Services\DictionaryCache::invalidate());
            }
        });

        Gate::policy(Role::class, RolePolicy::class);

        ResetPassword::createUrlUsing(function (object $notifiable, string $token): string {
            $frontend = rtrim((string) config('app.frontend_url', 'http://localhost:3000'), '/');

            return $frontend.'/reset-password?token='.$token.'&email='.urlencode($notifiable->getEmailForPasswordReset());
        });
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}
