<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TutorConversation;
use App\Models\TutorDailySummary;
use App\Models\TutorDifficultWord;
use App\Models\TutorMemoryNote;
use App\Models\TutorMessage;
use App\Models\TutorProgressEstimate;
use App\Services\Tutor\OpenAiEmbeddingService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TutorMemoryController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'data' => [
                'difficult_words' => TutorDifficultWord::query()
                    ->where('user_id', $user->id)
                    ->latest('last_seen_at')
                    ->latest('id')
                    ->limit(20)
                    ->get()
                    ->map(fn (TutorDifficultWord $word) => $this->serializeDifficultWord($word)),
                'progress_estimate' => optional(
                    TutorProgressEstimate::query()
                        ->where('user_id', $user->id)
                        ->latest('id')
                        ->first()
                )->only(['id', 'cefr_level', 'confidence', 'summary', 'evidence', 'created_at']),
                'important_notes' => TutorMemoryNote::query()
                    ->where('user_id', $user->id)
                    ->orderByDesc('importance')
                    ->latest('last_seen_at')
                    ->latest('id')
                    ->limit(20)
                    ->get()
                    ->map(fn (TutorMemoryNote $note) => $this->serializeMemoryNote($note)),
            ],
        ]);
    }

    public function overview(Request $request): JsonResponse
    {
        $user = $request->user();

        $notes = TutorMemoryNote::query()
            ->where('user_id', $user->id)
            ->orderByDesc('importance')
            ->latest('last_seen_at')
            ->latest('id')
            ->limit(300)
            ->get();

        $storedDailySummaries = TutorDailySummary::query()
            ->where('user_id', $user->id)
            ->latest('summary_date')
            ->limit(60)
            ->get();

        $dailySummaries = $storedDailySummaries->map(fn (TutorDailySummary $summary) => [
            'date' => optional($summary->summary_date)->toDateString(),
            'conversations_count' => null,
            'messages_count' => $summary->messages_count,
            'summary' => $summary->summary,
            'model' => $summary->model,
            'updated_at' => $summary->updated_at,
            'message_range' => [
                'first_message_id' => $summary->first_message_id,
                'last_message_id' => $summary->last_message_id,
            ],
            'conversations' => [],
        ])->values();

        if ($dailySummaries->isEmpty()) {
            $dailySummaries = $this->conversationSummaryRollup($user->id);
        }

        return response()->json([
            'data' => [
                'important_notes' => $notes->map(fn (TutorMemoryNote $note) => $this->serializeMemoryNote($note)),
                'notes_total' => $notes->count(),
                'daily_summaries' => $dailySummaries,
                'daily_summaries_status' => $dailySummaries->isEmpty()
                    ? 'no_conversation_summaries_yet'
                    : ($storedDailySummaries->isEmpty() ? 'conversation_summary_rollup' : 'stored_daily_summaries'),
            ],
        ]);
    }

    private function conversationSummaryRollup(int $userId)
    {
        $conversationSummaries = TutorConversation::query()
            ->where('user_id', $userId)
            ->whereNotNull('summary')
            ->where('summary', '<>', '')
            ->withCount('messages')
            ->latest('updated_at')
            ->limit(200)
            ->get();

        return $conversationSummaries
            ->groupBy(fn (TutorConversation $conversation) => optional($conversation->updated_at ?? $conversation->created_at)->toDateString() ?? 'unknown')
            ->map(function ($items, string $date) {
                return [
                    'date' => $date,
                    'conversations_count' => $items->count(),
                    'messages_count' => $items->sum(fn (TutorConversation $conversation) => (int) ($conversation->messages_count ?? 0)),
                    'summary' => $items
                        ->map(fn (TutorConversation $conversation) => trim((string) $conversation->summary))
                        ->filter()
                        ->implode("\n\n"),
                    'conversations' => $items->map(fn (TutorConversation $conversation) => [
                        'id' => $conversation->id,
                        'title' => Str::limit($conversation->summary ?: 'Диалог', 80),
                        'summary' => $conversation->summary,
                        'messages_count' => $conversation->messages_count ?? null,
                        'updated_at' => $conversation->updated_at,
                    ])->values(),
                ];
            })
            ->values();
    }

    public function storeDifficultWord(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'word' => ['required', 'string', 'max:120'],
            'lemma' => ['nullable', 'string', 'max:120'],
            'language' => ['nullable', 'string', 'max:10'],
            'translation_ru' => ['nullable', 'string', 'max:255'],
            'status' => ['nullable', 'string', Rule::in(['difficult', 'learning', 'review', 'known'])],
            'difficulty' => ['nullable', 'integer', 'min:1', 'max:5'],
            'confidence' => ['nullable', 'integer', 'min:0', 'max:100'],
            'examples' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);

        $word = TutorDifficultWord::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'word' => trim($data['word']),
                'language' => $data['language'] ?? 'lv',
            ],
            [
                'lemma' => $data['lemma'] ?? null,
                'translation_ru' => $data['translation_ru'] ?? null,
                'status' => $data['status'] ?? 'difficult',
                'difficulty' => $data['difficulty'] ?? 3,
                'confidence' => $data['confidence'] ?? null,
                'examples' => $data['examples'] ?? null,
                'metadata' => $data['metadata'] ?? null,
                'last_seen_at' => now(),
            ],
        );

        return response()->json(['data' => $this->serializeDifficultWord($word)], 201);
    }

    public function storeProgressEstimate(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'cefr_level' => ['required', 'string', Rule::in(['A1', 'A2', 'B1', 'B2'])],
            'confidence' => ['nullable', 'integer', 'min:0', 'max:100'],
            'summary' => ['nullable', 'string', 'max:2000'],
            'evidence' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);

        $estimate = TutorProgressEstimate::query()->create([
            'user_id' => $user->id,
            'cefr_level' => $data['cefr_level'],
            'confidence' => $data['confidence'] ?? null,
            'summary' => $data['summary'] ?? null,
            'evidence' => $data['evidence'] ?? null,
            'metadata' => $data['metadata'] ?? null,
        ]);

        return response()->json([
            'data' => $estimate->only(['id', 'cefr_level', 'confidence', 'summary', 'evidence', 'created_at']),
        ], 201);
    }

    public function storeMemoryNote(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'category' => ['nullable', 'string', Rule::in(['general', 'preference', 'learning', 'agreement', 'voice', 'ui', 'technical'])],
            'key' => ['required', 'string', 'max:120'],
            'content' => ['required', 'string', 'max:4000'],
            'importance' => ['nullable', 'integer', 'min:1', 'max:5'],
            'evidence' => ['nullable', 'array'],
            'metadata' => ['nullable', 'array'],
        ]);

        $key = Str::of($data['key'])
            ->lower()
            ->replaceMatches('/[^a-z0-9а-яёіїєґ\-_.:]+/iu', '-')
            ->trim('-')
            ->limit(120, '')
            ->toString();

        $note = TutorMemoryNote::query()->updateOrCreate(
            [
                'user_id' => $user->id,
                'key' => $key,
            ],
            [
                'category' => $data['category'] ?? 'general',
                'content' => trim($data['content']),
                'importance' => $data['importance'] ?? 3,
                'evidence' => $data['evidence'] ?? null,
                'metadata' => $data['metadata'] ?? null,
                'last_seen_at' => now(),
            ],
        );

        return response()->json(['data' => $this->serializeMemoryNote($note)], 201);
    }

    public function searchMemoryNotes(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'query' => ['required', 'string', 'min:2', 'max:500'],
            'category' => ['nullable', 'string', Rule::in(['general', 'preference', 'learning', 'agreement', 'voice', 'ui', 'technical'])],
            'limit' => ['nullable', 'integer', 'min:1', 'max:10'],
        ]);
        $query = trim($data['query']);
        $limit = $data['limit'] ?? 5;

        $notes = TutorMemoryNote::query()
            ->where('user_id', $user->id)
            ->when($data['category'] ?? null, fn ($builder, string $category) => $builder->where('category', $category))
            ->where(function ($builder) use ($query) {
                $builder
                    ->where('key', 'like', '%'.$query.'%')
                    ->orWhere('content', 'like', '%'.$query.'%');
            })
            ->orderByDesc('importance')
            ->latest('last_seen_at')
            ->latest('id')
            ->limit($limit)
            ->get();

        return response()->json([
            'data' => [
                'notes' => $notes->map(fn (TutorMemoryNote $note) => $this->serializeMemoryNote($note)),
            ],
        ]);
    }

    public function searchHistory(Request $request, OpenAiEmbeddingService $embeddings): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'query' => ['required', 'string', 'min:2', 'max:1000'],
            'limit' => ['nullable', 'integer', 'min:1', 'max:10'],
            'embedding_model' => ['nullable', 'string', Rule::in(['text-embedding-3-small', 'text-embedding-3-large'])],
            'embedding_dimensions' => ['nullable', 'integer', Rule::in([1536])],
        ]);
        $limit = $data['limit'] ?? 5;
        $embeddingModel = $data['embedding_model'] ?? config('services.openai.message_embedding_model', 'text-embedding-3-large');
        $embeddingDimensions = $data['embedding_dimensions'] ?? (int) config('services.openai.embedding_dimensions', 1536);

        if (! Schema::hasTable('tutor_message_embeddings')) {
            return response()->json([
                'data' => [
                    'available' => false,
                    'reason' => 'tutor_message_embeddings table is missing',
                    'hits' => [],
                ],
            ]);
        }

        if (Schema::hasColumn('tutor_message_embeddings', 'embedding')) {
            $queryEmbedding = $embeddings->embed($data['query'], $embeddingModel, $embeddingDimensions);
            $vector = $embeddings->toPgVector($queryEmbedding['embedding']);
            $rows = DB::select(
                <<<'SQL'
                SELECT
                    e.tutor_message_id,
                    e.tutor_conversation_id,
                    e.content,
                    e.model,
                    e.dimensions,
                    1 - (e.embedding <=> CAST(? AS vector)) AS score,
                    m.role,
                    m.created_at
                FROM tutor_message_embeddings e
                JOIN tutor_messages m ON m.id = e.tutor_message_id
                WHERE e.user_id = ?
                  AND e.model = ?
                  AND e.dimensions = ?
                ORDER BY e.embedding <=> CAST(? AS vector)
                LIMIT ?
                SQL,
                [$vector, $user->id, $embeddingModel, $embeddingDimensions, $vector, $limit],
            );
        } else {
            $rows = DB::table('tutor_message_embeddings as e')
                ->join('tutor_messages as m', 'm.id', '=', 'e.tutor_message_id')
                ->where('e.user_id', $user->id)
                ->where('e.model', $embeddingModel)
                ->where('e.dimensions', $embeddingDimensions)
                ->where('e.content', 'like', '%'.$data['query'].'%')
                ->latest('m.created_at')
                ->limit($limit)
                ->get([
                    'e.tutor_message_id',
                    'e.tutor_conversation_id',
                    'e.content',
                    'e.model',
                    'e.dimensions',
                    'm.role',
                    'm.created_at',
                ])
                ->map(fn ($row) => (object) [...(array) $row, 'score' => null]);
        }

        return response()->json([
            'data' => [
                'available' => true,
                'hits' => collect($rows)->map(fn ($row) => [
                    'message_id' => (int) $row->tutor_message_id,
                    'conversation_id' => (int) $row->tutor_conversation_id,
                    'role' => $row->role,
                    'content' => Str::limit($row->content, 700),
                    'score' => isset($row->score) ? round((float) $row->score, 4) : null,
                    'model' => $row->model,
                    'dimensions' => (int) $row->dimensions,
                    'created_at' => $row->created_at,
                ]),
            ],
        ]);
    }

    public function historyAroundMessage(Request $request, TutorMessage $message): JsonResponse
    {
        abort_unless((int) $message->user_id === (int) $request->user()->id, 404);

        $data = $request->validate([
            'before' => ['nullable', 'integer', 'min:0', 'max:10'],
            'after' => ['nullable', 'integer', 'min:0', 'max:10'],
        ]);
        $before = $data['before'] ?? 5;
        $after = $data['after'] ?? 5;

        $previous = TutorMessage::query()
            ->where('tutor_conversation_id', $message->tutor_conversation_id)
            ->where('id', '<', $message->id)
            ->latest('id')
            ->limit($before)
            ->get()
            ->reverse()
            ->values();

        $next = TutorMessage::query()
            ->where('tutor_conversation_id', $message->tutor_conversation_id)
            ->where('id', '>', $message->id)
            ->oldest('id')
            ->limit($after)
            ->get();

        return response()->json([
            'data' => [
                'conversation_id' => $message->tutor_conversation_id,
                'target_message_id' => $message->id,
                'messages' => $previous
                    ->concat([$message])
                    ->concat($next)
                    ->map(fn (TutorMessage $item) => [
                        'id' => $item->id,
                        'role' => $item->role,
                        'text' => $item->original_text,
                        'created_at' => $item->created_at,
                    ])
                    ->values(),
            ],
        ]);
    }

    /** @return array<string, mixed> */
    private function serializeDifficultWord(TutorDifficultWord $word): array
    {
        return [
            'id' => $word->id,
            'word' => $word->word,
            'lemma' => $word->lemma,
            'language' => $word->language,
            'translation_ru' => $word->translation_ru,
            'status' => $word->status,
            'difficulty' => $word->difficulty,
            'confidence' => $word->confidence,
            'examples' => $word->examples,
            'last_seen_at' => $word->last_seen_at,
        ];
    }

    /** @return array<string, mixed> */
    private function serializeMemoryNote(TutorMemoryNote $note): array
    {
        return [
            'id' => $note->id,
            'category' => $note->category,
            'key' => $note->key,
            'content' => $note->content,
            'importance' => $note->importance,
            'evidence' => $note->evidence,
            'last_seen_at' => $note->last_seen_at,
            'created_at' => $note->created_at,
            'updated_at' => $note->updated_at,
        ];
    }
}
