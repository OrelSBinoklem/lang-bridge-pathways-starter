<?php

namespace App\Filament\Resources\DictionaryWords\Pages;

use App\Filament\Resources\DictionaryWords\DictionaryWordResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditDictionaryWord extends EditRecord
{
    protected static string $resource = DictionaryWordResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
