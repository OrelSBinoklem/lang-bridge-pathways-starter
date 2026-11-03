<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DenseTrainingSession extends Model
{
    protected $fillable = [
        'user_id',
        'dictionary_id',
        'category_id',
        'dense_word_ids_direct',
        'dense_review_word_ids_direct',
        'dense_word_ids_revert',
        'dense_review_word_ids_revert',
        'attempts_left',
        'waiting_since',
        'use_random',
    ];

    protected function casts(): array
    {
        return [
            'waiting_since' => 'datetime',
            'use_random' => 'boolean',
            'attempts_left' => 'integer',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function dictionary(): BelongsTo
    {
        return $this->belongsTo(Dictionary::class);
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(DictionaryCategory::class, 'category_id');
    }

    /** @return list<int> */
    public function decodeIds(?string $json): array
    {
        if ($json === null || $json === '') {
            return [];
        }

        $decoded = json_decode($json, true);

        return is_array($decoded) ? array_values(array_map('intval', $decoded)) : [];
    }

    public function encodeIds(array $ids): string
    {
        return json_encode(array_values(array_map('intval', $ids)));
    }
}
