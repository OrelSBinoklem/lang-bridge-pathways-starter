<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Facades\DB;

class Dictionary extends Model
{
    protected $fillable = [
        'name',
        'lang',
        'learn_lang',
        'words',
        'level',
        'max_level',
        'sound',
        'translation_languages',
        'is_listed',
    ];

    protected function casts(): array
    {
        return [
            'sound' => 'boolean',
            'is_listed' => 'boolean',
            'words' => 'integer',
            'level' => 'integer',
            'max_level' => 'integer',
            'translation_languages' => 'array',
        ];
    }

    protected static function booted(): void
    {
        static::deleting(function (Dictionary $dictionary): void {
            // parent_id → dictionary_categories ломает простой CASCADE при вложенных категориях
            DB::transaction(function () use ($dictionary): void {
                DictionaryCategory::query()
                    ->where('dictionary_id', $dictionary->id)
                    ->update(['parent_id' => null]);

                DictionaryWord::query()
                    ->where('dictionary_id', $dictionary->id)
                    ->delete();

                DictionaryCategory::query()
                    ->where('dictionary_id', $dictionary->id)
                    ->delete();

                DB::table('dense_training_sessions')
                    ->where('dictionary_id', $dictionary->id)
                    ->delete();
            });
        });
    }

    public function categories(): HasMany
    {
        return $this->hasMany(DictionaryCategory::class);
    }

    public function dictionaryWords(): HasMany
    {
        return $this->hasMany(DictionaryWord::class);
    }
}
