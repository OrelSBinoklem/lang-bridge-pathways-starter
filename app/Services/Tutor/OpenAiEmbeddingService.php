<?php

namespace App\Services\Tutor;

use App\Models\TutorMessage;
use App\Models\TutorMessageEmbedding;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

class OpenAiEmbeddingService
{
    /** @return array{ok: bool, skipped?: bool, error?: string, model?: string, dimensions?: int} */
    public function embedTutorMessage(TutorMessage $message, ?string $model = null, ?int $dimensions = null): array
    {
        $text = $this->messageText($message);
        if ($text === '' || ! in_array($message->role, ['user', 'assistant'], true)) {
            return ['ok' => true, 'skipped' => true, 'error' => 'empty_or_unsupported_role'];
        }

        if (! config('services.openai.embed_tutor_messages_sync')) {
            return ['ok' => true, 'skipped' => true, 'error' => 'sync_disabled'];
        }

        if (! Schema::hasTable('tutor_message_embeddings')) {
            return ['ok' => true, 'skipped' => true, 'error' => 'embedding_table_missing'];
        }

        try {
            $embedding = $this->embed($text, $model, $dimensions);
            $record = TutorMessageEmbedding::query()->updateOrCreate(
                ['tutor_message_id' => $message->id],
                [
                    'tutor_conversation_id' => $message->tutor_conversation_id,
                    'user_id' => $message->user_id,
                    'content' => $text,
                    'model' => $embedding['model'],
                    'dimensions' => count($embedding['embedding']),
                    'embedding_json' => Schema::hasColumn('tutor_message_embeddings', 'embedding_json')
                        ? $embedding['embedding']
                        : null,
                    'metadata' => [
                        'role' => $message->role,
                        'source' => $message->source,
                        'usage' => $embedding['usage'] ?? null,
                    ],
                ],
            );

            if (Schema::hasColumn('tutor_message_embeddings', 'embedding')) {
                DB::statement(
                    'UPDATE tutor_message_embeddings SET embedding = ?::vector WHERE id = ?',
                    [$this->toPgVector($embedding['embedding']), $record->id],
                );
            }

            return [
                'ok' => true,
                'model' => $embedding['model'],
                'dimensions' => count($embedding['embedding']),
            ];
        } catch (\Throwable $error) {
            Log::warning('Tutor message embedding failed', [
                'message_id' => $message->id,
                'error' => $error->getMessage(),
            ]);

            return ['ok' => false, 'error' => $error->getMessage()];
        }
    }

    /** @return array{model: string, embedding: array<int, float>, usage?: array<string, mixed>} */
    public function embed(string $text, ?string $model = null, ?int $dimensions = null): array
    {
        $apiKey = config('services.openai.key');
        if (! $apiKey) {
            throw new \RuntimeException('OPENAI_API_KEY is not configured.');
        }

        $model = $model ?: config('services.openai.message_embedding_model', 'text-embedding-3-small');
        $dimensions = $dimensions ?: (int) config('services.openai.embedding_dimensions', 1536);
        $payload = [
            'model' => $model,
            'input' => substr(trim($text), 0, 8000),
        ];

        if ($dimensions > 0) {
            $payload['dimensions'] = $dimensions;
        }

        $response = Http::withToken($apiKey)
            ->timeout(20)
            ->asJson()
            ->post('https://api.openai.com/v1/embeddings', $payload)
            ->throw()
            ->json();

        $embedding = $response['data'][0]['embedding'] ?? null;
        if (! is_array($embedding)) {
            throw new \RuntimeException('OpenAI embedding response has no embedding.');
        }

        return [
            'model' => $response['model'] ?? $model,
            'embedding' => array_map('floatval', $embedding),
            'usage' => $response['usage'] ?? null,
        ];
    }

    public function toPgVector(array $embedding): string
    {
        return '['.implode(',', array_map(
            static fn ($value) => rtrim(rtrim(sprintf('%.8F', (float) $value), '0'), '.'),
            $embedding,
        )).']';
    }

    private function messageText(TutorMessage $message): string
    {
        return trim((string) ($message->corrected_text ?: $message->model_heard_text ?: $message->original_text));
    }
}
