<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class CourseGroup extends Model
{
    protected $fillable = ['title', 'level', 'learn_lang', 'dictionary_id', 'category_id', 'seed_key', 'position', 'is_published'];
    protected function casts(): array { return ['position' => 'integer', 'is_published' => 'boolean']; }
    public function category() { return $this->belongsTo(DictionaryCategory::class); }
    public function dictionary() { return $this->belongsTo(Dictionary::class); }
    public function steps() { return $this->hasMany(CourseStep::class, 'group_id'); }
    public function lessonPages() { return $this->hasMany(LessonPage::class, 'course_group_id'); }
    public function getDisplayTitleAttribute(): string { return $this->category?->name ?? $this->title ?? 'Группа'; }

    protected static function booted(): void
    {
        static::saving(function (self $group) {
            if (!in_array($group->level, ['A1', 'A2', 'B1', 'B2'], true)) {
                throw ValidationException::withMessages(['level' => 'Укажите уровень A1–B2.']);
            }
            if ($group->category_id) {
                $category = DictionaryCategory::findOrFail($group->category_id);
                $parent = DictionaryCategory::find($category->parent_id);
                if (!$parent || $parent->parent_id || $category->dictionary_id != $group->dictionary_id) {
                    throw ValidationException::withMessages(['category_id' => 'Выберите категорию второго уровня этого словаря.']);
                }
                $group->learn_lang = strtolower(Dictionary::findOrFail($group->dictionary_id)->learn_lang);
            } elseif (!trim((string) $group->title)) {
                throw ValidationException::withMessages(['title' => 'Введите название группы без категории.']);
            }
            // Moving a populated group between levels is explicit; languages cannot be mixed.
            if ($group->exists && $group->steps()->where('learn_lang', '!=', $group->learn_lang)->exists()) {
                throw ValidationException::withMessages(['learn_lang' => 'Язык группы должен совпадать с языком её этапов.']);
            }
        });
        static::saved(fn (self $group) => $group->steps()->update(['level' => $group->level]));
    }
}
