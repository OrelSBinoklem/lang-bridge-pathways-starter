<?php

namespace App\Filament\Widgets;

class ContentTopicChart extends ContentAuditChart
{
    protected ?string $heading = 'Откуда лексика: темы словаря';

    protected ?string $description = 'Первое появление в БД. Каждая единица учитывается в одной теме; сумма 100% до округления.';
}
