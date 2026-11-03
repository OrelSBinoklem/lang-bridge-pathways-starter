<?php

namespace App\Filament\Resources\CourseGroups\RelationManagers;

use App\Filament\Resources\CourseSteps\CourseStepResource;
use Filament\Resources\RelationManagers\RelationManager;
use Filament\Schemas\Schema;
use Filament\Tables\Table;

class StepsRelationManager extends RelationManager
{
    protected static string $relationship = 'steps';
    protected static ?string $title = 'Этапы группы';
    public function form(Schema $schema): Schema { return CourseStepResource::form($schema); }
    public function table(Table $table): Table
    {
        return CourseStepResource::table($table)->headerActions([
            \Filament\Actions\CreateAction::make()->fillForm(fn () => ['group_id' => $this->getOwnerRecord()->id, 'level' => $this->getOwnerRecord()->level]),
        ]);
    }
}
