<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'cefr_level',
    'confidence',
    'summary',
    'evidence',
    'metadata',
])]
class TutorProgressEstimate extends Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'confidence' => 'integer',
            'evidence' => 'array',
            'metadata' => 'array',
        ];
    }
}
