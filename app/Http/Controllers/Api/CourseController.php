<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\CourseStep;
use App\Models\CourseGroup;
use App\Services\CourseCatalog;
use App\Services\LessonProgressService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class CourseController extends Controller
{
    public function index(Request $request)
    {
        $lang = strtolower((string) $request->query('learn_lang', 'lv'));
        $userId = $request->user()?->id;
        $groups = CourseGroup::with([
            'category',
            'lessonPages' => fn ($query) => $query->where('is_published', true)->where('status', 'published')->with('blocks'),
        ])->where('is_published', true)->where('learn_lang', $lang)->orderBy('position')->orderBy('id')->get();
        $skillProgress = $userId
            ? (new LessonProgressService)->summariesForPages((int) $userId, $groups->flatMap->lessonPages)
            : [];
        $groupOrder = $groups->pluck('id')->flip();
        $steps = CourseStep::where('is_published', true)->where('learn_lang', $lang)
            ->where(fn ($q) => $q->whereNull('group_id')->orWhereIn('group_id', $groups->pluck('id')))
            ->get()->sortBy(fn ($step) => [$groupOrder[$step->group_id] ?? PHP_INT_MAX, $step->position, $step->id])->values();
        $dictionaryIds = $steps->pluck('dictionary_id')->filter()->unique();
        $categories = DB::table('dictionary_categories')->whereIn('dictionary_id', $dictionaryIds)->get(['id', 'parent_id', 'dictionary_id']);
        $children = $categories->groupBy('parent_id');
        $links = DB::table('dictionary_word_category as links')
            ->join('dictionary_words as words', 'words.id', '=', 'links.word_id')
            ->whereIn('words.dictionary_id', $dictionaryIds)
            ->get(['links.category_id', 'links.word_id', 'words.dictionary_id'])->groupBy('category_id');
        $progress = $userId ? DB::table('user_dictionary_words')->where('user_id', $userId)
            ->whereIn('dict_word_id', $links->flatten(1)->pluck('word_id')->unique())
            ->get(['dict_word_id', 'correct_attempts', 'correct_attempts_revert'])->keyBy('dict_word_id') : collect();
        $grammar = collect(CourseCatalog::grammar())->keyBy('id');
        $blocked = false;
        $levels = [];
        foreach (['A1', 'A2', 'B1', 'B2'] as $level) {
            $previousLevelsBlocked = $blocked;
            $items = [];
            foreach ($steps->where('level', $level) as $step) {
                $total = $learned = 0;
                $available = true;
                if ($step->kind === 'category') {
                    $available = $step->category_id && $categories->contains(fn ($c) => $c->id == $step->category_id && $c->dictionary_id == $step->dictionary_id);
                    $pending = $available ? [$step->category_id] : [];
                    $seen = $wordIds = [];
                    while ($pending) {
                        $id = array_pop($pending);
                        if (isset($seen[$id])) continue;
                        $seen[$id] = true;
                        foreach ($children[$id] ?? [] as $child) $pending[] = $child->id;
                        foreach ($links[$id] ?? [] as $link) if ($link->dictionary_id == $step->dictionary_id) $wordIds[$link->word_id] = true;
                    }
                    $total = count($wordIds);
                    foreach (array_keys($wordIds) as $id) {
                        $row = $progress[$id] ?? null;
                        if ($row && $row->correct_attempts >= 2 && $row->correct_attempts_revert >= 2) ++$learned;
                    }
                } else $available = isset($grammar[$step->grammar_table_id]) && ($grammar[$step->grammar_table_id]['learn_lang'] ?? 'lv') === $lang;
                $complete = $step->kind === 'category' && $total > 0 && $total === $learned;
                $status = $complete ? 'completed' : ($blocked ? 'locked' : 'active');
                if ($step->kind === 'category' && !$complete) $blocked = true;
                $items[] = [
                    'id' => $step->id, 'title' => $step->title, 'description' => $step->description,
                    'group_id' => $step->group_id,
                    'kind' => $step->kind, 'status' => $status, 'available' => (bool) $available,
                    'dictionary_id' => $step->dictionary_id, 'category_id' => $step->category_id,
                    'grammar_table_id' => $step->grammar_table_id,
                    'grammar_href' => $step->kind === 'grammar' ? ($grammar[$step->grammar_table_id]['href'] ?? null) : null,
                    'custom_component' => $step->custom_component,
                    'image' => $step->kind === 'grammar' ? ($grammar[$step->grammar_table_id]['src'] ?? null) : null,
                    'total_words' => $total, 'learned_words' => $learned,
                    'percent' => $total ? (int) floor(100 * $learned / $total) : 0,
                ];
            }
            $scored = collect($items)->where('kind', 'category');
            $levelGroups = $groups->where('level', $level)->map(function ($group) use ($items, $skillProgress) {
                $members = collect($items)->where('group_id', $group->id)->where('kind', 'category');
                return ['id' => $group->id, 'title' => $group->display_title, 'dictionary_id' => $group->dictionary_id,
                    'category_id' => $group->category_id, 'completed' => $members->where('status', 'completed')->count(), 'total' => $members->count(),
                    'skills' => $group->lessonPages->whereNotNull('skill')->mapWithKeys(fn ($lesson) => [$lesson->skill => [
                        'slug' => $lesson->slug,
                        'status' => $lesson->status,
                        'progress' => $skillProgress[$lesson->id] ?? null,
                    ]])->all(),
                ];
            })->values()->all();
            $completed = $scored->where('status', 'completed')->count();
            $total = $scored->count();
            $passed = $total > 0 && $completed * 100 >= $total * 80;
            $levels[] = ['id' => $level, 'steps' => $items, 'groups' => $levelGroups, 'completed' => $completed, 'total' => $total,
                'status' => $passed ? 'completed' : ($previousLevelsBlocked ? 'locked' : 'active'),
                'perfect' => $total > 0 && $completed === $total];
            // Unfinished categories below the 20% allowance do not lock the next level.
            $blocked = $previousLevelsBlocked || !$passed;
        }
        $target = (int) ($request->user()?->course_target_score ?? 80);
        $levels = app(\App\Services\CourseLearningGuide::class)->annotate($levels, $target);
        return response()->json(['data' => $levels, 'authenticated' => (bool) $userId, 'learning_target' => $target])
            ->header('Cache-Control', 'private, no-store');
    }
}
