<?php

namespace App\Console\Commands;

use App\Models\CourseGroup;
use App\Models\CourseStep;
use App\Models\Dictionary;
use App\Models\DictionaryCategory;
use App\Services\CourseCatalog;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;

/** Additive, repeatable setup: never modifies existing words, progress or editorial steps. */
class SeedEnglishCourse extends Command
{
    protected $signature = 'course:seed-english {--dictionary=31 : Existing thematic English dictionary} {--apply : Create missing groups and steps; otherwise preview only}';
    protected $description = 'Connect existing English A1–B2 vocabulary and grammar to the course path';

    public function handle(): int
    {
        $dictionary = Dictionary::findOrFail((int) $this->option('dictionary'));
        if (strtolower($dictionary->learn_lang) !== 'en') {
            $this->error('Нужен существующий английский словарь.');
            return self::FAILURE;
        }
        $plan = json_decode(file_get_contents(resource_path('course/english-path.json')), true, 512, JSON_THROW_ON_ERROR);
        $tables = collect(CourseCatalog::englishGrammar())->keyBy('id');
        $categories = DictionaryCategory::where('dictionary_id', $dictionary->id)->get()->keyBy('id');
        $children = $categories->groupBy('parent_id');
        $links = DB::table('dictionary_word_category as links')->join('dictionary_words as words', 'words.id', '=', 'links.word_id')
            ->where('words.dictionary_id', $dictionary->id)->get(['links.category_id', 'links.word_id'])->groupBy('category_id');
        $units = [];
        $used = [];
        foreach ($plan['levels'] as $level => $topics) {
            $root = $categories->first(fn ($category) => !$category->parent_id && strtoupper(trim($category->name)) === $level);
            if (!$root) throw new RuntimeException('Нет уровня '.$level.' в выбранном словаре.');
            foreach ($topics as $index => $topic) {
                $category = $categories->first(fn ($category) => $category->parent_id === $root->id && mb_strtolower(trim($category->name)) === $topic['category']);
                if (!$category) throw new RuntimeException('Нет категории '.$level.' / '.$topic['category']);
                $wordIds = $seen = [];
                $pending = [$category->id];
                while ($pending) {
                    $id = array_pop($pending);
                    if (isset($seen[$id])) continue;
                    $seen[$id] = true;
                    foreach ($children[$id] ?? [] as $child) $pending[] = $child->id;
                    foreach ($links[$id] ?? [] as $link) $wordIds[$link->word_id] = true;
                }
                foreach ($topic['grammar'] as $id) {
                    if (!isset($tables[$id]) || $tables[$id]['level'] !== $level || isset($used[$id])) throw new RuntimeException('Некорректная привязка грамматики: '.$id);
                    $used[$id] = true;
                }
                if ($wordIds || $topic['grammar']) $units[] = ['category' => $category, 'level' => $level, 'position' => $index * 100,
                    'words' => count($wordIds), 'grammar' => $topic['grammar']];
            }
        }
        if (count($used) !== $tables->count()) throw new RuntimeException('Не все английские таблицы включены в план.');
        $this->info(count($units).' групп; '.count($used).' таблицы. '.($this->option('apply') ? 'Добавление отсутствующих записей.' : 'Предпросмотр, база не меняется.'));
        if (!$this->option('apply')) return self::SUCCESS;
        $created = ['groups' => 0, 'steps' => 0];
        DB::transaction(function () use ($units, $dictionary, $tables, &$created) {
            foreach ($units as $unit) {
                $category = $unit['category'];
                $prefix = 'english:v1:'.$dictionary->id.':'.$category->id;
                $group = CourseGroup::firstOrCreate(['seed_key' => $prefix], ['dictionary_id' => $dictionary->id, 'category_id' => $category->id,
                    'level' => $unit['level'], 'position' => $unit['position'], 'is_published' => true]);
                $created['groups'] += (int) $group->wasRecentlyCreated;
                if ($unit['words']) {
                    $step = CourseStep::firstOrCreate(['seed_key' => $prefix.':words'], ['title' => $category->name,
                        'kind' => 'category', 'level' => $unit['level'], 'dictionary_id' => $dictionary->id, 'category_id' => $category->id,
                        'group_id' => $group->id, 'group_seeded' => true, 'position' => 10, 'is_published' => true]);
                    $created['steps'] += (int) $step->wasRecentlyCreated;
                }
                foreach ($unit['grammar'] as $index => $id) {
                    $step = CourseStep::firstOrCreate(['seed_key' => 'english:v1:'.$dictionary->id.':grammar:'.$id], ['title' => $tables[$id]['title'],
                        'description' => 'Таблица для изучения. Чтение таблицы не начисляет учебный прогресс.', 'kind' => 'grammar', 'level' => $unit['level'],
                        'grammar_table_id' => $id, 'group_id' => $group->id, 'group_seeded' => true, 'position' => 20 + $index * 10, 'is_published' => true]);
                    $created['steps'] += (int) $step->wasRecentlyCreated;
                }
            }
        });
        $this->info('Добавлено групп: '.$created['groups'].', этапов: '.$created['steps'].'. Существующие записи и прогресс сохранены.');
        return self::SUCCESS;
    }
}
