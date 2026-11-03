<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DictionaryWordTranslation extends Model
{
    protected $fillable = [
        'word_id',
        'lang',
        'translation_1',
        'translation_2',
        'translation_3',
        'translation_input_variable',
        'difficult_translation',
        'info',
    ];

    public function word(): BelongsTo
    {
        return $this->belongsTo(DictionaryWord::class, 'word_id');
    }
}
