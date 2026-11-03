<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CourseExam extends Model
{
    protected $guarded = ['id'];
    protected function casts(): array { return ['is_published' => 'boolean']; }
    public function variants() { return $this->hasMany(ExamVariant::class)->orderBy('position'); }
    public function attempts() { return $this->hasMany(ExamAttempt::class); }
}
