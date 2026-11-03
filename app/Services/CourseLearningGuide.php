<?php

namespace App\Services;

use App\Models\LessonBlockCompletion;
use App\Models\LessonBlockProgress;
use App\Models\LessonPage;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/** Recommendations only: no writes, unlock permissions, grading or provider calls. */
class CourseLearningGuide
{
    public const TARGETS = [60, 80, 90, 100];

    public const SKILLS = ['grammar', 'listening', 'reading', 'writing', 'speaking'];

    public function annotate(array $levels, int $target): array
    {
        $debt = 0;
        foreach ($levels as &$level) {
            foreach ($level['groups'] as &$group) {
                $words = collect($level['steps'])->where('group_id', $group['id'])->where('kind', 'category')->where('available', true);
                $parts = [];
                if ($words->sum('total_words') > 0) {
                    $parts['words'] = (int) floor(100 * $words->sum('learned_words') / $words->sum('total_words'));
                }
                $grammar = $group['skills']['grammar']['progress'] ?? null;
                if (($grammar['total'] ?? 0) > 0) {
                    $parts['grammar'] = $this->skillPercent($grammar);
                }
                $practice = collect($group['skills'] ?? [])->only(CoursePracticeVariants::SKILLS)
                    ->filter(fn ($skill) => ($skill['progress']['total'] ?? 0) > 0);
                if ($practice->isNotEmpty()) {
                    $parts['practice'] = intdiv(
                        $practice->sum(fn ($skill) => $this->skillPercent($skill['progress'])),
                        $practice->count()
                    );
                }
                $percent = $parts ? min(100, min($parts)) : 0;
                $group['learning'] = ['percent' => $percent, 'parts' => $parts, 'previous_debt' => $debt,
                    'active' => $parts !== [] && $debt <= $target * 2.5, 'target' => $target];
                // Empty placeholders are not learning content and do not accumulate artificial debt.
                if ($parts) {
                    $debt += max(0, $target - $percent);
                }
            }
        }
        unset($group, $level);

        return $levels;
    }

    private function skillPercent(array $progress): int
    {
        // Productive tasks without numerical grades use completion, not an invented answer grade.
        return max(0, min(100, $progress['best_score'] ?? (int) floor(100 * $progress['passed'] / max(1, $progress['total']))));
    }

    public function next(int $userId, array $levels, int $target): array
    {
        $groups = [];
        foreach ($levels as $level) {
            foreach ($level['groups'] as $group) {
                if ($group['learning']['active']) {
                    $groups[] = $group + ['level' => $level['id'], 'steps' => array_values(array_filter($level['steps'], fn ($step) => $step['group_id'] === $group['id']))];
                }
            }
        }
        $pages = LessonPage::with(['blocks' => fn ($q) => $q->orderBy('position')->orderBy('id'),
            'blocks.variants', 'blocks.page', 'blocks.sourceBlock.page', 'blocks.sourceBlock.variants'])
            ->whereIn('course_group_id', array_column($groups, 'id'))->where('is_published', true)->where('status', 'published')
            ->whereIn('skill', self::SKILLS)->orderBy('id')->get();
        $ids = $pages->flatMap(fn ($p) => $p->blocks->map(fn ($b) => $b->trainingBlock()?->id))->filter()->unique();
        $scores = $ids->isEmpty() ? collect() : LessonBlockProgress::where('user_id', $userId)->whereIn('lesson_block_id', $ids)->get()->keyBy('lesson_block_id');
        $completed = $ids->isEmpty() ? collect() : LessonBlockCompletion::where('user_id', $userId)->whereIn('lesson_block_id', $ids)->pluck('lesson_block_id')->flip();
        $progress = app(LessonProgressService::class);
        $waiting = [];
        $pending = false;
        $available = [];
        foreach ($groups as $group) {
            $destination = ['group_id' => $group['id'], 'group_title' => $group['title'], 'level' => $group['level']];
            foreach ($group['steps'] as $step) {
                if ($step['kind'] !== 'category' || ! $step['available'] || ! $step['total_words'] || $step['percent'] >= $target) {
                    continue;
                }
                $state = $this->words($userId, $step);
                if ($state['ready']) {
                    $available[] = $destination + ['skill' => 'words', 'title' => $step['title'], 'percent' => $step['percent'],
                        'href' => '/dictionaries/'.$step['dictionary_id'].'/category/'.$step['category_id']];
                    continue;
                }
                $pending = true;
                array_push($waiting, ...$state['waiting']);
            }
            foreach (self::SKILLS as $skill) {
                foreach ($pages->where('course_group_id', $group['id'])->where('skill', $skill) as $page) {
                    foreach ($page->blocks->where('is_required', true) as $placement) {
                        $block = $placement->trainingBlock();
                        if (! $block) {
                            continue;
                        }
                        $score = $scores->get($block->id);
                        $ungradedCompletion = in_array($block->type, ['writing', 'speaking'], true) && $completed->has($block->id);
                        $percent = $score?->best_score ?? ($ungradedCompletion ? 100 : 0);
                        if ($percent >= $target) {
                            continue;
                        }
                        $variant = $progress->selectedVariant($block, $userId);
                        $config = $variant?->config ?? $block->config ?? [];
                        if (! $config) {
                            continue;
                        }
                        $next = $score?->next_scored_at;
                        if (($config['task_kind'] ?? null) === 'grammar_items') {
                            $items = $progress->grammarItemStateFor($userId, $block, $config);
                            $ready = collect($items)->contains(fn ($item) => $item['available']);
                            if (! $ready) {
                                $pending = true;
                                foreach ($items as $item) {
                                    if ($item['next_review_at']) {
                                        $waiting[] = $item['next_review_at'];
                                    }
                                }

                                continue;
                            }
                        } elseif ($next?->isFuture()) {
                            $pending = true;
                            $waiting[] = $next->toIso8601String();

                            continue;
                        }

                        $available[] = $destination + ['skill' => $skill, 'block_id' => $placement->id,
                            'title' => $placement->title ?: $page->title, 'percent' => $percent,
                            'href' => '/lessons/'.rawurlencode($page->slug).'#lesson-block-'.$placement->id];
                    }
                }
            }
        }
        sort($waiting);

        if ($available) {
            return $this->ready($target, $available);
        }

        return ['target' => $target, 'debt_limit' => $target * 2.5, 'status' => $pending ? 'rest' : 'complete',
            'next' => null, 'available' => [], 'next_available_at' => $waiting[0] ?? null];
    }

