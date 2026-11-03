<?php

namespace App\Filament\Resources\DictionaryWords\Pages;

use App\Filament\Resources\DictionaryWords\DictionaryWordResource;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;

class ListDictionaryWords extends ListRecords
{
    protected static string $resource = DictionaryWordResource::class;

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make(),
        ];
    }
}
