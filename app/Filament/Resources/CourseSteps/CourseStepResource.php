<?php

namespace App\Filament\Resources\CourseSteps;

use App\Models\CourseStep;
use App\Services\CourseCatalog;
use BackedEnum;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use UnitEnum;

class CourseStepResource extends Resource
{
    protected static ?string $model = CourseStep::class;
    protected static string|BackedEnum|null $navigationIcon = 'heroicon-o-academic-cap';
    protected static string|UnitEnum|null $navigationGroup = 'Путь курса';
    protected static ?int $navigationSort = 2;
    protected static ?string $navigationLabel = 'Этапы курса';
    protected static ?string $modelLabel = 'этап курса';
    protected static ?string $pluralModelLabel = 'Этапы курса';
    protected static ?string $recordTitleAttribute = 'title';

    public static function canViewAny(): bool { return (bool) auth()->user()?->hasAnyRole(['super_admin', 'admin']); }
    public static function canCreate(): bool { return static::canViewAny(); }
    public static function canEdit($record): bool { return static::canViewAny(); }
    public static function canDelete($record): bool { return static::canViewAny(); }

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('title')->label('Название')->required()->maxLength(255),
            Select::make('group_id')->label('Группа')->options(fn () => \App\Models\CourseGroup::with('category')->orderBy('level')->orderBy('position')->get()->mapWithKeys(fn ($group) => [$group->id => $group->level.' · '.$group->display_title]))->searchable()->live()
                ->afterStateUpdated(function ($state, callable $set) { if ($group = \App\Models\CourseGroup::find($state)) $set('level', $group->level); })
                ->helperText('Можно перенести этап в другую группу. Уровень берётся из группы.'),
            Select::make('level')->label('Уровень')->options(array_combine(['A1','A2','B1','B2'], ['A1','A2','B1','B2']))->required()->default('A1'),
            Select::make('kind')->label('Тип этапа')->options(['category' => 'Категория словаря', 'grammar' => 'Грамматическая таблица'])->required()->live()->default('category'),
            Select::make('dictionary_id')->label('Словарь')->relationship('dictionary', 'name')->searchable()->preload()->live()
                ->afterStateUpdated(fn (callable $set) => $set('category_id', null))
                ->visible(fn (callable $get) => $get('kind') === 'category')->required(fn (callable $get) => $get('kind') === 'category'),
            Select::make('category_id')->label('Категория (2-й или 3-й уровень)')
                ->options(fn (callable $get) => CourseCatalog::categoryOptions((int) $get('dictionary_id')))->searchable()
                ->visible(fn (callable $get) => $get('kind') === 'category')->required(fn (callable $get) => $get('kind') === 'category'),
            Select::make('grammar_table_id')->label('Таблица')->options(fn () => CourseCatalog::grammarOptions())->searchable()
                ->visible(fn (callable $get) => $get('kind') === 'grammar')->required(fn (callable $get) => $get('kind') === 'grammar'),
            Select::make('custom_component')->label('Встроенный тренажёр (временно)')->options(CourseStep::CUSTOM_COMPONENTS)
                ->helperText('Показать вместо картинки таблицы интерактивный компонент. Необязательно, черновой набор — состав будет меняться.')
                ->visible(fn (callable $get) => $get('kind') === 'grammar'),
            TextInput::make('position')->label('Порядок внутри группы')->numeric()->minValue(0)->default(10)->required(),
            Toggle::make('is_published')->label('Опубликован')->default(true),
            Textarea::make('description')->label('Описание')->columnSpanFull(),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('level')->label('Уровень')->sortable(),
            TextColumn::make('group.display_title')->label('Группа')->wrap(),
            TextColumn::make('position')->label('Порядок')->sortable(),
            TextColumn::make('title')->label('Название')->searchable()->wrap(),
            TextColumn::make('kind')->label('Тип')->formatStateUsing(fn ($state) => $state === 'grammar' ? 'Грамматика' : 'Словарь'),
            TextColumn::make('custom_component')->label('Тренажёр')->formatStateUsing(fn ($state) => $state ? (CourseStep::CUSTOM_COMPONENTS[$state] ?? $state) : '—'),
            TextColumn::make('dictionary.name')->label('Словарь')->wrap(),
            TextColumn::make('category.name')->label('Категория')->wrap(),
            IconColumn::make('is_published')->label('Опубликован')->boolean(),
        ])->defaultSort('position')->reorderable('position')->filters([
            SelectFilter::make('group_id')->label('Группа')->options(fn () => \App\Models\CourseGroup::with('category')->get()->mapWithKeys(fn ($group) => [$group->id => $group->level.' · '.$group->display_title])),
            SelectFilter::make('level')->label('Уровень')->options(array_combine(['A1','A2','B1','B2'], ['A1','A2','B1','B2'])),
            SelectFilter::make('kind')->label('Тип')->options(['category'=>'Словарь','grammar'=>'Грамматика']),
        ])->recordActions([EditAction::make(), DeleteAction::make()]);
    }

    public static function getPages(): array
    {
        return ['index' => Pages\ListCourseSteps::route('/'), 'create' => Pages\CreateCourseStep::route('/create'), 'edit' => Pages\EditCourseStep::route('/{record}/edit')];
    }
}
