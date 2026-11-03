<?php

namespace App\Filament\Resources\CourseGroups;

use App\Models\CourseGroup;
use App\Services\CourseCatalog;
use BackedEnum;
use Filament\Actions\DeleteAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Grouping\Group;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use UnitEnum;

class CourseGroupResource extends Resource
{
    protected static ?string $model = CourseGroup::class;
    protected static string|BackedEnum|null $navigationIcon = 'heroicon-o-rectangle-group';
    protected static string|UnitEnum|null $navigationGroup = 'Путь курса';
    protected static ?int $navigationSort = 1;
    protected static ?string $navigationLabel = 'Группы курса';
    protected static ?string $modelLabel = 'группа курса';
    protected static ?string $pluralModelLabel = 'Группы курса';
    public static function canViewAny(): bool { return (bool) auth()->user()?->hasAnyRole(['super_admin', 'admin']); }
    public static function canCreate(): bool { return static::canViewAny(); }
    public static function canEdit($record): bool { return static::canViewAny(); }
    public static function canDelete($record): bool { return static::canViewAny(); }
    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Select::make('dictionary_id')->label('Словарь')->relationship('dictionary', 'name')->searchable()->preload()->live()
                ->afterStateUpdated(fn (callable $set) => $set('category_id', null)),
            Select::make('category_id')->label('Категория группы')->options(fn (callable $get) => CourseCatalog::groupCategoryOptions((int) $get('dictionary_id')))->searchable()
                ->helperText('Название и картинка берутся из категории. Без категории можно создать вводную группу.'),
            TextInput::make('title')->label('Название для группы без категории')->maxLength(255),
            Select::make('level')->label('Уровень')->options(array_combine(['A1','A2','B1','B2'], ['A1','A2','B1','B2']))->default('A1')->required()
                ->helperText('При изменении уровня все этапы группы переходят вместе с ней.'),
            TextInput::make('learn_lang')->label('Изучаемый язык')->default('lv')->maxLength(10)->required(),
            TextInput::make('position')->label('Порядок внутри уровня')->numeric()->minValue(0)->default(10)->required(),
            Toggle::make('is_published')->label('Опубликована')->default(true)->helperText('Скрывает группу вместе с её этапами.'),
        ]);
    }
    public static function table(Table $table): Table
    {
        return $table->columns([
            TextColumn::make('position')->label('Порядок')->sortable(),
            TextColumn::make('display_title')->label('Группа')
                ->formatStateUsing(fn (string $state): string => '— '.$state)
                ->searchable(query: fn (Builder $query, string $search): Builder => $query->where(fn (Builder $query): Builder => $query
                    ->where('title', 'like', "%{$search}%")
                    ->orWhereHas('category', fn (Builder $category): Builder => $category->where('name', 'like', "%{$search}%"))))
                ->wrap(),
            TextColumn::make('steps_count')->counts('steps')->label('Этапов'),
            IconColumn::make('is_published')->label('Опубликована')->boolean(),
        ])->modifyQueryUsing(fn (Builder $query): Builder => $query->with('category'))
            ->groups([Group::make('level')->label('Уровень')->titlePrefixedWithLabel(false)->collapsible()])
            ->defaultGroup('level')->groupingSettingsHidden()
            ->defaultSort('position')->defaultPaginationPageOption(50)
            ->reorderable('position', fn ($livewire): bool => filled($livewire->getTableFilterState('level')['value'] ?? null))
            ->filters([
            SelectFilter::make('level')->options(array_combine(['A1','A2','B1','B2'], ['A1','A2','B1','B2'])),
        ])->recordActions([EditAction::make(), DeleteAction::make()->modalDescription('Этапы сохранятся и перейдут в раздел «Без группы».')]);
    }
    public static function getRelations(): array { return [RelationManagers\StepsRelationManager::class, RelationManagers\LessonPagesRelationManager::class]; }
    public static function getPages(): array
    {
        return ['index' => Pages\ListCourseGroups::route('/'), 'create' => Pages\CreateCourseGroup::route('/create'), 'edit' => Pages\EditCourseGroup::route('/{record}/edit')];
    }
}
