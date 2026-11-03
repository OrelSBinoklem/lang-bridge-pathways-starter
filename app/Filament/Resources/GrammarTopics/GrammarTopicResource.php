<?php

namespace App\Filament\Resources\GrammarTopics;

use App\Filament\Resources\LessonPages\LessonPageResource;
use Illuminate\Database\Eloquent\Builder;

class GrammarTopicResource extends LessonPageResource
{
    protected static ?string $slug = 'grammar-topics';
    protected static ?string $navigationLabel = 'Грамматические темы';
    protected static ?string $modelLabel = 'грамматическая тема';
    protected static ?string $pluralModelLabel = 'Грамматические темы';
    protected static ?int $navigationSort = 4;

    public static function getEloquentQuery(): Builder { return parent::getEloquentQuery()->where('skill', 'grammar'); }
    public static function getPages(): array
    {
        return ['index' => Pages\ListGrammarTopics::route('/'), 'create' => Pages\CreateGrammarTopic::route('/create'), 'edit' => Pages\EditGrammarTopic::route('/{record}/edit')];
    }
}
