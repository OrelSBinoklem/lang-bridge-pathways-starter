<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExamAttempt extends Model
{
    protected $guarded = ['id'];
    protected $attributes = ['status' => 'running', 'section_index' => 0, 'retain_audio' => false, 'grading_tries' => 0];
    protected function casts(): array
    {
        return [
            'snapshot' => 'array', 'answers' => 'array', 'playbacks' => 'array', 'results' => 'array',
            'started_at' => 'immutable_datetime', 'deadline_at' => 'immutable_datetime',
            'submitted_at' => 'immutable_datetime', 'next_attempt_at' => 'immutable_datetime',
            'grading_started_at' => 'immutable_datetime', 'reviewed_at' => 'immutable_datetime',
            'passed' => 'boolean', 'retain_audio' => 'boolean', 'score' => 'float',
        ];
    }
    public function exam() { return $this->belongsTo(CourseExam::class, 'course_exam_id'); }
    public function user() { return $this->belongsTo(User::class); }
    public function variant() { return $this->belongsTo(ExamVariant::class, 'exam_variant_id'); }
}
