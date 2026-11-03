<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DictionaryWord extends Model
{
    protected $fillable = [
        'dictionary_id',
        'word',
        'learn_lang',
        'is_phrase',
        'translation_1',
        'translation_2',
        'translation_3',
        'translation_input_variable',
        'difficult_translation',
        'info',
        'sound_url',
        'level',
        'max_level',
        'type',
        'gender',
        'order',
    ];

    protected function casts(): array
    {
        return [
            'is_phrase' => 'boolean',
            'level' => 'integer',
            'max_level' => 'integer',
            'order' => 'integer',
        ];
    }

    public function dictionary(): BelongsTo
    {
        return $this->belongsTo(Dictionary::class);
    }

    public function categories(): BelongsToMany
    {
        return $this->belongsToMany(DictionaryCategory::class, 'dictionary_word_category', 'word_id', 'category_id');
    }

    public function translations(): HasMany
    {
        return $this->hasMany(DictionaryWordTranslation::class, 'word_id');
    }

    public function userProgress(): HasMany
    {
        return $this->hasMany(UserDictionaryWord::class, 'dict_word_id');
    }
}
