<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable([
    'tutor_message_id',
    'tutor_conversation_id',
    'user_id',
    'content',
    'model',
    'dimensions',
    'embedding_json',
    'metadata',
])]
class TutorMessageEmbedding extends Model
{
    public function message(): BelongsTo
    {
        return $this->belongsTo(TutorMessage::class, 'tutor_message_id');
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(TutorConversation::class, 'tutor_conversation_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'embedding_json' => 'array',
            'metadata' => 'array',
        ];
    }
}
