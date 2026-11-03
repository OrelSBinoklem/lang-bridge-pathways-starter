<?php

namespace App\Filament\Resources\LessonPages\Pages;

use App\Filament\Resources\LessonPages\LessonPageResource;
use Filament\Resources\Pages\EditRecord;

class EditLessonPage extends EditRecord
{
    protected static string $resource = LessonPageResource::class;
    protected function getHeaderActions(): array { return [
        \Filament\Actions\Action::make('contentAudit')->label('Статистика лексики')->icon('heroicon-o-chart-bar')
            ->url(fn () => \App\Filament\Pages\ContentAudit::getUrl(['lesson' => $this->record->id]))->openUrlInNewTab(),
        \Filament\Actions\DeleteAction::make(),
    ]; }
}
