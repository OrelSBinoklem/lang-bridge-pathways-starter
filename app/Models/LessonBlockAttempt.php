<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LessonBlockAttempt extends Model
{
    protected $fillable = [
        'user_id', 'lesson_block_id', 'lesson_block_variant_id', 'answer', 'feedback',
        'score', 'rank', 'is_practice', 'cooldown_tier', 'scored_at',
    ];

    protected function casts(): array
    {
        return [
            'answer' => 'array',
            'feedback' => 'array',
            'score' => 'integer',
            'is_practice' => 'boolean',
            'cooldown_tier' => 'integer',
            'scored_at' => 'datetime',
        ];
    }

    public function user() { return $this->belongsTo(User::class); }
    public function block() { return $this->belongsTo(LessonBlock::class, 'lesson_block_id'); }
    public function variant() { return $this->belongsTo(LessonBlockVariant::class, 'lesson_block_variant_id'); }
}
