<?php
namespace App\Filament\Resources\Exams;

use App\Models\{CourseExam, ExamVariant};
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Forms\Components\{Select, TextInput};
use Filament\Tables\Table;
use Filament\Tables\Columns\{TextColumn, IconColumn};
use Filament\Tables\Filters\SelectFilter;
use Filament\Actions\EditAction;

class ExamVariantResource extends Resource
{
    protected static ?string $model = ExamVariant::class;
    protected static ?string $slug = 'exam-variants';
    protected static ?string $navigationLabel = 'Варианты экзаменов';
    protected static ?string $modelLabel = 'вариант';
    protected static ?string $pluralModelLabel = 'Варианты экзаменов';
    protected static string|\UnitEnum|null $navigationGroup = 'Путь курса';
    protected static bool $shouldRegisterNavigation = false;
    public static function canViewAny(): bool { return ExamResource::canViewAny(); }
    public static function canCreate(): bool { return static::canViewAny(); }
    public static function canView($record): bool { return static::canViewAny(); }
    public static function canEdit($record): bool { return static::canViewAny(); }
    public static function canDelete($record): bool { return false; }
    public static function form(Schema $schema): Schema
    {
        return $schema->components([
            Select::make('course_exam_id')->label('Экзамен')->options(fn()=>CourseExam::pluck('title','id'))->required(),
            TextInput::make('position')->label('Номер варианта')->numeric()->integer()->minValue(1)->required(),
            ...ExamResource::variantFields(),
        ]);
    }
    public static function table(Table $table): Table
    {
        return $table->defaultSort('position')->columns([TextColumn::make('exam.level')->label('Уровень'), TextColumn::make('position')->label('№'),TextColumn::make('title')->label('Вариант'),IconColumn::make('is_published')->boolean()->label('Опубликован')])
            ->filters([SelectFilter::make('course_exam_id')->label('Экзамен')->options(fn()=>CourseExam::pluck('title','id'))])
            ->recordActions([EditAction::make()]);
    }
    public static function getPages(): array { return ['index'=>Pages\ListExamVariants::route('/'),'create'=>Pages\CreateExamVariant::route('/create'),'edit'=>Pages\EditExamVariant::route('/{record}/edit')]; }
}
