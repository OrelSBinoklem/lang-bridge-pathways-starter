<?php
namespace App\Filament\Resources\GrammarTopics\Pages;
use App\Filament\Resources\GrammarTopics\GrammarTopicResource;
use Filament\Resources\Pages\EditRecord;
class EditGrammarTopic extends EditRecord
{
    protected static string $resource = GrammarTopicResource::class;
    protected function mutateFormDataBeforeSave(array $data): array { return [...$data, 'skill' => 'grammar']; }
}
