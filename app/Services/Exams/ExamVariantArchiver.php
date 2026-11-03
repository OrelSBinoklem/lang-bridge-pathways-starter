<?php

namespace App\Services\Exams;

use App\Models\{ExamVariant, ExamVariantArchive};
use Illuminate\Support\Facades\DB;

class ExamVariantArchiver
{
    public function archive(ExamVariant $variant, string $reason, ?int $actor = null): ExamVariantArchive
    {
        return DB::transaction(function () use ($variant, $reason, $actor) {
            $current = ExamVariant::with('exam')->lockForUpdate()->findOrFail($variant->getKey());
            return ExamVariantArchive::firstOrCreate(
                ['exam_variant_id' => $current->id, 'fingerprint' => $this->fingerprint($current)],
                ['course_exam_id' => $current->course_exam_id, 'level' => $current->exam->level,
                    'learn_lang' => $current->exam->learn_lang, 'position' => $current->position,
                    'title' => $current->title, 'content' => $current->content,
                    'was_published' => $current->is_published, 'reason' => $reason,
                    'archived_by' => $actor, 'archived_at' => now()]
            );
        });
    }

    public function fingerprint(ExamVariant $variant): string
    {
        return hash('sha256', json_encode([$variant->course_exam_id, $variant->position, $variant->title, $variant->content], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
    }
}
