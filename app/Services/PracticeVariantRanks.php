<?php

namespace App\Services;

use App\Models\LessonBlockAttempt;
use App\Models\LessonBlockResponse;
use App\Models\LessonPage;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;

class PracticeVariantRanks
{
    public function __construct(private CoursePracticeVariants $variants) {}

    /**
     * @param Collection<int, LessonPage> $pages Published navigation candidates for the current page.
     * @return array{pages: array<int, array>, aggregate: array}
     */
    public function summariesForPages(?int $userId, LessonPage $context, Collection $pages): array
    {
        $pages = $pages->filter(fn ($page) => $context->course_group_id !== null
            && $page->course_group_id === $context->course_group_id && $page->learn_lang === $context->learn_lang
            && $page->is_published && $page->status === 'published'
            && in_array($page->skill, CoursePracticeVariants::SKILLS, true))
            ->sortBy('id')->unique('skill')->values();
        (new EloquentCollection($pages->all()))->loadMissing('blocks.page', 'blocks.variants');
        $required = $pages->mapWithKeys(fn ($page) => [$page->id => $page->blocks
            ->filter(fn ($block) => $block->is_required && !$block->isRetiredCoursePractice() && $this->variants->isCoursePractice($block))]);
        $blocks = $required->flatten(1)->unique('id');
        $available = $blocks->mapWithKeys(fn ($block) => [$block->id => $this->variants->available($block)]);
        $variantIds = $available->flatten(1)->pluck('id');
        $scores = collect();
        $accepted = collect();
        if ($userId !== null && $variantIds->isNotEmpty()) {
            $scores = LessonBlockAttempt::query()->where('user_id', $userId)->where('is_practice', false)
                ->whereIn('lesson_block_id', $blocks->pluck('id'))
                ->whereIn('lesson_block_variant_id', $variantIds)
                ->select('lesson_block_id', 'lesson_block_variant_id')->selectRaw('MAX(score) AS best_score')
                ->groupBy('lesson_block_id', 'lesson_block_variant_id')->get()->toBase()
                ->mapWithKeys(fn ($row) => [$row->lesson_block_id.':'.$row->lesson_block_variant_id => (int) $row->best_score]);
            $accepted = LessonBlockResponse::query()->where('user_id', $userId)->where('status', 'accepted')
                ->whereIn('lesson_block_id', $blocks->whereIn('type', ['writing', 'speaking'])->pluck('id'))
                ->whereIn('lesson_block_variant_id', $variantIds)
                ->select('lesson_block_id', 'lesson_block_variant_id')->distinct()->get()->toBase()
                ->mapWithKeys(fn ($row) => [$row->lesson_block_id.':'.$row->lesson_block_variant_id => true]);
        }

        $summaries = $required->map(fn ($pageBlocks) => $this->summaries($pageBlocks, $available, $scores, $accepted))->all();
        $aggregate = $this->summaries($blocks, $available, $scores, $accepted);
        foreach ($aggregate as $index => &$summary) {
            $summary['skills_passed'] = collect($summaries)->filter(fn ($pageSummaries) => $pageSummaries[$index]['completed'])->count();
            $summary['skills_total'] = 4;
            // A completed subset must not award an overall rank when another skill is missing.
            $summary['completed'] = $pages->count() === count(CoursePracticeVariants::SKILLS)
                && collect($summaries)->every(fn ($pageSummaries) => $pageSummaries[$index]['completed']);
            if (!$summary['completed']) $summary['rank'] = null;
        }
        unset($summary);

        return ['pages' => $summaries, 'aggregate' => $aggregate];
    }

    public function emptySummaries(): array
    {
        return $this->summaries(collect(), collect(), collect(), collect());
    }

    /** @return list<array{number: int, rank: ?string, score: ?int, passed: int, total: int, ungraded_total: int, completed: bool}> */
    private function summaries(Collection $blocks, Collection $available, Collection $scores, Collection $accepted): array
    {
        $summaries = [];
        foreach ([1, 2, 3] as $number) {
            $passed = $total = $ungraded = $scoredTotal = $scoreSum = 0;
            $hasScore = false;
            foreach ($blocks as $block) {
                $variant = $available->get($block->id)?->get($number - 1);
                $total++;
                $key = $block->id.':'.$variant?->id;
                if (in_array($block->type, ['reading', 'listening'], true) || ($variant && $scores->has($key))) {
                    $scoredTotal++;
                    $score = $variant ? $scores->get($key) : null;
                    $hasScore = $hasScore || $score !== null;
                    $scoreSum += $score ?? 0;
                    if ($score !== null && $score >= 60) $passed++;
                } elseif ($variant && $accepted->has($key)) {
                    $passed++;
                    $ungraded++;
                }
            }
            $score = $hasScore ? intdiv($scoreSum, $scoredTotal) : null;
            $completed = $total > 0 && $passed === $total;
            $summaries[] = [
                'number' => $number,
                'rank' => $completed && $ungraded === 0 ? LessonProgressService::rankFor($score) : null,
                'score' => $score,
                'passed' => $passed,
                'total' => $total,
                'ungraded_total' => $ungraded,
                'completed' => $completed,
            ];
        }
        return $summaries;
    }
}
