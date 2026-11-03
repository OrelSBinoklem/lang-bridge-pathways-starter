<?php
namespace App\Filament\Resources\CourseGroups\Pages;
class ListCourseGroups extends \Filament\Resources\Pages\ListRecords
{
    protected static string $resource = \App\Filament\Resources\CourseGroups\CourseGroupResource::class;
    protected function getHeaderActions(): array { return [\Filament\Actions\CreateAction::make()]; }
}
