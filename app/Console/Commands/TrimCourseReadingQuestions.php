<?php

namespace App\Console\Commands;

use App\Models\LessonBlock;
use Illuminate\Support\Collection;
use RuntimeException;
use stdClass;

class TrimCourseReadingQuestions extends TrimCourseListeningQuestions
{
    protected const SKILL = 'reading';

    protected const TASK_KIND = 'reading_binary';

    protected const MANIFEST_ROOT = 'resources/course/reading-revisions';

    protected const BACKUP_ROOT = '.tmp/reading-question-backups';

    protected const ALLOW_EXPLANATION_EVIDENCE = true;

    protected $signature = 'course:trim-reading-questions {manifest} {--apply : Apply after validation and a checked backup} {--production : Explicitly allow the verified production installation}';

    protected $description = 'Trim only questions of the complete active ordinary course reading_binary scope; dry-run by default';

    protected function evidenceSources(stdClass $config): array
    {
        return is_string($config->text ?? null) ? [$config->text] : [];
    }

    protected function evidencePrefix(): string
    {
        return "Tekst\u{0101}: ";
    }

    protected function includesBlock(LessonBlock $block, Collection $available): bool
    {
        $kind = null;
        // Classify the already selected active three, never filter before the availability cap.
        foreach ($available as $variant) {
            $config = json_decode($variant->getRawOriginal('config'), false, 512, JSON_THROW_ON_ERROR);
            if (! $config instanceof stdClass || ! in_array($config->task_kind ?? null, [static::TASK_KIND, 'lv_to_ru'], true)) {
                throw new RuntimeException('Unknown or malformed reading task kind in block '.$block->id.'.');
            }
            if ($kind !== null && $kind !== $config->task_kind) {
                throw new RuntimeException('Mixed reading task kinds in block '.$block->id.'.');
            }
            $kind = $config->task_kind;
        }

        return $kind === static::TASK_KIND;
    }
}
