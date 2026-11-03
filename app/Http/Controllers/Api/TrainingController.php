<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\DenseTrainingService;
use App\Services\TrainingProgressService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TrainingController extends Controller
{
    public function __construct(
        private TrainingProgressService $progress,
        private DenseTrainingService $dense,
    ) {}

    public function updateProgress(Request $request): JsonResponse
    {
        $data = $request->validate([
            'word_id' => ['required', 'integer', 'exists:dictionary_words,id'],
            'is_revert' => ['required', 'boolean'],
        ]);

        $row = $this->progress->updateProgress(
            (int) $request->user()->id,
            (int) $data['word_id'],
            (bool) $data['is_revert'],
        );

        return response()->json(['data' => $row]);
    }

    public function attempt(Request $request): JsonResponse
    {
        $data = $request->validate([
            'word_id' => ['required', 'integer', 'exists:dictionary_words,id'],
            'is_revert' => ['required', 'boolean'],
            'is_correct' => ['required', 'boolean'],
            'is_first_attempt' => ['required', 'boolean'],
            'cooldown_tier' => ['nullable', 'integer', 'min:0', 'max:2'],
        ]);

        $row = $this->progress->updateAttempts(
            (int) $request->user()->id,
            (int) $data['word_id'],
            (bool) $data['is_revert'],
            (bool) $data['is_correct'],
            (bool) $data['is_first_attempt'],
            (int) ($data['cooldown_tier'] ?? 0),
        );

        return response()->json(['data' => $row]);
    }

    public function resetCategory(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['nullable', 'integer', 'exists:dictionary_categories,id'],
            'word_ids' => ['nullable', 'array'],
            'word_ids.*' => ['integer'],
        ]);

        $userId = (int) $request->user()->id;

        if (! empty($data['word_ids'])) {
            $this->progress->resetWords($userId, $data['word_ids']);
        } elseif (! empty($data['category_id'])) {
            $this->progress->resetCategory($userId, (int) $data['category_id']);
        }

        if (! empty($data['category_id'])) {
            $this->dense->clear($userId, (int) $data['category_id']);
        }

        return response()->json(['ok' => true]);
    }

    public function resetWord(Request $request): JsonResponse
    {
        $data = $request->validate([
            'word_id' => ['required', 'integer', 'exists:dictionary_words,id'],
        ]);

        $this->progress->resetWords((int) $request->user()->id, [(int) $data['word_id']]);

        return response()->json(['ok' => true]);
    }

    public function setCategoryEasyMode(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['nullable', 'integer', 'exists:dictionary_categories,id'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'exists:dictionary_categories,id'],
        ]);

        $ids = $data['category_ids'] ?? [];
        if (! empty($data['category_id'])) {
            $ids[] = (int) $data['category_id'];
        }
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if ($ids === []) {
            return response()->json(['message' => 'Нужен category_id'], 422);
        }

        $count = $this->progress->setCategoriesEasyMode((int) $request->user()->id, $ids);

        return response()->json(['message' => 'Категория переведена в easy mode', 'updated' => $count]);
    }

    public function demoteCategoryScores(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['nullable', 'integer', 'exists:dictionary_categories,id'],
            'category_ids' => ['nullable', 'array'],
            'category_ids.*' => ['integer', 'exists:dictionary_categories,id'],
        ]);

        $ids = $data['category_ids'] ?? [];
        if (! empty($data['category_id'])) {
            $ids[] = (int) $data['category_id'];
        }
        $ids = array_values(array_unique(array_map('intval', $ids)));
        if ($ids === []) {
            return response()->json(['message' => 'Нужен category_id'], 422);
        }

        $count = $this->progress->demoteCategoryScoresToOne((int) $request->user()->id, $ids);

        return response()->json(['message' => "Понижено баллов у слов: {$count}", 'updated' => $count]);
    }

    public function denseState(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['required', 'integer', 'exists:dictionary_categories,id'],
            'apply_rotate' => ['sometimes', 'boolean'],
        ]);

        return response()->json([
            'data' => $this->dense->getState(
                (int) $request->user()->id,
                (int) $data['category_id'],
                (bool) ($data['apply_rotate'] ?? true),
            ),
        ]);
    }

    public function denseAddWords(Request $request): JsonResponse
    {
        $data = $request->validate([
            'dictionary_id' => ['required', 'integer', 'exists:dictionaries,id'],
            'category_id' => ['required', 'integer', 'exists:dictionary_categories,id'],
            'word_ids' => ['required', 'array', 'min:1'],
            'word_ids.*' => ['integer'],
            'use_random' => ['sometimes', 'boolean'],
        ]);

        return response()->json([
            'data' => $this->dense->addWords(
                (int) $request->user()->id,
                (int) $data['dictionary_id'],
                (int) $data['category_id'],
                $data['word_ids'],
                (bool) ($data['use_random'] ?? true),
            ),
        ]);
    }

    public function denseRemoveWord(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['required', 'integer', 'exists:dictionary_categories,id'],
            'word_id' => ['required', 'integer'],
        ]);

        return response()->json([
            'data' => $this->dense->removeWord(
                (int) $request->user()->id,
                (int) $data['category_id'],
                (int) $data['word_id'],
            ),
        ]);
    }

    public function denseSubmitAnswer(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['required', 'integer', 'exists:dictionary_categories,id'],
            'word_id' => ['required', 'integer'],
            'is_revert' => ['required', 'boolean'],
            'is_correct' => ['required', 'boolean'],
        ]);

        return response()->json([
            'data' => $this->dense->submitAnswer(
                (int) $request->user()->id,
                (int) $data['category_id'],
                (int) $data['word_id'],
                (bool) $data['is_revert'],
                (bool) $data['is_correct'],
            ),
        ]);
    }

    public function denseTick(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['required', 'integer', 'exists:dictionary_categories,id'],
        ]);

        return response()->json([
            'data' => $this->dense->tick((int) $request->user()->id, (int) $data['category_id']),
        ]);
    }

    public function denseClear(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['required', 'integer', 'exists:dictionary_categories,id'],
        ]);

        return response()->json([
            'data' => $this->dense->clear((int) $request->user()->id, (int) $data['category_id']),
        ]);
    }

    public function denseMatchSuccess(Request $request): JsonResponse
    {
        $data = $request->validate([
            'category_id' => ['required', 'integer', 'exists:dictionary_categories,id'],
        ]);

        return response()->json([
            'data' => $this->dense->matchGameSuccess((int) $request->user()->id, (int) $data['category_id']),
        ]);
    }
}
