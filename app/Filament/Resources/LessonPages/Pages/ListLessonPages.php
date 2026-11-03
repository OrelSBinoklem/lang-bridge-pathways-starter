<?php

namespace App\Filament\Resources\LessonPages\Pages;

use App\Filament\Resources\LessonPages\LessonPageResource;
use Filament\Resources\Pages\ListRecords;

class ListLessonPages extends ListRecords
{
    protected static string $resource = LessonPageResource::class;
    protected function getHeaderActions(): array { return [\Filament\Actions\CreateAction::make()]; }
}
