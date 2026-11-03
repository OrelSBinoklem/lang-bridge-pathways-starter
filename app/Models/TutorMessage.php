<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable([
    'tutor_conversation_id',
    'user_id',
    'role',
    'original_text',
    'model_heard_text',
    'corrected_text',
    'correction_explanation_ru',
    'language',
    'source',
    'metadata',
    'client_key',
])]
class TutorMessage extends Model
{
    public function conversation(): BelongsTo
    {
        return $this->belongsTo(TutorConversation::class, 'tutor_conversation_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function embedding(): HasOne
    {
        return $this->hasOne(TutorMessageEmbedding::class);
    }

    /** @return array<string, string> */
    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }
}
