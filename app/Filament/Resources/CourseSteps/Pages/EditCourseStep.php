<?php

namespace App\Filament\Resources\CourseSteps\Pages;

use App\Filament\Resources\CourseSteps\CourseStepResource;
use Filament\Resources\Pages\EditRecord;

class EditCourseStep extends EditRecord
{
    protected static string $resource = CourseStepResource::class;
    protected function getHeaderActions(): array { return [\Filament\Actions\DeleteAction::make()]; }
}
