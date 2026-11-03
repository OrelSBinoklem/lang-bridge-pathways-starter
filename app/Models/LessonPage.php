<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class LessonPage extends Model
{
    public const SKILLS = ['listening', 'reading', 'writing', 'speaking', 'grammar'];
    public const STATUSES = ['draft', 'generating', 'review', 'approved', 'published', 'archived'];

    protected $attributes = ['status' => 'draft'];

    protected $fillable = ['course_group_id', 'title', 'slug', 'seed_key', 'level', 'learn_lang', 'description', 'status', 'skill', 'is_published'];

    protected function casts(): array { return ['is_published' => 'boolean']; }

    public function blocks() { return $this->hasMany(LessonBlock::class)->orderBy('position'); }
    public function courseGroup() { return $this->belongsTo(CourseGroup::class, 'course_group_id'); }
    public function grammarTopic() { return $this->hasOne(GrammarTopic::class); }

    protected static function booted(): void
    {
        static::saving(function (self $page) {
            if (!in_array($page->status, self::STATUSES, true)) {
                throw ValidationException::withMessages(['status' => 'Неизвестный статус урока.']);
            }
            if ($page->course_group_id && !in_array($page->skill, self::SKILLS, true)) {
                throw ValidationException::withMessages(['skill' => 'Для урока группы выберите навык.']);
            }
        });
    }
}
