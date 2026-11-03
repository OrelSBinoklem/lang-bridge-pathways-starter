<?php
namespace App\Filament\Resources\ExamAttempts;

use App\Models\ExamAttempt;
use Filament\Resources\Resource;
use Filament\Tables\Table;
use Filament\Tables\Columns\{TextColumn, IconColumn};
use Filament\Actions\Action;
use Illuminate\Support\Facades\Auth;

class ExamAttemptResource extends Resource
{
    protected static ?string $model = ExamAttempt::class;
    protected static ?string $slug = 'exam-attempts';
    protected static ?string $navigationLabel = 'Результаты экзаменов';
    protected static ?string $pluralModelLabel = 'Результаты экзаменов';
    protected static string|\UnitEnum|null $navigationGroup = 'Путь курса';
    public static function canViewAny(): bool { return Auth::user()?->isFrontendAdmin() ?? false; }
    public static function canCreate(): bool { return false; }
    public static function canDelete($record): bool { return false; }
    public static function table(Table $table): Table
    {
        return $table->defaultSort('id','desc')->columns([
            TextColumn::make('id'), TextColumn::make('student_name')->label('Ученик')->searchable(),
            TextColumn::make('exam.level')->label('Уровень'), TextColumn::make('status')->label('Статус'),
            TextColumn::make('score')->label('%'), IconColumn::make('passed')->boolean()->label('Сдан'),
            TextColumn::make('started_at')->label('Начало')->dateTime(), TextColumn::make('reviewed_at')->label('Ручная проверка')->dateTime(),
        ])->recordActions([
            Action::make('retry')->label('Повторить AI-проверку')->requiresConfirmation()
                ->visible(fn ($record) => $record->status === 'pending' && $record->grading_error)
                ->action(function ($record) { $record->update(['grading_tries'=>0, 'grading_error'=>null]); app(\App\Services\Exams\ExamGrader::class)->grade($record->id); }),
            Action::make('inspect')->label('Ответы и оценка')->modalHeading('Экзаменационная работа')->modalSubmitAction(false)
                ->modalContent(fn ($record) => view('filament.exams.attempt', ['attempt'=>$record])),
            Action::make('review')->label('Подтвердить проверку')->requiresConfirmation()->modalDescription('Подтвердите только после просмотра ответов и оценок ученика.')
                ->visible(fn ($record) => $record->status === 'completed' && !$record->reviewed_at)
                ->action(fn ($record) => $record->update(['reviewed_at'=>now(), 'reviewed_by'=>Auth::id()])),
        ]);
    }
    public static function getPages(): array { return ['index'=>Pages\ListExamAttempts::route('/')]; }
}
