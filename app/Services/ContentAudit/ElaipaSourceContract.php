<?php

namespace App\Services\ContentAudit;

class ElaipaSourceContract
{
    public static function metadata(): array
    {
        return [
            'topic_basis' => 'first_seen',
            'frequency_scope' => 'whole_corpus',
            'all_topic_occurrences_available' => false,
            'morphology_reviewed' => false,
            'warning' => 'JSON E-Laipa показывает первое появление леммы, не все темы её употребления. Частота общая по корпусу. Отсутствие в текущей теме не доказано; изолированная морфология требует проверки.',
        ];
    }
}
