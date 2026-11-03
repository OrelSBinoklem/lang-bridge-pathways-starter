<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\TutorCategoryVocabularyContext;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TutorCategoryVocabularyController extends Controller
{
    public function index(Request $request, TutorCategoryVocabularyContext $context): JsonResponse
    {
        $validated = $request->validate([
            'category_id' => ['required', 'integer', 'min:1'],
            'dictionary_id' => ['nullable', 'integer', 'min:1'],
        ]);

        return response()->json([
            'data' => $context->build((int) $validated['category_id'], isset($validated['dictionary_id']) ? (int) $validated['dictionary_id'] : null),
        ]);
    }
}
