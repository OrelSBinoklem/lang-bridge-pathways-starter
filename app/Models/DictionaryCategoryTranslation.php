<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DictionaryCategoryTranslation extends Model
{
    protected $fillable = [
        'category_id',
        'lang',
        'name',
    ];

    public function category(): BelongsTo
    {
        return $this->belongsTo(DictionaryCategory::class, 'category_id');
    }
}
