<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'word',
    'lemma',
    'language',
    'translation_ru',
    'status',
    'difficulty',
    'confidence',
    'examples',
    'metadata',
    'last_seen_at',
])]
class TutorDifficultWord extends Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'difficulty' => 'integer',
            'confidence' => 'integer',
            'examples' => 'array',
            'metadata' => 'array',
            'last_seen_at' => 'datetime',
        ];
    }
}
