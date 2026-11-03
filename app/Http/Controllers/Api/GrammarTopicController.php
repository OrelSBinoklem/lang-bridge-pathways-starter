<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\GrammarTopic;
use App\Models\LessonBlockProgress;
use App\Services\GrammarTopicProgress;
use App\Services\GrammarTableBindings;
use App\Services\LessonProgressService;
use Illuminate\Http\Request;

class GrammarTopicController extends Controller
{
    public function index(Request $request)
    {
        $lang = strtolower((string) $request->query('learn_lang', 'lv'));
        $bindings = app(GrammarTableBindings::class);
        $topics = GrammarTopic::with('page.blocks.sourceBlock.page.grammarTopic', 'page.blocks.page.grammarTopic')->whereHas('page', fn ($q) => $q
            ->where('learn_lang', $lang)->where('skill', 'grammar')->where('status', 'published')->where('is_published', true))->get();
        $ids = $topics->flatMap(fn ($topic) => $topic->page->blocks->map(fn ($block) => $block->trainingBlock()?->id))->filter()->unique();
        $progress = LessonBlockProgress::where('user_id', $request->user()->id)
            ->whereIn('lesson_block_id', $ids)->get()->keyBy('lesson_block_id');
        return response()->json(['data' => $topics->map(fn ($topic) => [
            'id' => $topic->id, 'slug' => $topic->page->slug, 'title' => $topic->page->title,
            'level' => $topic->page->level, 'learn_lang' => $topic->page->learn_lang, 'description' => $topic->page->description,
            'course_group_id' => $topic->page->course_group_id,
            'table_keys' => array_values(array_unique(array_merge($bindings->resolve($topic->table_keys ?? []),
                ...$topic->page->blocks->map(fn ($block) => $bindings->forBlock($block)['grammar_table_keys'])->all()))),
            'has_extensions' => $topic->page->blocks->contains(fn ($block) => $bindings->forBlock($block)['is_extension']),
            'blocks' => $topic->page->blocks->where('type', 'grammar')->values()->map(function ($block) use ($progress, $bindings) {
                $score = $progress->get($block->trainingBlock()?->id)?->best_score;
                $rank = LessonProgressService::rankFor($score);
                return [
                    'id' => $block->id, 'source_block_id' => $block->source_block_id,
                    'title' => $block->title, 'is_required' => $block->is_required,
                    'best_score' => $score, 'rank' => $rank,
                    'rank_label' => LessonProgressService::rankLabel($rank),
                    ...$bindings->forBlock($block),
                ];
            }),
            'summary' => GrammarTopicProgress::summary($topic->page->blocks->map(fn ($block) => [
                'is_required' => $block->is_required,
                'progress' => ['best_score' => $progress->get($block->trainingBlock()?->id)?->best_score],
            ])->all()),
        ])])->header('Cache-Control', 'private, no-store');
    }
}
