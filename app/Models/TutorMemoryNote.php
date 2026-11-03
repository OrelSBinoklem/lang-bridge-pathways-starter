<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'category',
    'key',
    'content',
    'importance',
    'evidence',
    'metadata',
    'last_seen_at',
])]
class TutorMemoryNote extends Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'importance' => 'integer',
            'evidence' => 'array',
            'metadata' => 'array',
            'last_seen_at' => 'datetime',
        ];
    }
}
