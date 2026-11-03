<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use LogicException;

class ExamVariantArchive extends Model
{
    public $timestamps = false;
    protected $guarded = ['id'];
    protected function casts(): array { return ['content' => 'array', 'was_published' => 'boolean', 'archived_at' => 'datetime']; }
    public function variant() { return $this->belongsTo(ExamVariant::class, 'exam_variant_id'); }
    public function exam() { return $this->belongsTo(CourseExam::class, 'course_exam_id'); }
    public function archivist() { return $this->belongsTo(User::class, 'archived_by'); }

    protected static function booted(): void
    {
        static::updating(fn () => throw new LogicException('Archived exam versions are immutable.'));
        static::deleting(fn () => throw new LogicException('Archived exam versions must be retained.'));
    }
}
