<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserDictionaryWord extends Model
{
    protected $fillable = [
        'user_id',
        'dict_word_id',
        'attempts',
        'correct_attempts',
        'last_shown',
        'last_shown_revert',
        'easy_education',
        'mode_education',
        'mode_education_revert',
        'cooldown_tier',
        'cooldown_tier_revert',
        'dense_remaining_direct',
        'dense_remaining_revert',
        'attempts_all',
        'correct_attempts_all',
        'attempts_revert',
        'correct_attempts_revert',
        'statistic_attempts',
        'statistic_attempts_revert',
        'statistic_correct_attempts',
        'statistic_correct_attempts_revert',
        'easy_correct',
        'easy_correct_revert',
        'is_reset',
    ];

    protected function casts(): array
    {
        return [
            'last_shown' => 'datetime',
            'last_shown_revert' => 'datetime',
            'easy_education' => 'boolean',
            'mode_education' => 'boolean',
            'mode_education_revert' => 'boolean',
            'easy_correct' => 'boolean',
            'easy_correct_revert' => 'boolean',
            'is_reset' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function word(): BelongsTo
    {
        return $this->belongsTo(DictionaryWord::class, 'dict_word_id');
    }
}
