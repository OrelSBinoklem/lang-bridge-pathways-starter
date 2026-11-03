<?php

namespace App\Services\Tutor;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

class OpenAiSummaryService
{
    /** @param array<int, array{role: string, text: string, created_at?: mixed}> $messages */
    public function summarizeDailyMessages(array $messages, ?string $previousSummary = null, ?string $model = null, ?int $userId = null): array
    {
        $model = $model ?: config('services.openai.context_summary_model', 'gpt-5.4');
        $text = $this->formatMessages($messages);

        if ($text === '') {
            return [
                'ok' => true,
                'summary' => '',
                'model' => $model,
                'metadata' => ['skipped' => 'empty_messages'],
            ];
        }

        if (! config('services.openai.key')) {
            return [
                'ok' => true,
                'summary' => $this->fallbackSummary($text),
                'model' => 'local-fallback',
                'metadata' => ['fallback' => 'openai_key_missing'],
            ];
        }

        $payload = [
            'model' => $model,
            'input' => [
                [
                    'role' => 'developer',
                    'content' => implode("\n", [
                        'Сожми дневной диалог с AI tutor в короткую память для будущего поиска.',
                        'Пиши по-русски. Сохрани только факты, учебные темы, договоренности, ошибки распознавания, важные решения UI/архитектуры.',
                        'Не перечисляй каждое приветствие. Не добавляй того, чего нет в диалоге.',
                        'Формат: 3-8 коротких bullet lines.',
                    ]),
                ],
                [
                    'role' => 'user',
                    'content' => json_encode([
                        'previous_summary' => $previousSummary,
                        'messages' => Str::limit($text, 24000, ''),
                    ], JSON_UNESCAPED_UNICODE),
                ],
            ],
            'max_output_tokens' => 650,
        ];

        $payload = app(AiProfiles::class)->apply('daily_summary', $payload);
        $model = $payload['model'];
        $response = Http::withToken(config('services.openai.key'))->withOptions(['ai_role' => 'daily_summary', 'ai_user_id' => $userId])
            ->timeout(45)
            ->asJson()
            ->post('https://api.openai.com/v1/responses', $payload)
            ->throw()
            ->json();

        return [
            'ok' => true,
            'summary' => Str::limit(trim($this->extractText($response)), 4000, ''),
            'model' => $response['model'] ?? $model,
            'metadata' => [
                'usage' => $response['usage'] ?? null,
            ],
        ];
    }

    /** @param array<int, array{role: string, text: string, created_at?: mixed}> $messages */
    private function formatMessages(array $messages): string
    {
        return collect($messages)
            ->map(fn (array $message) => sprintf(
                '[%s] %s: %s',
                $message['created_at'] ?? '',
                $message['role'],
                trim($message['text']),
            ))
            ->filter(fn (string $line) => trim($line) !== '')
            ->implode("\n");
    }

    private function extractText(array $response): string
    {
        if (isset($response['output_text']) && is_string($response['output_text'])) {
            return $response['output_text'];
        }

        $chunks = [];
        foreach ($response['output'] ?? [] as $item) {
            foreach ($item['content'] ?? [] as $content) {
                if (isset($content['text']) && is_string($content['text'])) {
                    $chunks[] = $content['text'];
                }
            }
        }

        return implode("\n", $chunks);
    }

    private function fallbackSummary(string $text): string
    {
        $lines = collect(explode("\n", $text))
            ->map(fn (string $line) => trim($line))
            ->filter()
            ->reject(fn (string $line) => str_contains($line, 'assistant: Sveiki'))
            ->take(10)
            ->map(fn (string $line) => '- '.Str::limit($line, 220))
            ->implode("\n");

        return $lines ?: '- За день были сообщения, но содержательной summary пока нет.';
    }
}
