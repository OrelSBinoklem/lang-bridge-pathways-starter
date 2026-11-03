<?php

namespace App\Filament\Widgets;

class ContentSkillChart extends ContentAuditChart
{
    protected ?string $heading = 'Повторение по навыкам';

    protected ?string $description = 'Доля лексики, встречавшейся в опубликованных заданиях предыдущих тем. Навыки пересекаются; сумма может быть больше 100%.';
}
