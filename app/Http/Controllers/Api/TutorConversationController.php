<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TutorConversation;
use App\Services\Tutor\OpenAiEmbeddingService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class TutorConversationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $conversations = TutorConversation::query()
            ->where('user_id', $request->user()->id)
            ->withCount('messages')
            ->latest('updated_at')
            ->limit(30)
            ->get();

        return response()->json([
            'data' => $conversations->map(fn (TutorConversation $conversation) => $this->serializeConversation($conversation)),
        ]);
    }

    public function current(Request $request): JsonResponse
    {
        $conversation = $this->currentConversation($request);

        return response()->json([
            'data' => $this->serializeConversation($this->ensureConversationCount($conversation)),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $conversation = TutorConversation::query()->create([
            'user_id' => $request->user()->id,
            'status' => 'active',
            'started_at' => now(),
            'metadata' => [
                'source' => 'floating_widget',
            ],
        ]);

        return response()->json([
            'data' => $this->serializeConversation($this->ensureConversationCount($conversation)),
        ], 201);
    }

    public function messages(Request $request, TutorConversation $conversation): JsonResponse
    {
        abort_unless((int) $conversation->user_id === (int) $request->user()->id, 404);

        $data = $request->validate([
            'limit' => ['nullable', 'integer', 'min:1', 'max:30'],
            'before_id' => ['nullable', 'integer', 'min:1'],
        ]);
        $limit = $data['limit'] ?? 30;

        // Journal deltas are internal context records, not learner chat bubbles.
        // Filter before pagination; normal system/status messages remain visible.
        $query = $conversation->messages()
            ->where(fn ($query) => $query->where('role', '!=', 'system')
                ->orWhereNull('metadata->kind')
                ->orWhere('metadata->kind', '!=', 'state_delta'))
            ->latest('id');
        if (! empty($data['before_id'])) {
            $query->where('id', '<', $data['before_id']);
        }

        $messages = $query
            ->limit($limit + 1)
            ->get();
        $hasMore = $messages->count() > $limit;
        $messages = $messages
            ->take($limit)
            ->reverse()
            ->values();

        return response()->json([
            'data' => [
                'conversation' => $this->serializeConversation($this->ensureConversationCount($conversation)),
                'pagination' => [
                    'limit' => $limit,
                    'has_more' => $hasMore,
                    'before_id' => $messages->first()?->id,
                ],
                'messages' => $messages->map(fn ($message) => [
                    'id' => $message->id,
                    'role' => $message->role,
                    'text' => $message->original_text,
                    'source' => $message->source,
                    'metadata' => $message->metadata,
                    'created_at' => $message->created_at,
                ]),
            ],
        ]);
    }

    public function storeMessage(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'conversation_id' => ['nullable', 'integer', 'exists:tutor_conversations,id'],
            'role' => ['required', 'string', Rule::in(['system', 'user', 'assistant', 'tool'])],
            'original_text' => ['nullable', 'string'],
            'model_heard_text' => ['nullable', 'string'],
            'corrected_text' => ['nullable', 'string'],
            'correction_explanation_ru' => ['nullable', 'string'],
            'language' => ['nullable', 'string', 'max:20'],
            'source' => ['nullable', 'string', 'max:50'],
            'metadata' => ['nullable', 'array'],
            'embedding_model' => ['nullable', 'string', Rule::in(['text-embedding-3-small', 'text-embedding-3-large'])],
            'embedding_dimensions' => ['nullable', 'integer', Rule::in([1536])],
            'index_memory' => ['sometimes', 'boolean'],
        ]);

        $conversation = ! empty($data['conversation_id'])
            ? TutorConversation::query()
                ->where('user_id', $user->id)
                ->findOrFail($data['conversation_id'])
            : $this->currentConversation($request);

        $message = $conversation->messages()->create([
            'user_id' => $user->id,
            'role' => $data['role'],
            'original_text' => $data['original_text'] ?? null,
            'model_heard_text' => $data['model_heard_text'] ?? null,
            'corrected_text' => $data['corrected_text'] ?? null,
            'correction_explanation_ru' => $data['correction_explanation_ru'] ?? null,
            'language' => $data['language'] ?? null,
            'source' => $data['source'] ?? 'widget',
            'metadata' => $data['metadata'] ?? null,
        ]);
        $conversation->touch();
        $embedding = ($data['index_memory'] ?? true) ? app(OpenAiEmbeddingService::class)->embedTutorMessage(
            $message,
            $data['embedding_model'] ?? null,
            $data['embedding_dimensions'] ?? null,
        ) : ['ok' => true, 'skipped' => true, 'error' => 'long_memory_disabled'];

        return response()->json([
            'data' => [
                'conversation' => $this->serializeConversation($this->ensureConversationCount($conversation)),
                'message' => [
                    'id' => $message->id,
                    'role' => $message->role,
                    'source' => $message->source,
                    'created_at' => $message->created_at,
                    'embedding' => $embedding,
                ],
            ],
        ], 201);
    }

    private function currentConversation(Request $request): TutorConversation
    {
        return TutorConversation::query()
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->latest('id')
            ->first()
            ?? TutorConversation::query()->create([
                'user_id' => $request->user()->id,
                'status' => 'active',
                'started_at' => now(),
                'metadata' => [
                    'source' => 'floating_widget',
                ],
            ]);
    }

    /** @return array<string, mixed> */
    private function serializeConversation(TutorConversation $conversation): array
    {
        return [
            'id' => $conversation->id,
            'title' => $this->conversationTitle($conversation),
            'status' => $conversation->status,
            'started_at' => $conversation->started_at,
            'ended_at' => $conversation->ended_at,
            'summary' => $conversation->summary,
            'messages_count' => $conversation->messages_count ?? null,
            'updated_at' => $conversation->updated_at,
        ];
    }

    private function ensureConversationCount(TutorConversation $conversation): TutorConversation
    {
        if (! array_key_exists('messages_count', $conversation->getAttributes())) {
            $conversation->loadCount('messages');
        }

        return $conversation;
    }

    private function conversationTitle(TutorConversation $conversation): string
    {
        if (! empty($conversation->summary)) {
            return Str::limit($conversation->summary, 48);
        }

        $firstMessage = $conversation->messages()
            ->whereIn('role', ['user', 'assistant'])
            ->oldest('id')
            ->first();

        if ($firstMessage?->original_text) {
            return Str::limit($firstMessage->original_text, 48);
        }

        return 'Новый диалог';
    }
}
