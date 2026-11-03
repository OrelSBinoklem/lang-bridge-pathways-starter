<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ExamVariant extends Model
{
    protected $guarded = ['id'];
    protected $attributes = ['is_published' => false];
    protected function casts(): array { return ['content' => 'array', 'is_published' => 'boolean']; }
    public function exam() { return $this->belongsTo(CourseExam::class, 'course_exam_id'); }
    public function archives() { return $this->hasMany(ExamVariantArchive::class)->orderByDesc('archived_at'); }
    protected static function booted(): void
    {
        static::saving(function (self $variant) {
            if ($variant->is_published) app(\App\Services\Exams\ExamDefinition::class)->validate($variant->content ?? [], true);
        });
        static::updating(function (self $variant) {
            if ($variant->isDirty(['content', 'title', 'position', 'course_exam_id'])) {
                app(\App\Services\Exams\ExamVariantArchiver::class)->archive($variant, 'Перед изменением варианта', auth()->id());
            }
        });
    }
}
