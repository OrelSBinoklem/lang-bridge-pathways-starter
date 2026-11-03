<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\DictionaryCategory;
use App\Models\DictionaryWord;
use App\Services\ContentAudit\CategoryVocabularyAudit;
use App\Services\DictionaryCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class CategoryVocabularyAuditController extends Controller
{
    public function __invoke(Request $request, DictionaryCategory $category, CategoryVocabularyAudit $audit): JsonResponse
    {
        abort_unless($request->user()?->hasAnyRole(['admin', 'super_admin']), 403);
        $data = $request->validate([
            'topic' => ['nullable', 'string', 'max:255'],
            'descendants' => ['sometimes', 'boolean'],
            'mode' => ['sometimes', Rule::in(['exact', 'corpus', 'heuristic'])],
        ]);

        return response()->json(['data' => $audit->report($category, $data['topic'] ?? null,
            $request->boolean('descendants', true), $data['mode'] ?? 'corpus')])->header('Cache-Control', 'private, no-store');
    }

    public function word(Request $request, DictionaryCategory $category, CategoryVocabularyAudit $audit): JsonResponse
    {
        abort_unless($request->user()?->hasAnyRole(['admin', 'super_admin']), 403);
        $data = $request->validate([
            'word' => ['required', 'string', 'max:120', 'regex:/^\p{Latin}[\p{Latin}\p{M}]*(?:[-’\x{0027}][\p{Latin}\p{M}]+)*$/u'],
            'topic' => ['nullable', 'string', 'max:255'],
            'descendants' => ['sometimes', 'boolean'],
        ]);

        return response()->json(['data' => $audit->inspectWord($category, $data['word'], $data['topic'] ?? null,
            $request->boolean('descendants', true))])->header('Cache-Control', 'private, no-store');
    }

    public function place(Request $request, DictionaryCategory $category): JsonResponse
    {
        abort_unless($request->user()?->hasAnyRole(['admin', 'super_admin']), 403);
        $data = $request->validate([
            'word_id' => ['required', 'integer', 'exists:dictionary_words,id'],
            'target_category_id' => ['required', 'integer', 'exists:dictionary_categories,id'],
            'source_category_id' => ['nullable', 'integer', 'required_if:mode,move', 'exists:dictionary_categories,id'],
            'mode' => ['required', Rule::in(['move', 'add'])],
            'expected_category_ids' => ['present', 'array'],
            'expected_category_ids.*' => ['integer', 'distinct'],
        ]);
        $result = DB::transaction(function () use ($data, $category) {
            $word = DictionaryWord::query()->lockForUpdate()->findOrFail($data['word_id']);
            $target = DictionaryCategory::findOrFail($data['target_category_id']);
            abort_unless((int) $word->dictionary_id === (int) $category->dictionary_id
                && (int) $target->dictionary_id === (int) $category->dictionary_id, 422, 'Перенос допускается только внутри этого словаря.');
            $current = $word->categories()->pluck('dictionary_categories.id')->map(fn ($id) => (int) $id)->sort()->values()->all();
            $expected = array_map('intval', $data['expected_category_ids']);
            sort($expected);
            abort_unless($current === $expected, 409, 'Категории слова изменились. Обновите сведения и повторите выбор.');
            $source = (int) ($data['source_category_id'] ?? 0);
            if ($data['mode'] === 'move') {
                abort_unless(in_array($source, $current, true) && $source !== (int) $target->id, 422, 'Выберите существующую исходную и другую целевую категорию.');
            }
            // Preserve the word ID, translations, progress and every unrelated category link.
            $word->categories()->syncWithoutDetaching([$target->id]);
            if ($data['mode'] === 'move') {
                $word->categories()->detach($source);
            }

            return ['word_id' => $word->id, 'category_ids' => $word->categories()->pluck('dictionary_categories.id')->all()];
        });
        DictionaryCache::invalidate();

        return response()->json(['data' => $result])->header('Cache-Control', 'private, no-store');
    }
}
