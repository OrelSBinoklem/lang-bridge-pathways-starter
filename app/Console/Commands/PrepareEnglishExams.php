<?php

namespace App\Console\Commands;

use App\Models\CourseExam;
use App\Models\ExamVariant;
use App\Services\Exams\EnglishExamPackage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class PrepareEnglishExams extends Command
{
    protected $signature = 'exams:prepare-english {--write : Insert new English exams only} {--publish : Require verified audio and publish all twenty variants}';

    protected $description = 'Validate/install twenty original English exams, preserving Latvian exams and existing administrator edits';

    public function handle(EnglishExamPackage $package): int
    {
        try {
            $variants = $package->load((bool) $this->option('publish'));
            $this->info('Validated '.count($variants).' English variants; four skills per variant.');
            if (! $this->option('write')) {
                $this->line('Read-only validation. Use --write to install.');

                return self::SUCCESS;
            }
            DB::transaction(function () use ($variants) {
                foreach (['A1', 'A2', 'B1', 'B2'] as $level) {
                    $exam = CourseExam::firstOrCreate(['level' => $level, 'learn_lang' => 'en'], ['title' => 'Английский · '.$level, 'is_published' => false]);
                    $existing = $exam->variants()->lockForUpdate()->get()->keyBy('position');
                    $rows = array_values(array_filter($variants, fn ($content) => $content['level'] === $level));
                    foreach ($rows as $index => $content) {
                        $variant = $existing->get($index + 1);
                        if ($variant) {
                            // An identical rerun is safe. Any edit, including publication state, is retained.
                            if ($variant->content != $content) {
                                throw new RuntimeException('Existing English variant differs; review an explicit revision instead of overwriting: '.$level.' #'.($index + 1));
                            }

                            continue;
                        }
                        ExamVariant::create(['course_exam_id' => $exam->id, 'position' => $index + 1, 'title' => $content['title'], 'content' => $content, 'is_published' => (bool) $this->option('publish')]);
                    }
                    if ($existing->isEmpty() && $this->option('publish')) {
                        $exam->update(['is_published' => true]);
                    }
                }
            });
            $this->info('English exams installed. Existing exams/attempts were not replaced.');

            return self::SUCCESS;
        } catch (\Throwable $error) {
            $this->error($error->getMessage());

            return self::FAILURE;
        }
    }
}
