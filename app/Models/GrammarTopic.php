<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class GrammarTopic extends Model
{
    protected $fillable = ['lesson_page_id', 'rule', 'examples', 'table_keys'];

    protected function casts(): array { return ['examples' => 'array', 'table_keys' => 'array']; }
    public function page() { return $this->belongsTo(LessonPage::class, 'lesson_page_id'); }

    public static function tableOptions(): array
    {
        $rows = json_decode(file_get_contents(base_path('tools/tutor-gateway/src/commands/grammarTablesIndex.json')), true, 512, JSON_THROW_ON_ERROR);
        return collect($rows)->pluck('title', 'tableKey')->all();
    }

    protected static function booted(): void
    {
        static::saving(function (self $topic) {
            $topic->table_keys = app(\App\Services\GrammarTableBindings::class)->resolve($topic->table_keys ?? []);
            if ($topic->page?->skill !== 'grammar') {
                throw ValidationException::withMessages(['lesson_page_id' => 'Выберите урок грамматики.']);
            }
            if (array_diff($topic->table_keys ?? [], array_keys(self::tableOptions()))) {
                throw ValidationException::withMessages(['table_keys' => 'Неизвестная грамматическая таблица.']);
            }
        });
    }
}
