<?php

namespace App\Filament\Resources\DictionaryWords;

use App\Filament\Resources\DictionaryWords\Pages\CreateDictionaryWord;
use App\Filament\Resources\DictionaryWords\Pages\EditDictionaryWord;
use App\Filament\Resources\DictionaryWords\Pages\ListDictionaryWords;
use App\Models\Dictionary;
use App\Models\DictionaryCategory;
use App\Models\DictionaryWord;
use App\Support\DictionaryCategoryTree;
use BackedEnum;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\Select;
use Filament\Forms\Components\Textarea;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Components\Utilities\Get;
use Filament\Schemas\Components\Utilities\Set;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Enums\FiltersLayout;
use Filament\Tables\Filters\Filter;
use Filament\Tables\Table;
use Illuminate\Database\Eloquent\Builder;
use UnitEnum;

class DictionaryWordResource extends Resource
{
    protected static ?string $model = DictionaryWord::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedLanguage;

    protected static string|UnitEnum|null $navigationGroup = 'Словари';

    protected static ?int $navigationSort = 3;

    protected static ?string $navigationLabel = 'Слова';

    protected static ?string $modelLabel = 'Word';

    protected static ?string $recordTitleAttribute = 'word';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Select::make('dictionary_id')
                ->relationship('dictionary', 'name')
                ->required()
                ->searchable()
                ->preload()
                ->live(),
            Select::make('categories')
                ->relationship(
                    name: 'categories',
                    titleAttribute: 'name',
                    modifyQueryUsing: fn ($query, callable $get) => $query
                        ->when($get('dictionary_id'), fn ($q, $id) => $q->where('dictionary_id', $id))
                        ->orderBy('order'),
                )
                ->multiple()
                ->searchable()
                ->preload(),
            TextInput::make('word')->required()->maxLength(255),
            TextInput::make('learn_lang')->required()->maxLength(10),
            Toggle::make('is_phrase')->default(false),
            TextInput::make('translation_1')->required()->maxLength(255),
            TextInput::make('translation_2')->maxLength(255),
            TextInput::make('translation_3')->maxLength(255),
            Textarea::make('translation_input_variable')->columnSpanFull(),
            TextInput::make('difficult_translation')->maxLength(255),
            Textarea::make('info')->columnSpanFull(),
            TextInput::make('sound_url')->maxLength(255),
            TextInput::make('level')->numeric(),
            TextInput::make('max_level')->numeric()->default(1),
            TextInput::make('type')->maxLength(50),
            TextInput::make('gender')->maxLength(1),
            TextInput::make('order')->numeric()->default(0),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')->sortable(),
                TextColumn::make('dictionary.name')->sortable()->toggleable(),
                TextColumn::make('word')->searchable()->sortable(),
                TextColumn::make('translation_1')->searchable()->limit(40),
                TextColumn::make('learn_lang')->badge(),
                TextColumn::make('level')->sortable(),
                TextColumn::make('type')->toggleable(),
                IconColumn::make('is_phrase')->boolean()->toggleable(isToggledHiddenByDefault: true),
                TextColumn::make('order')->sortable()->toggleable(isToggledHiddenByDefault: true),
            ])
            ->defaultSort('id')
            ->filters([
                Filter::make('location')
                    ->label('Словарь и категория')
                    ->schema([
                        Select::make('dictionary_id')
                            ->label('Словарь')
                            ->placeholder('Все словари')
                            ->options(fn (): array => Dictionary::query()->orderBy('name')->pluck('name', 'id')->all())
                            ->searchable()->native(false)->live()
                            ->afterStateUpdated(fn (Set $set) => $set('category_id', null)),
                        Select::make('category_id')
                            ->label('Категория')
                            ->placeholder('Все категории')
                            ->options(function (Get $get): array {
                                $dictionaryId = $get('dictionary_id');
                                if (blank($dictionaryId)) {
                                    return [];
                                }

                                $categories = DictionaryCategory::query()
                                    ->where('dictionary_id', $dictionaryId)
                                    ->orderBy('order')->orderBy('id')
                                    ->get(['id', 'dictionary_id', 'parent_id', 'order', 'name']);
                                $tree = new DictionaryCategoryTree($categories);
                                $byId = $categories->keyBy('id');

                                return collect($tree->orderedIds())
                                    ->mapWithKeys(fn (int $id): array => [$id => $tree->prefixFor($id).$byId[$id]->name])
                                    ->all();
                            })
                            ->searchable()->native(false)->disabled(fn (Get $get): bool => blank($get('dictionary_id'))),
                    ])
                    ->columns(['default' => 1, 'md' => 2])
                    ->query(function (Builder $query, array $data): Builder {
                        $dictionaryId = filter_var($data['dictionary_id'] ?? null, FILTER_VALIDATE_INT) ?: null;
                        $categoryId = filter_var($data['category_id'] ?? null, FILTER_VALIDATE_INT) ?: null;

                        if ($dictionaryId) {
                            $query->where('dictionary_words.dictionary_id', $dictionaryId);
                        }

                        if (! $categoryId) {
                            return $query;
                        }

                        $category = DictionaryCategory::query()->find($categoryId);
                        if (! $category || ($dictionaryId && $category->dictionary_id !== $dictionaryId)) {
                            return $query->whereRaw('1 = 0');
                        }

                        $categories = DictionaryCategory::query()
                            ->where('dictionary_id', $category->dictionary_id)
                            ->orderBy('order')->orderBy('id')
                            ->get(['id', 'dictionary_id', 'parent_id', 'order']);
                        $categoryIds = (new DictionaryCategoryTree($categories))->descendantIdsFor($categoryId);

                        return $query
                            ->where('dictionary_words.dictionary_id', $category->dictionary_id)
                            ->whereHas('categories', fn (Builder $categoriesQuery): Builder => $categoriesQuery
                                ->whereIn('dictionary_categories.id', $categoryIds));
                    })
                    ->indicateUsing(function (array $data): array {
                        $indicators = [];
                        if ($dictionaryId = $data['dictionary_id'] ?? null) {
                            $indicators[] = 'Словарь: '.(Dictionary::query()->whereKey($dictionaryId)->value('name') ?? $dictionaryId);
                        }
                        if ($categoryId = $data['category_id'] ?? null) {
                            $indicators[] = 'Категория: '.(DictionaryCategory::query()->whereKey($categoryId)->value('name') ?? $categoryId);
                        }

                        return $indicators;
                    }),
            ])
            ->filtersLayout(FiltersLayout::AboveContent)
            ->filtersFormColumns(1)
            ->deferFilters(false)
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
            'index' => ListDictionaryWords::route('/'),
            'create' => CreateDictionaryWord::route('/create'),
            'edit' => EditDictionaryWord::route('/{record}/edit'),
        ];
    }
}
