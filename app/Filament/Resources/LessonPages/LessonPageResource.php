<?php

namespace App\Filament\Resources\LessonPages;

use App\Models\CourseStep;
use App\Models\CourseGroup;
use App\Models\Dictionary;
use App\Models\LessonPage;
use App\Services\CourseCatalog;
use BackedEnum;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Repeater;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Schemas\Components\Section;
use Filament\Forms\Components\TagsInput;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use UnitEnum;

class LessonPageResource extends Resource
{
    protected static ?string $model = LessonPage::class;
    protected static string|BackedEnum|null $navigationIcon = 'heroicon-o-document-text';
    protected static string|UnitEnum|null $navigationGroup = 'Путь курса';
    protected static ?int $navigationSort = 3;
    protected static ?string $navigationLabel = 'Страницы уроков';
    protected static ?string $modelLabel = 'страница урока';
    protected static ?string $pluralModelLabel = 'Страницы уроков';
    protected static ?string $recordTitleAttribute = 'title';

    public static function canViewAny(): bool { return (bool) auth()->user()?->hasAnyRole(['super_admin', 'admin']); }
    public static function canCreate(): bool { return static::canViewAny(); }
    public static function canEdit($record): bool { return static::canViewAny(); }
    public static function canDelete($record): bool { return static::canViewAny(); }

    private static function binaryQuestions(): Repeater
    {
        $grammarQuestion = fn (callable $get) => isset(\App\Services\GrammarTask::KINDS[$get('../../task_kind') ?? '']);
        $grammarVariant = fn (callable $get) => isset(\App\Services\GrammarTask::KINDS[$get('config.task_kind') ?? '']);
        return Repeater::make('config.questions')->label('Вопросы задания')
            ->schema([
                Textarea::make('statement')->label('Утверждение')->required()->rows(2)->visible(fn (callable $get) => !$grammarQuestion($get)),
                Toggle::make('correct')->label('Верный ответ: да')->default(true)->visible(fn (callable $get) => !$grammarQuestion($get)),
                Textarea::make('prompt')->label('Задание / предложение')->required()->rows(2)->visible($grammarQuestion)
                    ->helperText('Для пропуска: {{blank}}. Для исправления: предложение с ошибкой.'),
                TagsInput::make('options')->label('Варианты селекта')->visible(fn (callable $get) => $get('../../task_kind') === 'grammar_select'),
                Repeater::make('tokens')->label('Слова для сборки (перемешанные)')->simple(TextInput::make('word')->required())
                    ->defaultItems(0)->minItems(2)->maxItems(30)->visible(fn (callable $get) => $get('../../task_kind') === 'grammar_order'),
                TagsInput::make('accepted_answers')->label('Допустимые ответы')->required()->visible($grammarQuestion),
                TextInput::make('explanation')->label('Пояснение после ответа')->maxLength(500),
            ])
            ->defaultItems(10)->minItems(fn (callable $get) => $grammarVariant($get) ? 1 : 3)
            ->maxItems(fn (callable $get) => $grammarVariant($get) ? 30 : 10)
            ->addable(true)->deletable(true)->reorderable(false)
            ->columns(3);
    }

