<?php

namespace App\Filament\Resources\Exams;

use App\Models\CourseExam;
use BackedEnum;
use UnitEnum;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Forms\Components\{Hidden, TextInput, Textarea, Select, Toggle, Repeater, TagsInput};
use Filament\Tables\Table;
use Filament\Tables\Columns\{TextColumn, IconColumn};
use Filament\Actions\EditAction;
use Illuminate\Support\Facades\Auth;

class ExamResource extends Resource
{
    protected static ?string $model = CourseExam::class;
    protected static ?string $slug = 'exams';
    protected static ?string $navigationLabel = 'Экзамены A1–B2';
    protected static ?string $modelLabel = 'экзамен';
    protected static ?string $pluralModelLabel = 'Экзамены';
    protected static string|UnitEnum|null $navigationGroup = 'Путь курса';
    protected static string|BackedEnum|null $navigationIcon = 'heroicon-o-academic-cap';
    public static function canViewAny(): bool { return Auth::user()?->isFrontendAdmin() ?? false; }
    public static function canCreate(): bool { return static::canViewAny(); }
    public static function canView($record): bool { return static::canViewAny(); }
    public static function canEdit($record): bool { return static::canViewAny(); }
    public static function canDelete($record): bool { return false; }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Select::make('level')->options(array_combine(['A1','A2','B1','B2'], ['A1','A2','B1','B2']))->required(),
            Select::make('learn_lang')->label('Язык экзамена')->options(['lv' => 'Латышский', 'en' => 'Английский'])->default('lv')->required()->disabled(fn ($record) => $record !== null)->dehydrated(),
            TextInput::make('title')->label('Название')->required(),
            Toggle::make('is_published')->label('Доступен ученикам'),
        ]);
    }

    public static function variantFields(): array
    {
        return [
                TextInput::make('title')->label('Название варианта')->required(),
                Hidden::make('content.level'),
                Hidden::make('content.language'),
                Hidden::make('content.title'),
                Toggle::make('is_published')->label('Опубликован')->helperText('Публикация проверяет структуру, ключи и наличие озвучки.'),
                Repeater::make('content.sections')->label('Части экзамена')->columnSpanFull()->minItems(4)->maxItems(4)->collapsed()->itemLabel(fn ($state) => $state['skill'] ?? 'Часть')->schema([
                    Select::make('skill')->options(['listening'=>'Слушание','reading'=>'Чтение','writing'=>'Письмо','speaking'=>'Говорение'])->required(),
                    TextInput::make('seconds')->label('Время, секунд')->numeric()->integer()->required()->minValue(60)->maxValue(7200),
                    Repeater::make('tasks')->label('Задания')->collapsed()->itemLabel(fn ($state) => $state['title'] ?? 'Задание')->schema([
                        TextInput::make('id')->label('Постоянный ID')->required(),
                        TextInput::make('title')->label('Заголовок')->required(),
                        Textarea::make('text')->label('Текст / инструкция')->rows(5),
                        TextInput::make('image')->label('URL изображения'),
                        Repeater::make('visuals')->label('Изображения / слайды')->helperText('При замене фотографии обновите её описание в критериях AI-проверки. Критерии скрыты во время экзамена.')->maxItems(6)->collapsed()->schema([
                            TextInput::make('title')->label('Заголовок')->required(),
                            Textarea::make('text')->label('Видимый текст слайда'),
                            TextInput::make('image')->label('Изображение: /course/exams/visuals/...'),
                            TextInput::make('credit')->label('Автор фотографии'),
                            Repeater::make('bars')->label('Диаграмма, проценты')->schema([
                                TextInput::make('label')->label('Подпись')->required(),
                                TextInput::make('value')->label('%')->numeric()->minValue(0)->maxValue(100)->required(),
                            ]),
                            Textarea::make('chart_note')->label('Источник / примечание к диаграмме'),
                        ]),
                        TextInput::make('audio_path')->label('Приватный MP3: exams/...mp3'),
                        TextInput::make('audio_seconds')->label('Длительность аудио')->numeric(),
                        Hidden::make('audio_generation'),
                        Textarea::make('transcript')->label('Расшифровка (после экзамена)')->rows(5),
                        Repeater::make('segments')->label('Реплики для ElevenLabs')->collapsed()->schema([
                            Select::make('speaker')->options(['male'=>'Мужчина','female'=>'Женщина'])->required(),
                            Select::make('voice_key')->label('Голос')->options(function () {
                                $catalog = json_decode(file_get_contents(resource_path('course/voice-previews/shortlist.json')), true, flags: JSON_THROW_ON_ERROR);
                                $options = [];
                                foreach ($catalog['candidates'] as $voice) if (!empty($voice['voice_id']) && ($voice['library_status'] ?? '') !== 'preview_only') {
                                    $options[$voice['key']] = $voice['display_name'] ?? $voice['key'];
                                }
                                return $options;
                            }),
                            Select::make('delivery')->label('Подача')->options(['calm'=>'Спокойно', 'thoughtful'=>'Вдумчиво', 'friendly'=>'Дружелюбно']),
                            Select::make('pace')->label('Темп озвучки')->options(['slow' => 'Замедленная подача (требует проверки)']),
                            Textarea::make('text')->label('Текст на изучаемом языке')->required(),
                        ]),
                        Repeater::make('questions')->label('Вопросы')->collapsed()->itemLabel(fn ($state) => $state['prompt'] ?? 'Вопрос')->schema([
                            TextInput::make('id')->required(),
                            Select::make('type')->label('Формат')->options(['choice'=>'Выбор / сопоставление / пропуск','short'=>'Короткий ответ','essay'=>'Письмо с AI-проверкой','speaking'=>'Устный ответ'])->required(),
                            Textarea::make('prompt')->label('Вопрос')->required(),
                            TextInput::make('image')->label('URL изображения'),
                            Hidden::make('audio_path'),
                            Hidden::make('audio_seconds'),
                            Hidden::make('audio_generation'),
                            TextInput::make('points')->label('Максимум баллов')->numeric()->minValue(0.1)->required(),
                            Repeater::make('options')->label('Варианты ответа')->schema([TextInput::make('id')->required(), TextInput::make('text')->label('Текст')->required()]),
                            TextInput::make('correct')->label('ID правильного варианта'),
                            TagsInput::make('accepted')->label('Допустимые короткие ответы'),
                            Textarea::make('explanation')->label('Объяснение ошибки'),
                            Textarea::make('explanation_translations.ru')->label('Перевод комментария: русский'),
                            Textarea::make('explanation_translations.uk')->label('Перевод комментария: украинский'),
                            Textarea::make('rubric')->label('Критерии AI-проверки'),
                        ]),
                    ]),
                ]),
        ];
    }

    public static function table(Table $table): Table
    {
        return $table->columns([TextColumn::make('level')->label('Уровень'), TextColumn::make('title')->label('Экзамен'), IconColumn::make('is_published')->label('Опубликован')->boolean()])->recordActions([
            \Filament\Actions\Action::make('variants')->label('Варианты и задания')->url(fn ($record) => ExamVariantResource::getUrl('index', ['filters'=>['course_exam_id'=>['value'=>$record->id]]])),
            \Filament\Actions\Action::make('archive')->label('Архив')->icon('heroicon-o-archive-box')->url(fn ($record) => ExamVariantArchiveResource::getUrl('index', ['filters'=>['level'=>['value'=>$record->level]]])),
            EditAction::make(),
        ]);
    }
    public static function getPages(): array { return ['index'=>Pages\ListExams::route('/'), 'create'=>Pages\CreateExam::route('/create'), 'edit'=>Pages\EditExam::route('/{record}/edit')]; }
}
