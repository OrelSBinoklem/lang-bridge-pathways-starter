<?php

namespace App\Services\Credits;

class CreditPurpose
{
    public const VALUES = ['bot_answer', 'speech', 'transcription', 'translation_check', 'task_check', 'exam_check', 'memory', 'conversation_summary', 'reference_search', 'ai_request'];

    public static function fallback(string $kind): string
    {
        return match ($kind) {
            'speech' => 'speech', 'transcription' => 'transcription', 'embedding' => 'memory',
            'grant' => 'grant', 'subscription' => 'subscription', default => 'ai_request',
        };
    }

    public static function forHttp(string $kind): string
    {
        if ($kind !== 'text') return self::fallback($kind);
        if ($purpose = app(CreditContext::class)->purpose) return $purpose;
        return match (true) {
            request()->is('api/lessons/*/translation-check') => 'translation_check',
            request()->is('api/lessons/*', 'api/tutor/lesson-blocks/*') => 'task_check',
            request()->is('api/exam-attempts/*') => 'exam_check',
            request()->is('api/tutor/references') => 'reference_search',
            request()->is('api/tutor/*') => 'memory',
            default => 'ai_request',
        };
    }
}
