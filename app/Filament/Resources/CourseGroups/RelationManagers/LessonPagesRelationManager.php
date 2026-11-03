<?php

namespace App\Filament\Resources\CourseGroups\RelationManagers;

use App\Filament\Resources\LessonPages\LessonPageResource;
use Filament\Actions\CreateAction;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Table;

class LessonPagesRelationManager extends RelationManager
{
    protected static string $relationship = 'lessonPages';
    protected static ?string $title = 'Уроки навыков';

    public function form(Schema $schema): Schema { return LessonPageResource::form($schema); }

    public function table(Table $table): Table
    {
        return LessonPageResource::table($table)->headerActions([
            CreateAction::make()->fillForm(fn () => [
                'course_group_id' => $this->getOwnerRecord()->id,
                'level' => $this->getOwnerRecord()->level,
                'learn_lang' => $this->getOwnerRecord()->learn_lang,
                'status' => 'draft',
                'is_published' => false,
            ]),
        ]);
    }
}