    private function ready(int $target, array $available): array
    {
        return ['target' => $target, 'debt_limit' => $target * 2.5, 'status' => 'ready', 'next' => $available[0], 'available' => $available, 'next_available_at' => null];
    }

    private function words(int $userId, array $step): array
    {
        $categories = DB::table('dictionary_categories')->where('dictionary_id', $step['dictionary_id'])->get(['id', 'parent_id'])->groupBy('parent_id');
        $pending = [$step['category_id']];
        $seen = [];
        while ($pending) {
            $id = array_pop($pending);
            if (isset($seen[$id])) {
                continue;
            }
            $seen[$id] = true;
            foreach ($categories[$id] ?? [] as $child) {
                $pending[] = $child->id;
            }
        }
        $ids = DB::table('dictionary_word_category as links')->join('dictionary_words as words', 'words.id', '=', 'links.word_id')
            ->where('words.dictionary_id', $step['dictionary_id'])->whereIn('links.category_id', array_keys($seen))->distinct()->pluck('links.word_id');
        $rows = DB::table('user_dictionary_words')->where('user_id', $userId)->whereIn('dict_word_id', $ids)->get()->keyBy('dict_word_id');
        $waiting = [];
        foreach ($ids as $id) {
            foreach (['', '_revert'] as $suffix) {
                $row = $rows->get($id);
                $count = (int) ($row?->{'correct_attempts'.$suffix} ?? 0);
                if ($count >= 2 && ! ($row?->{'mode_education'.$suffix} ?? false)) {
                    continue;
                }
                $shown = $row?->{'last_shown'.$suffix} ?? null;
                if (! $shown || $count >= 2) {
                    return ['ready' => true, 'waiting' => []];
                }
                // Mirrors helpers.ts:getCooldownRemainingMs; this does not alter canonical word scoring.
                $seconds = $count === 0 ? 1800 : [72000, 1800, 10800][max(0, min(2, (int) ($row?->{'cooldown_tier'.$suffix} ?? 0)))];
                $next = Carbon::parse($shown, config('app.timezone'))->addSeconds($seconds);
                if (! $next->isFuture()) {
                    return ['ready' => true, 'waiting' => []];
                }
                $waiting[] = $next->toIso8601String();
            }
        }

        return ['ready' => false, 'waiting' => $waiting];
    }
}
