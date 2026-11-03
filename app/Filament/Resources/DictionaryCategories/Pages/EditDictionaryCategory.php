<?php

namespace App\Filament\Resources\DictionaryCategories\Pages;

use App\Filament\Resources\DictionaryCategories\DictionaryCategoryResource;
use Filament\Actions\DeleteAction;
use Filament\Resources\Pages\EditRecord;

class EditDictionaryCategory extends EditRecord
{
    protected static string $resource = DictionaryCategoryResource::class;

    protected function getHeaderActions(): array
    {
        return [
            DeleteAction::make(),
        ];
    }
}
