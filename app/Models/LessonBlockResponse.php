<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LessonBlockResponse extends Model
{
    protected $fillable = [
        'user_id', 'lesson_block_id', 'lesson_block_variant_id', 'answer_text',
        'status', 'feedback', 'accepted_at',
    ];

    protected function casts(): array
    {
        return ['accepted_at' => 'datetime'];
    }
}
