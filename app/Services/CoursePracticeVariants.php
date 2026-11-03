<?php

namespace App\Services;

use App\Models\LessonBlock;
use Illuminate\Support\Collection;

class CoursePracticeVariants
{
    public const SKILLS = ['listening', 'reading', 'writing', 'speaking'];

    public function isCoursePractice(LessonBlock $block): bool
    {
        return $block->page?->course_group_id !== null
            && in_array($block->page?->skill, self::SKILLS, true)
            && $block->type === $block->page->skill && ! $block->source_block_id;
    }

    public function available(LessonBlock $block): Collection
    {
        $block = $block->trainingBlock();
        if (! $block) return collect();
        $block->loadMissing('variants');
        $variants = $block->variants->where('is_published', true)->sortBy([
            ['position', 'asc'], ['id', 'asc'],
        ]);

        return ($this->isCoursePractice($block) || $block->type === 'grammar'
            ? $variants->filter(fn ($variant) => $variant->practice_archived_at === null)->take(3)
            : $variants)->values();
    }
}
