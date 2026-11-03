<?php

namespace App\Filament\Resources\DictionaryCategories;

use App\Filament\Resources\DictionaryCategories\Pages\CreateDictionaryCategory;
use App\Filament\Resources\DictionaryCategories\Pages\EditDictionaryCategory;
use App\Filament\Resources\DictionaryCategories\Pages\ListDictionaryCategories;
use App\Models\DictionaryCategory;
use BackedEnum;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\TextInput;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Grouping\Group;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\HtmlString;
use UnitEnum;

class DictionaryCategoryResource extends Resource
{
    protected static ?string $model = DictionaryCategory::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedFolder;

    protected static string|UnitEnum|null $navigationGroup = 'Словари';

    protected static ?int $navigationSort = 2;

    protected static ?string $navigationLabel = 'Категории';

    protected static ?string $modelLabel = 'категория';

    protected static ?string $pluralModelLabel = 'Категории';

    protected static ?string $recordTitleAttribute = 'name';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Select::make('dictionary_id')
                ->relationship('dictionary', 'name')
                ->required()
                ->searchable()
                ->preload()
                ->live(),
            Select::make('parent_id')
                ->label('Parent')
                ->options(function (callable $get) {
                    $dictionaryId = $get('dictionary_id');
                    if (! $dictionaryId) {
                        return [];
                    }

                    return DictionaryCategory::query()
                        ->where('dictionary_id', $dictionaryId)
                        ->orderBy('order')
                        ->pluck('name', 'id');
                })
                ->searchable()
                ->nullable(),
            TextInput::make('name')->required()->maxLength(255),
            TextInput::make('order')->numeric()->default(0),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')->label('ID'),
                TextColumn::make('dictionary.name')->label('Словарь')->searchable()->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('name')->label('Категория')->searchable()->wrap()->html()
                    ->formatStateUsing(fn (string $state, DictionaryCategory $record, ListDictionaryCategories $livewire): HtmlString => new HtmlString(
                        '<span style="white-space: pre">'.e($livewire->categoryTree()->prefixFor($record->id)).'</span>'.e($state),
                    )),
                TextColumn::make('parent.name')->label('Родитель')->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('order')->label('Порядок'),
                TextColumn::make('words_count')->counts('words')->label('Слов'),
            ])
            ->modifyQueryUsing(fn (Builder $query): Builder => $query->with(['dictionary', 'parent']))
            ->groups([Group::make('dictionary_id')->label('Словарь')
                ->getTitleFromRecordUsing(fn (DictionaryCategory $record): string => $record->dictionary?->name ?? 'Словарь #'.$record->dictionary_id)
                ->titlePrefixedWithLabel(false)->collapsible()])
            ->defaultGroup('dictionary_id')->groupingSettingsHidden()
            ->defaultSort(fn (Builder $query, ListDictionaryCategories $livewire): Builder => $livewire->orderCategoriesAsTree($query))
            ->defaultPaginationPageOption(50)
            ->filters([
                SelectFilter::make('dictionary_id')
                    ->label('Словарь')
                    ->relationship('dictionary', 'name')
                    ->searchable()
                    ->preload(),
            ])
            ->recordActions([EditAction::make()])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListDictionaryCategories::route('/'),
            'create' => CreateDictionaryCategory::route('/create'),
            'edit' => EditDictionaryCategory::route('/{record}/edit'),
        ];
    }
}
