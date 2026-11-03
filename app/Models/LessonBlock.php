<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class LessonBlock extends Model
{
    public const TYPES = ['words', 'custom_category', 'listening', 'reading', 'writing', 'speaking', 'grammar'];

    protected $fillable = ['lesson_page_id', 'source_block_id', 'type', 'title', 'is_required', 'weight', 'position', 'config', 'bot_prompt', 'seed_key'];

    protected function casts(): array { return ['config' => 'array', 'position' => 'integer', 'is_required' => 'boolean', 'weight' => 'integer']; }

    public function page() { return $this->belongsTo(LessonPage::class, 'lesson_page_id'); }
    public function variants() { return $this->hasMany(LessonBlockVariant::class)->orderBy('position'); }
    public function attempts() { return $this->hasMany(LessonBlockAttempt::class); }
    public function progress() { return $this->hasMany(LessonBlockProgress::class); }
    public function sourceBlock() { return $this->belongsTo(self::class, 'source_block_id'); }

    public function isRetiredCoursePractice(): bool
    {
        if ($this->page?->course_group_id === null || $this->type !== $this->page?->skill
            || !in_array($this->type, ['writing', 'speaking'], true)) return false;
        $kind = $this->config['task_kind'] ?? $this->variants->firstWhere('is_published', true)?->config['task_kind'] ?? null;
        return $kind === 'question_formation' || ($this->type === 'writing' && $kind === 'image_description');
    }

    // A placement has its own title/order, but never owns another copy of learning progress.
    public function trainingBlock(): ?self
    {
        if ($this->isRetiredCoursePractice()) return null;
        if (!$this->source_block_id) return $this;
        $source = $this->sourceBlock;
        return $this->type === 'grammar' && $source?->type === 'grammar' && !$source->source_block_id
            && $source->page?->skill === 'grammar' && $source->page->status === 'published'
            && $source->page->is_published && $source->page->learn_lang === $this->page?->learn_lang
            ? $source : null;
    }

    protected static function booted(): void
    {
        static::saving(function (self $block) {
            if (!in_array($block->type, self::TYPES, true)) {
                throw ValidationException::withMessages(['type' => 'Неизвестный тип блока.']);
            }
            if ($block->source_block_id) {
                $source = self::with('page')->find($block->source_block_id);
                if (!$source || $source->id === $block->id || $source->lesson_page_id === $block->lesson_page_id
                    || $block->type !== 'grammar' || $source->type !== 'grammar' || $source->source_block_id
                    || $source->page?->skill !== 'grammar' || $source->page->learn_lang !== $block->page?->learn_lang) {
                    throw ValidationException::withMessages(['source_block_id' => 'Выберите исходное подзадание другой грамматической страницы того же языка, не ссылку на него.']);
                }
                if ($block->exists && ($block->variants()->exists() || $block->attempts()->exists() || $block->progress()->exists())) {
                    throw ValidationException::withMessages(['source_block_id' => 'У блока уже есть задания или прогресс. Добавьте отдельный блок-ссылку.']);
                }
                if ($block->exists && self::where('source_block_id', $block->id)->exists()) {
                    throw ValidationException::withMessages(['source_block_id' => 'Этот блок уже служит источником других подэтапов.']);
                }
                if (self::where('lesson_page_id', $block->lesson_page_id)->where('source_block_id', $source->id)
                    ->when($block->exists, fn ($query) => $query->whereKeyNot($block->id))->exists()) {
                    throw ValidationException::withMessages(['source_block_id' => 'Это подзадание уже подключено к странице.']);
                }
                $block->unsetRelation('sourceBlock');
            }
        });
    }
}
