<?php

namespace App\Filament\Pages;

use App\Models\CourseGroup;
use App\Models\LessonPage;
use App\Services\ContentAudit\CourseContentAudit;
use BackedEnum;
use Filament\Pages\Page;
use Livewire\Attributes\Computed;
use Livewire\Attributes\Locked;
use Livewire\Attributes\Url;
use UnitEnum;

class ContentAudit extends Page
{
    protected static string|BackedEnum|null $navigationIcon = 'heroicon-o-chart-bar';

    protected static string|UnitEnum|null $navigationGroup = 'Путь курса';

    protected static ?int $navigationSort = 8;

    protected static ?string $navigationLabel = 'Анализ лексики';

    protected static ?string $title = 'Анализ лексики заданий';

    protected static ?string $slug = 'content-audit';

    protected string $view = 'filament.pages.content-audit';

    #[Url]
    public ?int $lesson = null;

    #[Url]
    public ?int $block = null;

    #[Url]
    public ?int $variant = null;

    #[Url]
    public ?int $context = null;

    #[Url]
    public string $scope = 'body';

    #[Url]
    public string $countMode = 'occurrences';

    #[Url]
    public string $mode = 'corpus';

    #[Locked]
    public ?string $selectedWord = null;

    public static function canAccess(): bool
    {
        return (bool) auth()->user()?->hasAnyRole(['super_admin', 'admin']);
    }

    public function mount(): void
    {
        abort_unless(static::canAccess(), 403);
    }

    public function updatedLesson(): void
    {
        $this->block = $this->variant = null;
        $this->selectedWord = null;
    }

    public function updatedBlock(): void
    {
        $this->variant = null;
        $this->selectedWord = null;
    }

    #[Computed]
    public function lessons(): array
    {
        abort_unless(static::canAccess(), 403);

        return LessonPage::where('learn_lang', 'lv')->orderBy('level')->orderBy('title')->get(['id', 'title', 'level', 'skill'])
            ->mapWithKeys(fn ($page) => [$page->id => "{$page->level} · {$page->title} ({$page->skill})"])->all();
    }

    #[Computed]
    public function pageRecord(): ?LessonPage
    {
        abort_unless(static::canAccess(), 403);

        return $this->lesson ? LessonPage::with('blocks.variants', 'blocks.sourceBlock.variants', 'courseGroup')->where('learn_lang', 'lv')->findOrFail($this->lesson) : null;
    }

    #[Computed]
    public function groups(): array
    {
        abort_unless(static::canAccess(), 403);

        return CourseGroup::with('category')->where('learn_lang', 'lv')->where('is_published', true)->orderBy('level')->orderBy('position')->get()
            ->mapWithKeys(fn ($group) => [$group->id => "{$group->level} · {$group->display_title}"])->all();
    }

    #[Computed]
    public function variants(): array
    {
        $block = $this->pageRecord?->blocks->firstWhere('id', $this->block) ?? $this->pageRecord?->blocks->first();
        $source = $block?->source_block_id ? $block->sourceBlock : $block;

        return $source?->variants->mapWithKeys(fn ($variant) => [$variant->id => ($variant->title ?: 'Вариант '.($variant->position + 1)).($variant->is_published ? '' : ' · черновик')])->all() ?? [];
    }

    #[Computed]
    public function report(): ?array
    {
        abort_unless(static::canAccess(), 403);
        if (! $this->lesson) {
            return null;
        }
        if ($this->pageRecord->blocks->isEmpty()) {
            return null;
        }
        abort_unless(in_array($this->scope, ['body', 'all']) && in_array($this->countMode, ['occurrences', 'unique']) && in_array($this->mode, ['exact', 'corpus', 'heuristic']), 422);

        return app(CourseContentAudit::class)->report($this->lesson, $this->block, $this->variant, $this->context, $this->scope, $this->countMode, $this->mode);
    }

    public function selectWord(string $key): void
    {
        abort_unless(static::canAccess(), 403);
        abort_unless(isset($this->report['words'][$key]), 422);
        $this->selectedWord = $key;
        $this->dispatch('open-modal', id: 'content-audit-word');
    }
}
