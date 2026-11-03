<?php

namespace App\Filament\Resources\Dictionaries;

use App\Filament\Resources\Dictionaries\Concerns\HandlesDictionaryJsonUpload;
use App\Filament\Resources\Dictionaries\Pages\CreateDictionary;
use App\Filament\Resources\Dictionaries\Pages\EditDictionary;
use App\Filament\Resources\Dictionaries\Pages\ListDictionaries;
use App\Models\Dictionary;
use BackedEnum;
use Filament\Actions\Action;
use Filament\Actions\BulkActionGroup;
use Filament\Actions\DeleteBulkAction;
use Filament\Actions\EditAction;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Support\Icons\Heroicon;
use Filament\Tables\Columns\IconColumn;
use Filament\Tables\Columns\TextColumn;
use Filament\Tables\Table;
use UnitEnum;

class DictionaryResource extends Resource
{
    use HandlesDictionaryJsonUpload;

    protected static ?string $model = Dictionary::class;

    protected static string|BackedEnum|null $navigationIcon = Heroicon::OutlinedBookOpen;

    protected static string|UnitEnum|null $navigationGroup = 'Словари';

    protected static ?string $navigationLabel = 'Словари';

    protected static ?int $navigationSort = 1;

    protected static ?string $recordTitleAttribute = 'name';

    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            TextInput::make('name')->required()->maxLength(255),
            TextInput::make('lang')->required()->maxLength(10)->helperText('Язык слов (например RU)'),
            TextInput::make('learn_lang')->required()->maxLength(10)->helperText('Язык интерфейса: lv / en'),
            TextInput::make('words')->numeric()->default(0)->disabled()->dehydrated(),
            TextInput::make('level')->numeric()->required()->default(1),
            TextInput::make('max_level')->numeric()->required()->default(1),
            Toggle::make('sound')->default(false),
            Toggle::make('is_listed')->label('Показывать в каталоге')->default(true)
                ->helperText('Скрытый словарь остаётся в админке и доступен по прямой ссылке. Слова и прогресс сохраняются.'),
        ]);
    }

    public static function table(Table $table): Table
    {
        return $table
            ->columns([
                TextColumn::make('id')->sortable(),
                TextColumn::make('name')->searchable()->sortable(),
                TextColumn::make('lang')->sortable(),
                TextColumn::make('learn_lang')->sortable()->badge(),
                TextColumn::make('words')->sortable(),
                TextColumn::make('level')->sortable(),
                TextColumn::make('max_level')->sortable(),
                IconColumn::make('sound')->boolean(),
                IconColumn::make('is_listed')->label('В каталоге')->boolean(),
            ])
            ->defaultSort('id')
            ->recordActions([
                Action::make('exportJson')
                    ->label('Export JSON')
                    ->icon('heroicon-o-arrow-down-tray')
                    ->url(fn (Dictionary $record): string => route('admin.dictionaries.export-json', $record))
                    ->openUrlInNewTab(false),
                self::makeUpdateJsonAction(),
                self::makeReplaceJsonAction(),
                EditAction::make(),
            ])
            ->toolbarActions([
                BulkActionGroup::make([
                    DeleteBulkAction::make(),
                ]),
            ]);
    }

    public static function getPages(): array
    {
        return [
            'index' => ListDictionaries::route('/'),
            'create' => CreateDictionary::route('/create'),
            'edit' => EditDictionary::route('/{record}/edit'),
        ];
    }
}
