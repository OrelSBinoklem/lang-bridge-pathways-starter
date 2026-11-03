<?php

namespace App\Filament\Resources\Dictionaries\Concerns;

use App\Models\Dictionary;
use App\Services\DictionaryUpdateService;
use Filament\Actions\Action;
use Filament\Forms\Components\FileUpload;
use Filament\Forms\Components\TextInput;
use Filament\Forms\Components\Toggle;
use Filament\Notifications\Notification;
use Illuminate\Support\Facades\Storage;

trait HandlesDictionaryJsonUpload
{
    /**
     * @return array<int, \Filament\Forms\Components\Component>
     */
    protected static function dictionaryJsonUploadForm(): array
    {
        return [
            TextInput::make('name')
                ->label('Name')
                ->maxLength(255)
                ->helperText('Пусто = оставить текущее название'),
            TextInput::make('lang')->label('Lang')->maxLength(10),
            TextInput::make('learn_lang')->label('Learn lang')->maxLength(10),
            TextInput::make('level')->numeric(),
            TextInput::make('max_level')->numeric(),
            Toggle::make('sound')->default(false),
            Toggle::make('auto_levels')->label('Auto levels from JSON')->default(true),
            FileUpload::make('json_file')
                ->label('JSON file')
                ->acceptedFileTypes(['application/json', 'text/plain', 'text/json'])
                ->disk('local')
                ->directory('dictionary-imports')
                ->required(),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     * @return array{0: string, 1: array<string, mixed>, 2: string}|null
     */
    protected static function parseJsonUpload(array $data): ?array
    {
        $path = $data['json_file'] ?? null;
        if (! is_string($path) || $path === '') {
            Notification::make()->title('JSON file required')->danger()->send();

            return null;
        }

        $contents = @file_get_contents(Storage::disk('local')->path($path));
        if ($contents === false) {
            Notification::make()->title('Cannot read uploaded file')->danger()->send();

            return null;
        }

        $meta = [
            'sound' => ! empty($data['sound']),
            'auto_levels' => ! empty($data['auto_levels']),
            'use_json_word_count' => true,
        ];
        foreach (['name', 'lang', 'learn_lang', 'level', 'max_level'] as $key) {
            if (isset($data[$key]) && $data[$key] !== '' && $data[$key] !== null) {
                $meta[$key] = $data[$key];
            }
        }

        return [$contents, $meta, $path];
    }

    protected static function makeUpdateJsonAction(): Action
    {
        return Action::make('updateJson')
            ->label('Обновить из JSON')
            ->icon('heroicon-o-arrow-path')
            ->color('primary')
            ->modalHeading('Обновить словарь из JSON')
            ->modalDescription('Совпадающие латышские слова в рамках категории 2-го уровня обновляются без потери прогресса. Новые слова создаются, отсутствующие в JSON — удаляются.')
            ->form(self::dictionaryJsonUploadForm())
            ->action(function (Dictionary $record, array $data) {
                $parsed = self::parseJsonUpload($data);
                if ($parsed === null) {
                    return;
                }
                [$contents, $meta, $path] = $parsed;
                try {
                    $stats = app(DictionaryUpdateService::class)->updateFromJson($record, $contents, $meta);
                    Storage::disk('local')->delete($path);
                    Notification::make()
                        ->title('Словарь обновлён')
                        ->body(sprintf(
                            'updated: %d · created: %d · deleted: %d · categories: %d · words: %d',
                            $stats['updated'],
                            $stats['created'],
                            $stats['deleted'],
                            $stats['categories_synced'],
                            $stats['words'],
                        ))
                        ->success()
                        ->send();
                } catch (\Throwable $e) {
                    Notification::make()->title('Update failed')->body($e->getMessage())->danger()->send();
                }
            });
    }

    protected static function makeReplaceJsonAction(): Action
    {
        return Action::make('replaceJson')
            ->label('Заменить полностью')
            ->icon('heroicon-o-exclamation-triangle')
            ->color('danger')
            ->requiresConfirmation()
            ->modalHeading('Полная замена словаря')
            ->modalDescription('Все текущие слова и категории будут удалены, затем импортирован новый JSON. Прогресс пользователей по старым словам будет потерян.')
            ->form(self::dictionaryJsonUploadForm())
            ->action(function (Dictionary $record, array $data) {
                $parsed = self::parseJsonUpload($data);
                if ($parsed === null) {
                    return;
                }
                [$contents, $meta, $path] = $parsed;
                try {
                    $stats = app(DictionaryUpdateService::class)->replaceFromJson($record, $contents, $meta);
                    Storage::disk('local')->delete($path);
                    Notification::make()
                        ->title('Словарь заменён')
                        ->body(sprintf(
                            'created: %d · deleted: %d · categories: %d · words: %d',
                            $stats['created'],
                            $stats['deleted'],
                            $stats['categories_synced'],
                            $stats['words'],
                        ))
                        ->success()
                        ->send();
                } catch (\Throwable $e) {
                    Notification::make()->title('Replace failed')->body($e->getMessage())->danger()->send();
                }
            });
    }
}
