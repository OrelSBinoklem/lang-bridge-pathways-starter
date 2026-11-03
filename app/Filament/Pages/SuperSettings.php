<?php

namespace App\Filament\Pages;

use App\Models\AppSetting;
use App\Services\LessonProgressService;
use BackedEnum;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use App\Services\Exams\ExamSession;
use Filament\Notifications\Notification;
use Filament\Pages\Page;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Illuminate\Support\Facades\Auth;

class SuperSettings extends Page
{
    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedCog6Tooth;

    protected static ?string $navigationLabel = 'Супернастройки';

    protected static ?string $title = 'Супернастройки';

    protected static ?string $slug = 'super-settings';

    protected string $view = 'filament.pages.super-settings';

    public ?array $data = [];

    public static function canAccess(): bool
    {
        return Auth::user()?->isSuperAdmin() ?? false;
    }

    public function mount(LessonProgressService $progress): void
    {
        $this->form->fill([
            'credits_commission_percent' => app(\App\Services\Credits\CreditWallet::class)->commission() / 100,
            'lesson_variant_rotation_mode' => $progress->rotationMode(),
            'exam_cooldown_hours' => ExamSession::cooldownHours(),
            'exam_retain_audio' => ExamSession::retainAudio(),
        ]);
    }

    public function form(Schema $schema): Schema
    {
        return $schema
            ->components([
                TextInput::make('credits_commission_percent')->label('Комиссия кредитов, %')->numeric()->minValue(0)->maxValue(99)->step(0.01)->required()
                    ->helperText('1 кредит = $1. Списание = расход API / (1 - комиссия / 100). При 50% расход $5 списывает 10 кредитов. Google Flash: льготная цена до 31.12.2026 UTC, затем обычная. Проверить тариф при изменении цен или продлении акции.'),
                Select::make('lesson_variant_rotation_mode')
                    ->label('Ротация вариантов заданий')
                    ->options(LessonProgressService::rotationModes())
                    ->required()
                    ->native(false),
                TextInput::make('exam_cooldown_hours')->label('Часов между экзаменами')->numeric()->integer()->minValue(0)->maxValue(720)->required(),
                Toggle::make('exam_retain_audio')->label('Хранить записи устной части 30 дней')->helperText('По умолчанию выключено. Включение применяется к новым попыткам; ученику показывается уведомление перед началом.'),
            ])
            ->statePath('data');
    }

    public function save(): void
    {
        abort_unless(static::canAccess(), 403);

        $state = $this->form->getState();
        AppSetting::updateOrCreate(['key' => 'credits_commission_percent'], ['value' => (string) $state['credits_commission_percent']]);
        $mode = $state['lesson_variant_rotation_mode'] ?? null;
        abort_unless(array_key_exists($mode, LessonProgressService::rotationModes()), 422);

        AppSetting::query()->updateOrCreate(
            ['key' => LessonProgressService::ROTATION_SETTING],
            ['value' => $mode],
        );
        AppSetting::updateOrCreate(['key' => 'exam_cooldown_hours'], ['value' => (string) ($state['exam_cooldown_hours'] ?? 20)]);
        AppSetting::updateOrCreate(['key' => 'exam_retain_audio'], ['value' => !empty($state['exam_retain_audio']) ? '1' : '0']);

        Notification::make()->title('Настройки сохранены')->success()->send();
    }
}