    private static function groupOptions(): array
    {
        return CourseGroup::query()->with('category')->orderBy('level')->orderBy('position')->get()
            ->mapWithKeys(fn (CourseGroup $group) => [$group->id => "{$group->level} - {$group->display_title}"])
            ->all();
    }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Select::make('course_group_id')->label('Группа пути курса')->options(fn () => self::groupOptions())->searchable()->live()
                ->afterStateUpdated(function (callable $set, $state) {
                    $group = CourseGroup::find($state);
                    if (!$group) return;
                    $set('level', $group->level);
                    $set('learn_lang', $group->learn_lang);
                })
                ->helperText('Для свободного старого урока оставьте пустым.'),
            Select::make('skill')->label('Навык')->live()
                ->default(static::class === \App\Filament\Resources\GrammarTopics\GrammarTopicResource::class ? 'grammar' : null)
                ->disabled(static::class === \App\Filament\Resources\GrammarTopics\GrammarTopicResource::class)->dehydrated()->options([
                'listening' => 'Слушанье', 'reading' => 'Чтение', 'writing' => 'Письмо', 'speaking' => 'Говорение', 'grammar' => 'Грамматика',
            ])->required(fn (callable $get) => filled($get('course_group_id'))),
            TextInput::make('title')->label('Название')->required()->maxLength(255)->live(onBlur: true)
                ->afterStateUpdated(fn (callable $set, callable $get, string $context) => $context === 'create' ? $set('slug', \Illuminate\Support\Str::slug($get('title'))) : null),
            TextInput::make('slug')->label('Slug (в адресе /lessons/...)')->required()->maxLength(255)->unique(ignoreRecord: true),
            Select::make('level')->label('Уровень')->options(array_combine(['A1', 'A2', 'B1', 'B2'], ['A1', 'A2', 'B1', 'B2']))->nullable(),
            Select::make('learn_lang')->label('Язык')->options(['lv' => 'Латышский'])->default('lv')->required(),
            Select::make('status')->label('Статус')->options([
                'draft' => 'Черновик', 'generating' => 'Генерируется', 'review' => 'На проверке',
                'approved' => 'Одобрена', 'published' => 'Опубликована', 'archived' => 'В архиве',
            ])->default('draft')->required(),
            Toggle::make('is_published')->label('Доступна ученикам')->default(false)
                ->helperText('Публикуйте только после проверки всех вариантов и аудио.'),
            Textarea::make('description')->label('Описание')->columnSpanFull(),
            Section::make('Грамматическая тема')->relationship('grammarTopic')
                ->visible(fn (callable $get) => $get('skill') === 'grammar')
                ->schema([
                    Textarea::make('rule')->label('Правило и схема предложения')->required()->rows(4),
                    Select::make('table_keys')->label('Связанные таблицы')->multiple()->searchable()
                        ->options(fn () => \App\Models\GrammarTopic::tableOptions()),
                    Repeater::make('examples')->label('Примеры')->schema([
                        TextInput::make('text')->label('На латышском')->required(),
                        TextInput::make('translation')->label('Перевод')->required(),
                    ])->columns(2)->defaultItems(0),
                ])->columnSpanFull(),
            Repeater::make('blocks')->relationship('blocks')->label('Блоки')->orderColumn('position')
                ->schema([
                    Select::make('type')->label('Тип блока')->live()->required()->options([
                        'words' => 'Тренировка слов',
                        'custom_category' => 'Кастомная категория',
                        'listening' => 'Слушанье',
                        'reading' => 'Чтение',
                        'writing' => 'Письмо (с ИИ)',
                        'speaking' => 'Говорение (с ИИ)',
                        'grammar' => 'Грамматика (автопроверка)',
                    ]),
                    TextInput::make('title')->label('Заголовок блока')->maxLength(255),
                    Select::make('source_block_id')->label('Подэтап из грамматической таблицы')->searchable()->live()
                        ->options(fn () => \App\Models\LessonBlock::query()->with('page')->where('type', 'grammar')->whereNull('source_block_id')
                            ->whereHas('page', fn ($query) => $query->where('skill', 'grammar')->where('status', 'published')->where('is_published', true))
                            ->get()->mapWithKeys(fn ($block) => [$block->id => "{$block->page->level} · {$block->page->title} / {$block->title}"])->all())
                        ->visible(fn (callable $get) => $get('type') === 'grammar')
                        ->helperText('Выберите одно подзадание, не всю страницу. Ответы, прогресс и откаты общие с исходным подэтапом. Пусто — собственное задание.'),
                    Toggle::make('is_required')->label('Обязательный для зачёта')->default(true),
                    TextInput::make('weight')->label('Вес в уроке')->numeric()->minValue(1)->maxValue(1000)->default(100),
                    Textarea::make('bot_prompt')->label('Общие правила для репетитора')->rows(4)
                        ->helperText('Не показываются как текст задания. Правила конкретного варианта указываются ниже.')
                        ->visible(fn (callable $get) => in_array($get('type'), ['writing', 'speaking'], true)),

                    Select::make('config.dictionary_id')->label('Словарь')->options(fn () => Dictionary::query()->orderBy('name')->pluck('name', 'id')->all())->searchable()->preload()->live()
                        ->afterStateUpdated(fn (callable $set) => $set('config.category_id', null))
                        ->visible(fn (callable $get) => $get('type') === 'words')->required(fn (callable $get) => $get('type') === 'words'),
                    Select::make('config.category_id')->label('Категория')
                        ->options(fn (callable $get) => CourseCatalog::categoryOptions((int) $get('config.dictionary_id')))->searchable()
                        ->visible(fn (callable $get) => $get('type') === 'words')->required(fn (callable $get) => $get('type') === 'words'),

                    Select::make('config.component_key')->label('Компонент')->options(CourseStep::CUSTOM_COMPONENTS)
                        ->visible(fn (callable $get) => $get('type') === 'custom_category')->required(fn (callable $get) => $get('type') === 'custom_category'),

                    Repeater::make('variants')->relationship('variants')->label('Варианты задания')->orderColumn('position')
                        ->visible(fn (callable $get) => !filled($get('source_block_id')))
                        // Imported variants are zero-based; fixed slots must not be renumbered by Filament.
                        ->mutateRelationshipDataBeforeSaveUsing(fn (array $data, \App\Models\LessonBlockVariant $record) => [...$data, 'position' => $record->position])
                        ->schema([
                            TextInput::make('title')->label('Название варианта')->maxLength(255),
                            Toggle::make('is_published')->label('Доступен')->default(true),
                            TextInput::make('practice_archived_at')->label('Архив дополнительной практики')->disabled()->dehydrated(false)
                                ->visible(fn (callable $get) => filled($get('practice_archived_at')))
                                ->helperText('Сохранён для редактора вместе с озвучкой и историей. Ученику предлагаются три отобранных варианта.'),
                            Select::make('config.task_kind')->label('Вид задания')->live()->options([
                                'listening' => 'Аудирование: 3–10 утверждений',
                                'reading_binary' => 'Чтение: 3–10 утверждений',
                                'lv_to_ru' => 'Чтение: перевод с латышского',
                                'ru_to_lv' => 'Письмо: перевод на латышский',
                                'image_description' => 'Письмо: описание изображения',
                                'question_formation' => 'Формирование вопросов',
                                'roleplay' => 'Говорение: ролевая беседа',
                                ...\App\Services\GrammarTask::KINDS,
                            ])->required(),
                            TextInput::make('config.audio_url')->label('Ссылка на аудио')->visible(fn (callable $get) => $get('config.task_kind') === 'listening'),
                            Repeater::make('config.dialogue_segments')->label('Реплики для озвучки')
                                ->schema([
                                    Select::make('speaker')->label('Голос')->options(['a' => 'A', 'b' => 'B'])->required(),
                                    Textarea::make('text')->label('Реплика на латышском')->rows(2)->required(),
                                ])
                                ->columns(2)->reorderable()->addActionLabel('Добавить реплику')
                                ->visible(fn (callable $get) => $get('config.task_kind') === 'listening'),
                            Textarea::make('config.transcript')->label('Транскрипт')->rows(4)->visible(fn (callable $get) => $get('config.task_kind') === 'listening'),
                            self::binaryQuestions()->visible(fn (callable $get) => in_array($get('config.task_kind'), ['listening', 'reading_binary'], true) || (isset(\App\Services\GrammarTask::KINDS[$get('config.task_kind') ?? '']) && $get('config.task_kind') !== 'grammar_items')),
                            Repeater::make('config.assisted_questions')->label('Русские вопросы: облегчённый режим')
                                ->simple(Textarea::make('translation')->required()->rows(2))
                                ->defaultItems(0)->maxItems(fn (callable $get) => count($get('config.questions') ?? []))->reorderable(false)
                                ->minItems(fn (callable $get) => filled($get('config.assisted_questions')) ? count($get('config.questions') ?? []) : 0)
                                ->dehydrated(fn ($state) => filled($state))
                                ->visible(fn (callable $get) => in_array($get('config.task_kind'), ['listening', 'reading_binary'], true))
                                ->helperText('Тот же смысл и порядок, что у латышских вопросов. Зачёт в этом режиме ×0,8.'),
                            Repeater::make('config.items')->label('Поэлементная тренировка')
                                ->schema([
                                    TextInput::make('key')->label('Постоянный ключ')->required(),
                                    TextInput::make('letter')->label('Буква')->required(),
                                    TextInput::make('hint')->label('Русская подсказка')->required(),
                                ])->columns(3)->defaultItems(0)->minItems(1)->maxItems(40)
                                ->visible(fn (callable $get) => $get('config.task_kind') === 'grammar_items'),
                            Textarea::make('config.text')->label('Текст для чтения')->rows(7)->visible(fn (callable $get) => $get('config.task_kind') === 'reading_binary'),
                            Textarea::make('config.source_text')->label('Текст на латышском')->rows(5)->visible(fn (callable $get) => $get('config.task_kind') === 'lv_to_ru'),
                            Textarea::make('config.reference_translation')->label('Эталонный перевод для проверки')->rows(5)->visible(fn (callable $get) => $get('config.task_kind') === 'lv_to_ru'),
                            Textarea::make('config.instruction')->label('Инструкция ученику')->rows(4)->visible(fn (callable $get) => in_array($get('config.task_kind'), ['ru_to_lv', 'image_description', 'question_formation', 'roleplay'], true) || isset(\App\Services\GrammarTask::KINDS[$get('config.task_kind') ?? ''])),
                            TextInput::make('config.image_url')->label('Изображение')->url()->visible(fn (callable $get) => $get('config.task_kind') === 'image_description'),
                            Textarea::make('config.tutor_prompt')->label('Правила репетитору для этого варианта')->rows(5)
                                ->visible(fn (callable $get) => in_array($get('config.task_kind'), ['ru_to_lv', 'image_description', 'question_formation', 'roleplay'], true)),
                        ])
                        ->defaultItems(fn (callable $get) => $get('type') === 'grammar' ? 1 : 5)
                        ->minItems(fn (callable $get) => $get('type') === 'grammar' ? 1 : 5)
                        ->maxItems(5)
                        ->addable(fn (callable $get) => $get('type') === 'grammar')
                        ->deletable(fn (callable $get) => $get('type') === 'grammar')
                        ->reorderable(false)
                        ->itemLabel(fn (array $state) => ($state['title'] ?? 'Вариант').(!empty($state['practice_archived_at']) ? ' · Архив' : ''))
                        ->collapsible()->collapsed(fn (callable $get) => $get('type') === 'grammar')->columnSpanFull(),
                ])
                ->itemLabel(fn (array $state) => ($state['title'] ?: null) ?? ($state['type'] ?? 'Блок'))
                ->collapsible()->defaultItems(0)->addActionLabel('Добавить блок')->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('title')->label('Название')->searchable(),
            TextColumn::make('slug')->label('Slug'),
            TextColumn::make('courseGroup.display_title')->label('Группа')->wrap(),
            TextColumn::make('skill')->label('Навык'),
            TextColumn::make('status')->label('Статус'),
            TextColumn::make('level')->label('Уровень'),
            TextColumn::make('blocks_count')->label('Блоков')->counts('blocks'),
            IconColumn::make('is_published')->label('Опубликована')->boolean(),
        ])->defaultSort('title')->recordActions([
            \Filament\Actions\Action::make('contentAudit')->label('Лексика')->icon('heroicon-o-chart-bar')
                ->url(fn (LessonPage $record) => \App\Filament\Pages\ContentAudit::getUrl(['lesson' => $record->id]))->openUrlInNewTab(),
            EditAction::make(), DeleteAction::make(),
        ]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ListLessonPages::route('/'), 'create' => Pages\CreateLessonPage::route('/create'), 'edit' => Pages\EditLessonPage::route('/{record}/edit')];
    }
}
