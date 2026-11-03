<?php
namespace App\Filament\Resources\GrammarTopics\Pages;
use App\Filament\Resources\GrammarTopics\GrammarTopicResource;
use Filament\Resources\Pages\CreateRecord;
class CreateGrammarTopic extends CreateRecord
{
    protected static string $resource = GrammarTopicResource::class;
    protected function mutateFormDataBeforeCreate(array $data): array { return [...$data, 'skill' => 'grammar']; }
}
