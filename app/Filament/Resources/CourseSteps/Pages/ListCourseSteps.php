<?php

namespace App\Filament\Resources\CourseSteps\Pages;

use App\Filament\Resources\CourseSteps\CourseStepResource;
use Filament\Resources\Pages\ListRecords;

class ListCourseSteps extends ListRecords
{
    protected static string $resource = CourseStepResource::class;
    protected function getHeaderActions(): array { return [\Filament\Actions\CreateAction::make()]; }
}
