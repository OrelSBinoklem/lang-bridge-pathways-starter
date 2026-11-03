<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Validation\ValidationException;

class CourseStep extends Model
{
    /** Ключи должны совпадать с реестром в frontend/src/features/course/grammarCustomComponents.ts */
    public const CUSTOM_COMPONENTS = [
        'noun_declension' => 'Тренировка склонений',
        'verb_conjugation' => 'Тренировка спряжений (база)',
        'verb_conjugation_1' => 'Тренировка спряжений 1',
        'verb_conjugation_2' => 'Тренировка спряжений 2',
        'verb_conjugation_3' => 'Тренировка спряжений 3',
    ];

    protected $fillable = ['title', 'description', 'level', 'kind', 'learn_lang', 'dictionary_id', 'category_id', 'grammar_table_id', 'custom_component', 'position', 'is_published', 'seed_key', 'group_id', 'group_seeded'];

    protected function casts(): array { return ['position' => 'integer', 'is_published' => 'boolean']; }
    public function dictionary() { return $this->belongsTo(Dictionary::class); }
    public function category() { return $this->belongsTo(DictionaryCategory::class); }
    public function group() { return $this->belongsTo(CourseGroup::class); }

    protected static function booted(): void
    {
        static::saving(function (self $step) {
            if (!in_array($step->level, ['A1', 'A2', 'B1', 'B2'], true) || !in_array($step->kind, ['category', 'grammar'], true)) {
                throw ValidationException::withMessages(['level' => 'Укажите уровень A1–B2 и тип этапа.']);
            }
            if ($step->kind === 'grammar') {
                $table = collect(\App\Services\CourseCatalog::grammar())->firstWhere('id', (string) $step->grammar_table_id);
                if (!$table) {
                    throw ValidationException::withMessages(['grammar_table_id' => 'Выберите существующую таблицу.']);
                }
                if ($step->custom_component && !array_key_exists($step->custom_component, self::CUSTOM_COMPONENTS)) {
                    throw ValidationException::withMessages(['custom_component' => 'Неизвестный кастомный компонент.']);
                }
                $step->dictionary_id = $step->category_id = null;
                $step->learn_lang = $table['learn_lang'] ?? 'lv';
                if ($step->learn_lang === 'en' && $step->custom_component) {
                    throw ValidationException::withMessages(['custom_component' => 'Латышский тренажёр нельзя подключать к английской таблице.']);
                }
            } else {
                $valid = \App\Services\CourseCatalog::categoryOptions((int) $step->dictionary_id);
                if (!array_key_exists((int) $step->category_id, $valid)) {
                    throw ValidationException::withMessages(['category_id' => 'Нужна категория второго или третьего уровня выбранного словаря.']);
                }
                $step->grammar_table_id = null;
                $step->custom_component = null;
                $step->learn_lang = strtolower(Dictionary::findOrFail($step->dictionary_id)->learn_lang);
            }
            if ($step->group_id) {
                $group = CourseGroup::findOrFail($step->group_id);
                if ($group->learn_lang !== $step->learn_lang) {
                    throw ValidationException::withMessages(['group_id' => 'Язык группы не совпадает с языком этапа.']);
                }
                $step->level = $group->level;
            }
        });
    }
}
