<?php

namespace App\Filament\Resources\Dictionaries\Pages;

use App\Filament\Resources\Dictionaries\DictionaryResource;
use App\Services\DictionaryImportService;
use Filament\Actions\Action;
use Filament\Actions\CreateAction;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Support\Facades\Storage;

class ListDictionaries extends ListRecords
{
    protected static string $resource = DictionaryResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('importJson')
                ->label('Import JSON')
                ->icon('heroicon-o-arrow-up-tray')
                ->form([
                    TextInput::make('name')->required()->maxLength(255),
                    TextInput::make('lang')->required()->maxLength(10)->default('RU'),
                    TextInput::make('learn_lang')->required()->maxLength(10)->helperText('lv или en'),
                    TextInput::make('level')->numeric()->default(1),
                    TextInput::make('max_level')->numeric()->default(1),
                    Toggle::make('sound')->default(false),
                    Toggle::make('auto_levels')->label('Auto levels from JSON')->default(true),
                    Toggle::make('use_json_word_count')->label('Use word count from JSON')->default(true),
                    FileUpload::make('json_file')
                        ->label('JSON file')
                        ->acceptedFileTypes(['application/json', 'text/plain', 'text/json'])
                        ->disk('local')
                        ->directory('dictionary-imports')
                        ->required(),
                ])
                ->action(function (array $data) {
                    $path = $data['json_file'] ?? null;
                    if (! is_string($path) || $path === '') {
                        Notification::make()->title('JSON file required')->danger()->send();

                        return;
                    }

                    $contents = file_get_contents(Storage::disk('local')->path($path));
                    if ($contents === false) {
                        Notification::make()->title('Cannot read uploaded file')->danger()->send();

                        return;
                    }

                    try {
                        $dictionary = app(DictionaryImportService::class)->importFromJson($contents, $data);
                        Storage::disk('local')->delete($path);
                        Notification::make()
                            ->title('Dictionary imported')
                            ->body("#{$dictionary->id} {$dictionary->name} ({$dictionary->words} words)")
                            ->success()
                            ->send();

                        $this->redirect(DictionaryResource::getUrl('edit', ['record' => $dictionary]));
                    } catch (\Throwable $e) {
                        Notification::make()->title('Import failed')->body($e->getMessage())->danger()->send();
                    }
                }),
            CreateAction::make(),
        ];
    }
}
