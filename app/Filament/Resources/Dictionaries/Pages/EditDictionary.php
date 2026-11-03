<?php

namespace App\Filament\Resources\Dictionaries\Pages;

use App\Filament\Resources\Dictionaries\Concerns\HandlesDictionaryJsonUpload;
use App\Filament\Resources\Dictionaries\DictionaryResource;
use App\Models\Dictionary;
use App\Services\DictionaryUpdateService;
use Filament\Actions\Action;
use Filament\Actions\DeleteAction;
use Filament\Notifications\Notification;
use Filament\Resources\Pages\EditRecord;
use Illuminate\Support\Facades\Storage;

class EditDictionary extends EditRecord
{
    use HandlesDictionaryJsonUpload;

    protected static string $resource = DictionaryResource::class;

    protected function getHeaderActions(): array
    {
        return [
            Action::make('exportJson')
                ->label('Export JSON')
                ->icon('heroicon-o-arrow-down-tray')
                ->url(fn (): string => route('admin.dictionaries.export-json', $this->getRecord()))
                ->openUrlInNewTab(false),
            Action::make('updateJson')
                ->label('Обновить из JSON')
                ->icon('heroicon-o-arrow-path')
                ->color('primary')
                ->modalHeading('Обновить словарь из JSON')
                ->modalDescription('Совпадающие латышские слова в рамках категории 2-го уровня обновляются без потери прогресса. Новые слова создаются, отсутствующие в JSON — удаляются.')
                ->form(self::dictionaryJsonUploadForm())
                ->action(function (array $data) {
                    $this->runDictionaryJsonAction('update', $data);
                }),
            Action::make('replaceJson')
                ->label('Заменить полностью')
                ->icon('heroicon-o-exclamation-triangle')
                ->color('danger')
                ->requiresConfirmation()
                ->modalHeading('Полная замена словаря')
                ->modalDescription('Все текущие слова и категории будут удалены, затем импортирован новый JSON. Прогресс пользователей по старым словам будет потерян.')
                ->form(self::dictionaryJsonUploadForm())
                ->action(function (array $data) {
                    $this->runDictionaryJsonAction('replace', $data);
                }),
            DeleteAction::make()
                ->successNotificationTitle('Словарь удалён')
                ->failureNotificationTitle('Не удалось удалить словарь'),
        ];
    }

    /**
     * @param  array<string, mixed>  $data
     */
    private function runDictionaryJsonAction(string $mode, array $data): void
    {
        $parsed = self::parseJsonUpload($data);
        if ($parsed === null) {
            return;
        }
        [$contents, $meta, $path] = $parsed;
        /** @var Dictionary $record */
        $record = $this->getRecord();

        try {
            $service = app(DictionaryUpdateService::class);
            $stats = $mode === 'replace'
                ? $service->replaceFromJson($record, $contents, $meta)
                : $service->updateFromJson($record, $contents, $meta);
            Storage::disk('local')->delete($path);

            if ($mode === 'replace') {
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
            } else {
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
            }

            $this->refreshFormData(['name', 'lang', 'learn_lang', 'level', 'max_level', 'sound', 'words']);
        } catch (\Throwable $e) {
            Notification::make()
                ->title($mode === 'replace' ? 'Replace failed' : 'Update failed')
                ->body($e->getMessage())
                ->danger()
                ->send();
        }
    }
}
