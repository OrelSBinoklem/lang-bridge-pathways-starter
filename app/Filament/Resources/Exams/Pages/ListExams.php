<?php
namespace App\Filament\Resources\Exams\Pages;
class ListExams extends \Filament\Resources\Pages\ListRecords
{
    protected static string $resource = \App\Filament\Resources\Exams\ExamResource::class;
    protected function getHeaderActions(): array { return [\Filament\Actions\CreateAction::make()]; }
}
