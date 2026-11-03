<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;

class DictionaryCategory extends Model
{
    protected $fillable = [
        'dictionary_id',
        'name',
        'parent_id',
        'order',
    ];

    protected function casts(): array
    {
        return [
            'order' => 'integer',
        ];
    }

    public function dictionary(): BelongsTo
    {
        return $this->belongsTo(Dictionary::class);
    }

    public function parent(): BelongsTo
    {
        return $this->belongsTo(self::class, 'parent_id');
    }

    public function children(): HasMany
    {
        return $this->hasMany(self::class, 'parent_id')->orderBy('order');
    }

    public function words(): BelongsToMany
    {
        return $this->belongsToMany(DictionaryWord::class, 'dictionary_word_category', 'category_id', 'word_id');
    }

    public function translations(): HasMany
    {
        return $this->hasMany(DictionaryCategoryTranslation::class, 'category_id');
    }
}
