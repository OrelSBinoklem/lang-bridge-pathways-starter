<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LessonBlockProgress extends Model
{
    protected $fillable = ['user_id', 'lesson_block_id', 'best_score', 'best_rank', 'cooldown_tier', 'last_scored_at', 'next_scored_at'];

    protected $hidden = ['assisted_variant_ids'];

    protected function casts(): array
    {
        return [
            'best_score' => 'integer',
            'cooldown_tier' => 'integer',
            'last_scored_at' => 'datetime',
            'next_scored_at' => 'datetime',
            'assisted_variant_ids' => 'array',
        ];
    }

    public function hasPendingAssistance(?int $variantId): bool
    {
        return $variantId !== null && in_array($variantId, $this->assisted_variant_ids ?? [], true);
    }

    public function user() { return $this->belongsTo(User::class); }
    public function block() { return $this->belongsTo(LessonBlock::class, 'lesson_block_id'); }
}
