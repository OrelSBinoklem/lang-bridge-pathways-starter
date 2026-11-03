<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'user_id',
    'summary_date',
    'summary',
    'messages_count',
    'first_message_id',
    'last_message_id',
    'model',
    'metadata',
])]
class TutorDailySummary extends Model
{
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function firstMessage(): BelongsTo
    {
        return $this->belongsTo(TutorMessage::class, 'first_message_id');
    }

    public function lastMessage(): BelongsTo
    {
        return $this->belongsTo(TutorMessage::class, 'last_message_id');
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'summary_date' => 'date',
            'metadata' => 'array',
        ];
    }
}
