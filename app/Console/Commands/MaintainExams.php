<?php

namespace App\Console\Commands;

use App\Models\ExamAttempt;
use App\Services\Exams\{ExamSession, ExamGrader};
use Illuminate\Console\Command;
use Illuminate\Support\Facades\{DB, Storage};

class MaintainExams extends Command
{
    protected $signature = 'exams:maintain';
    protected $description = 'Expire exam timers, grade submitted attempts and remove expired private recordings';

    public function handle(ExamSession $sessions, ExamGrader $grader): int
    {
        ExamAttempt::where('status', 'running')->where('deadline_at', '<=', now())->eachById(fn ($a) => $sessions->locked($a->id, $a->user_id, fn () => null));
        ExamAttempt::where('status', 'pending')->where('grading_tries', '<', 3)->where('updated_at', '<', now()->subMinute())->orderBy('id')->limit(20)->get()->each(fn ($a) => $grader->grade($a->id));
        ExamAttempt::where('status', 'grading')->where('grading_tries', '<', 3)->where('grading_started_at', '<', now()->subMinutes(10))->orderBy('id')->limit(20)->get()->each(fn ($a) => $grader->grade($a->id));
        DB::table('exam_recordings')->where('expires_at', '<=', now())->orderBy('id')->each(function ($record) {
            if (Storage::disk('local')->delete($record->path)) DB::table('exam_recordings')->where('id', $record->id)->delete();
        });
        return self::SUCCESS;
    }
}
