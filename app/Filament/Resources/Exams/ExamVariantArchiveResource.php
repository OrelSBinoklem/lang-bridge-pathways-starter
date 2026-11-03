<?php

namespace App\Filament\Resources\Exams;

use App\Models\ExamVariantArchive;
use BackedEnum;
use Filament\Actions\{Action, ViewAction};
use Filament\Infolists\Components\{TextEntry, ViewEntry};
use Filament\Resources\Resource;
use Filament\Schemas\Schema;
use Filament\Tables\Columns\{TextColumn, IconColumn};
use Filament\Tables\Filters\SelectFilter;
use Filament\Tables\Table;
use UnitEnum;

class ExamVariantArchiveResource extends Resource
{
    protected static ?string $model = ExamVariantArchive::class;
    protected static ?string $slug = 'exam-variant-archives';
    protected static ?string $navigationLabel = 'Архив экзаменов';
    protected static ?string $modelLabel = 'архивная версия';
    protected static ?string $pluralModelLabel = 'Архив экзаменов';
    protected static string|UnitEnum|null $navigationGroup = 'Путь курса';
    protected static string|BackedEnum|null $navigationIcon = 'heroicon-o-archive-box';

    public static function canViewAny(): bool { return ExamResource::canViewAny(); }
    public static function canView($record): bool { return static::canViewAny(); }
    public static function canCreate(): bool { return false; }
    public static function canEdit($record): bool { return false; }
    public static function canDelete($record): bool { return false; }
    public static function table(Table $table): Table
    {
        return $table->defaultSort('archived_at', 'desc')->columns([
            TextColumn::make('level')->label('Уровень'), TextColumn::make('position')->label('№'),
            TextColumn::make('title')->label('Вариант')->searchable(),
            IconColumn::make('was_published')->label('Был опубликован')->boolean(),
            TextColumn::make('archived_at')->label('В архиве с')->dateTime(),
            TextColumn::make('reason')->label('Причина')->wrap(),
        ])->filters([SelectFilter::make('level')->label('Уровень')->options(array_combine(['A1', 'A2', 'B1', 'B2'], ['A1', 'A2', 'B1', 'B2']))])
            ->recordActions([
                ViewAction::make()->authorize(fn () => static::canViewAny()),
                Action::make('download')->label('JSON')->icon('heroicon-o-arrow-down-tray')
                    ->authorize(fn () => static::canViewAny())
                    ->url(fn (ExamVariantArchive $record) => route('admin.exam-archives.json', $record)),
            ]);
    }
    public static function infolist(Schema $schema): Schema
    {
        return $schema->components([
            TextEntry::make('level')->label('Уровень'), TextEntry::make('position')->label('Вариант'),
            TextEntry::make('title')->label('Название'), TextEntry::make('archived_at')->label('В архиве с')->dateTime(),
            TextEntry::make('reason')->label('Причина')->columnSpanFull(),
            ViewEntry::make('content')->hiddenLabel()->view('filament.exams.archive-content')->columnSpanFull(),
        ]);
    }
    public static function getPages(): array { return ['index' => Pages\ListExamVariantArchives::route('/')]; }
}
