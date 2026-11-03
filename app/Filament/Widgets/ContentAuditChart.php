<?php

namespace App\Filament\Widgets;

use App\Filament\Pages\ContentAudit;
use Filament\Widgets\ChartWidget;
use Livewire\Attributes\Locked;

abstract class ContentAuditChart extends ChartWidget
{
    protected static bool $isDiscovered = false;

    protected static bool $isLazy = false;

    protected ?string $pollingInterval = null;

    protected ?string $maxHeight = '420px';

    #[Locked]
    public array $series = [];

    public static function canView(): bool
    {
        return ContentAudit::canAccess();
    }

    public function mount(): void
    {
        abort_unless(static::canView(), 403);
        parent::mount();
    }

    public function rendering(): void
    {
        abort_unless(static::canView(), 403);
        parent::rendering();
    }

    protected function getType(): string
    {
        return 'bar';
    }

    protected function getData(): array
    {
        abort_unless(static::canView(), 403);

        return ['labels' => array_column($this->series, 'label'), 'datasets' => [['label' => '% лексики задания',
            'data' => array_column($this->series, 'percent'), 'backgroundColor' => array_column($this->series, 'color'), 'borderWidth' => 0]]];
    }

    protected function getOptions(): ?array
    {
        return ['indexAxis' => 'y', 'plugins' => ['legend' => ['display' => false]],
            'scales' => ['x' => ['min' => 0, 'max' => 100], 'y' => ['ticks' => ['autoSkip' => false]]], 'maintainAspectRatio' => false];
    }
}
