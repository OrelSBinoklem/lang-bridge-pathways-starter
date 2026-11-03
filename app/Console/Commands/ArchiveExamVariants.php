<?php

namespace App\Console\Commands;

use App\Models\ExamVariant;
use App\Services\Exams\ExamVariantArchiver;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class ArchiveExamVariants extends Command
{
    protected $signature = 'exams:archive {--level= : Optional A1, A2, B1 or B2} {--write} {--reason=Перед редакцией экзаменов}';
    protected $description = 'Archive fixed exam definitions for administrators without changing availability or attempts';

    public function handle(ExamVariantArchiver $archiver): int
    {
        $level = strtoupper((string) $this->option('level'));
        if ($level !== '' && !in_array($level, ['A1', 'A2', 'B1', 'B2'], true)) {
            $this->error('Choose A1, A2, B1 or B2.');
            return self::FAILURE;
        }
        $reason = trim((string) $this->option('reason'));
        if ($reason === '' || mb_strlen($reason) > 500) { $this->error('Reason must contain 1-500 characters.'); return self::FAILURE; }
        $query = ExamVariant::whereHas('exam', fn ($q) => $q->where('learn_lang', 'lv')->when($level !== '', fn ($q) => $q->where('level', $level)));
        $this->info('Variants: '.$query->count().'. '.($this->option('write') ? 'Archive only; no attempt updates.' : 'Dry run; no writes.'));
        if (!$this->option('write')) return self::SUCCESS;
        $created = DB::transaction(function () use ($query, $archiver, $reason) {
            $created = 0;
            foreach ($query->orderBy('id')->lockForUpdate()->get() as $variant) {
                if ($archiver->archive($variant, $reason)->wasRecentlyCreated) $created++;
            }
            return $created;
        });
        $this->info('New archive snapshots: '.$created.'. Existing audio files remain in place.');
        return self::SUCCESS;
    }
}
