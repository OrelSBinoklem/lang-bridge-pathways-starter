<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LessonBlockVariant extends Model
{
    protected $fillable = ['lesson_block_id', 'title', 'seed_key', 'position', 'config', 'is_published', 'practice_archived_at'];

    protected function casts(): array
    {
        return ['config' => 'array', 'position' => 'integer', 'is_published' => 'boolean', 'practice_archived_at' => 'datetime'];
    }

    public function block() { return $this->belongsTo(LessonBlock::class, 'lesson_block_id'); }

    protected static function booted(): void
    {
        static::saving(function (self $variant) {
            if ($variant->block?->source_block_id) {
                throw \Illuminate\Validation\ValidationException::withMessages(['lesson_block_id' => 'Блок-ссылка использует варианты исходного подэтапа.']);
            }
            if ($variant->is_published && $variant->block?->type === 'grammar') {
                \App\Services\GrammarTask::validate($variant->config ?? []);
            }
        });
    }
}
