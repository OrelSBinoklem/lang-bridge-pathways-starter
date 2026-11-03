<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LessonGrammarItemProgress extends Model
{
    protected $table = 'lesson_grammar_item_progress';

    protected $fillable = [
        'user_id', 'lesson_block_id', 'item_key', 'direct_correct', 'reverse_correct',
        'direct_correct_attempts', 'reverse_correct_attempts',
        'direct_mode_education', 'reverse_mode_education',
        'direct_next_review_at', 'reverse_next_review_at',
    ];

    protected function casts(): array
    {
        return [
            'direct_correct' => 'boolean', 'reverse_correct' => 'boolean',
            'direct_correct_attempts' => 'integer', 'reverse_correct_attempts' => 'integer',
            'direct_mode_education' => 'boolean', 'reverse_mode_education' => 'boolean',
            'direct_next_review_at' => 'datetime', 'reverse_next_review_at' => 'datetime',
        ];
    }
}
