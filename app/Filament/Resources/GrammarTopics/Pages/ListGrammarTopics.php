<?php
namespace App\Filament\Resources\GrammarTopics\Pages;
use App\Filament\Resources\GrammarTopics\GrammarTopicResource;
use Filament\Resources\Pages\ListRecords;
class ListGrammarTopics extends ListRecords
{
    protected static string $resource = GrammarTopicResource::class;
    protected function getHeaderActions(): array { return [\Filament\Actions\CreateAction::make()]; }
}
