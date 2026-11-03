<?php
namespace App\Filament\Resources\Exams\Pages;
class ListExamVariants extends \Filament\Resources\Pages\ListRecords
{
    protected static string $resource = \App\Filament\Resources\Exams\ExamVariantResource::class;
    protected function getHeaderActions(): array { return [\Filament\Actions\CreateAction::make()]; }
}
