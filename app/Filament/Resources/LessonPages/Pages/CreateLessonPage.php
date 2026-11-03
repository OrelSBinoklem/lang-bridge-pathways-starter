<?php

namespace App\Filament\Resources\LessonPages\Pages;

use App\Filament\Resources\LessonPages\LessonPageResource;
use Filament\Resources\Pages\CreateRecord;

class CreateLessonPage extends CreateRecord
{
    protected static string $resource = LessonPageResource::class;
}
