<?php

namespace App\Filament\Resources\DictionaryWords\Pages;

use App\Filament\Resources\DictionaryWords\DictionaryWordResource;
use Filament\Resources\Pages\CreateRecord;

class CreateDictionaryWord extends CreateRecord
{
    protected static string $resource = DictionaryWordResource::class;
}
