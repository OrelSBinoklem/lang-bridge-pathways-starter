<?php

namespace Tests\Feature;

use App\Models\Dictionary;
use App\Models\DictionaryWord;
use App\Services\DictionaryCache;
use App\Services\EnglishDictionaryCopy;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;
use RuntimeException;
use Tests\TestCase;

class EnglishDictionaryCopyTest extends TestCase
{
    private EnglishDictionaryCopy $copy;

    private Dictionary $source;

    private array $taxonomy;

    private array $groups;

    private array $identities;

    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('users', fn ($table) => $table->id());
        foreach (['2026_08_02_000001_create_lbp_dictionary_tables.php', '2026_09_08_000001_add_multilingual_dictionary_translations.php', '2026_09_08_000002_add_info_to_dictionary_word_translations.php'] as $migration) {
            (require database_path('migrations/'.$migration))->up();
        }
        $this->copy = new EnglishDictionaryCopy;
        DB::table('dictionaries')->insert(['id' => 31, 'name' => 'Original', 'lang' => 'RU', 'learn_lang' => 'EN', 'words' => 5, 'sound' => true, 'translation_languages' => json_encode(['ru', 'uk'])]);
        $this->source = Dictionary::findOrFail(31);
        $category = $this->source->categories()->create(['name' => 'Existing category']);
        for ($i = 0; $i < 36; $i++) {
            $word = $this->source->dictionaryWords()->create(['word' => $i < 2 ? 'light' : 'word-'.$i, 'learn_lang' => 'EN', 'translation_1' => 'значение '.$i, 'translation_2' => 'второе '.$i, 'translation_3' => 'третье '.$i, 'translation_input_variable' => 'вариант; ещё вариант', 'difficult_translation' => 'сложность', 'info' => 'подсказка', 'sound_url' => '/audio/original-'.$i.'.mp3', 'type' => $i === 1 ? 'adjective' : 'noun', 'level' => 1, 'max_level' => 3, 'is_phrase' => false, 'gender' => null, 'order' => $i]);
            $word->categories()->attach($category->id);
            foreach (['ru', 'uk'] as $lang) {
                $word->translations()->create(['lang' => $lang, 'translation_1' => $lang.' '.$i, 'translation_2' => 'синоним', 'translation_3' => 'ещё', 'translation_input_variable' => 'допустимо', 'difficult_translation' => 'акцент', 'info' => 'локализованная подсказка']);
            }
        }
        DB::table('users')->insert(['id' => 8]);
        DB::table('user_dictionary_words')->insert(['user_id' => 8, 'dict_word_id' => 1, 'correct_attempts' => 2, 'correct_attempts_revert' => 2]);
        DB::table('dense_training_sessions')->insert(['user_id' => 8, 'dictionary_id' => 31, 'category_id' => $category->id]);
        $this->taxonomy = ['version' => 1, 'source_dictionary_id' => 31, 'name' => 'Compact English', 'max_words_per_leaf' => 30,
            'levels' => ['A1' => [['key' => 'people', 'name' => 'Люди', 'name_uk' => 'Люди'], ['key' => 'health', 'name' => 'Здоровье', 'name_uk' => 'Здоров’я']], 'C1' => [['key' => 'future', 'name' => 'Будущее']]]];
        $this->groups = ['A1' => ['people' => [['name' => 'Знакомство', 'name_uk' => 'Знайомство', 'word_ids' => range(1, 17)], ['name' => 'Отношения', 'name_uk' => 'Стосунки', 'word_ids' => range(18, 33)]], 'health' => [['name' => 'Тело', 'name_uk' => 'Тіло', 'word_ids' => range(34, 36)]]]];
        $this->identities = $this->source->dictionaryWords()->with('translations')->orderBy('id')->get()->map(fn ($word) => $this->copy->identity($word))->all();
    }

    private function snapshot(): string
    {
        $data = [];
        foreach (['dictionaries', 'dictionary_categories', 'dictionary_category_translations', 'dictionary_words', 'dictionary_word_translations', 'dictionary_word_category', 'user_dictionary_words', 'dense_training_sessions', 'unique_words'] as $table) {
            $data[$table] = DB::table($table)->get()->toArray();
        }

        return json_encode($data, JSON_THROW_ON_ERROR);
    }

    public function test_preview_is_read_only_and_splits_large_topics_at_exactly_three_levels(): void
    {
        $before = $this->snapshot();
        $plan = $this->copy->prepare($this->source, $this->taxonomy, $this->groups, $this->identities);
        $this->assertSame($before, $this->snapshot());
        $this->assertCount(5, $plan['categories']);
        $this->assertSame(17, max(array_count_values($plan['assignments'])));
        $this->assertSame('A1/health', $plan['assignments'][36], 'Small topics stay directly at level two');
        $this->assertSame('A1/people/0', $plan['assignments'][1]);
        $this->assertNotContains('C1', array_column($plan['categories'], 'key'), 'No fake C1 words or empty future level');
    }

    public function test_copy_preserves_every_word_field_and_translation_without_merging_homographs_or_copying_progress(): void
    {
        $sourceBefore = $this->snapshot();
        $cacheBefore = DictionaryCache::key('dictionaries', []);
        $target = $this->copy->create($this->source, $this->taxonomy, $this->groups, $this->identities);
        $this->assertNotSame($this->source->id, $target->id);
        $this->assertSame(36, $target->words, 'Actual rows override the stale source metadata count');
        $this->assertSame(['ru', 'uk'], $target->translation_languages);
        $this->assertTrue($target->sound);
        $sourceWords = $this->source->dictionaryWords()->with('translations')->orderBy('id')->get();
        $targetWords = $target->dictionaryWords()->with('translations')->orderBy('id')->get();
        $this->assertCount(36, $targetWords);
        foreach ($sourceWords as $index => $word) {
            $actual = $targetWords[$index];
            $this->assertNotSame($word->id, $actual->id);
            $this->assertSame(Arr::except($this->copy->identity($word), ['id']), Arr::except($this->copy->identity($actual), ['id']));
            $this->assertSame(1, $actual->categories()->count());
        }
        $this->assertSame(2, $target->dictionaryWords()->where('word', 'light')->count());
        $this->assertSame(1, DB::table('user_dictionary_words')->count());
        $this->assertSame(1, DB::table('dense_training_sessions')->count());
        $this->assertSame(0, DB::table('unique_words')->count());
        $this->assertNotSame($cacheBefore, DictionaryCache::key('dictionaries', []));
        // Compare every original row, not just totals.
        $before = json_decode($sourceBefore, true);
        foreach ($before as $table => $rows) {
            foreach ($rows as $row) {
                $this->assertEquals($row, (array) DB::table($table)->where($row)->first());
            }
        }
        $leaves = $target->categories()->whereDoesntHave('children')->withCount('words')->get();
        $this->assertLessThanOrEqual(30, $leaves->max('words_count'));
        $this->assertSame(36, $leaves->sum('words_count'));
        $this->assertSame(5, $target->categories()->count());
        $this->assertSame(10, DB::table('dictionary_category_translations')->whereIn('category_id', $target->categories()->select('id'))->count());
    }

    public function test_duplicate_missing_wrong_level_and_oversized_assignments_fail_before_writes(): void
    {
        $cases = [];
        $bad = $this->groups;
        $bad['A1']['health'][0]['word_ids'][] = 1;
        $cases[] = $bad;
        $bad = $this->groups;
        array_pop($bad['A1']['health'][0]['word_ids']);
        $cases[] = $bad;
        $bad = $this->groups;
        $bad['A1']['people'] = [['name' => 'Too large', 'word_ids' => range(1, 33)]];
        $cases[] = $bad;
        $bad = $this->groups;
        $bad['B2'] = $bad['A1'];
        unset($bad['A1']);
        $cases[] = $bad;
        foreach ($cases as $groups) {
            $before = $this->snapshot();
            try {
                $this->copy->create($this->source, $this->taxonomy, $groups, $this->identities);
                $this->fail('Invalid assignments must fail');
            } catch (InvalidArgumentException) {
                $this->assertSame($before, $this->snapshot());
            }
        }
    }

    public function test_a_changed_translation_requires_editorial_review(): void
    {
        DictionaryWord::findOrFail(1)->translations()->where('lang', 'uk')->update(['info' => 'changed']);
        $before = $this->snapshot();
        try {
            $this->copy->create($this->source, $this->taxonomy, $this->groups, $this->identities);
            $this->fail('Stale classification must fail');
        } catch (InvalidArgumentException $error) {
            $this->assertStringContainsString('изменилось', $error->getMessage());
            $this->assertSame($before, $this->snapshot());
        }
    }

    public function test_new_source_records_are_never_silently_skipped(): void
    {
        $this->source->dictionaryWords()->create(['word' => 'new word', 'learn_lang' => 'EN', 'translation_1' => 'новое слово', 'level' => 2, 'max_level' => 2]);
        $before = $this->snapshot();
        try {
            $this->copy->create($this->source, $this->taxonomy, $this->groups, $this->identities);
            $this->fail('New source words require an updated plan');
        } catch (InvalidArgumentException $error) {
            $this->assertStringContainsString('Состав', $error->getMessage());
            $this->assertSame($before, $this->snapshot());
        }
    }

    public function test_repeated_creation_never_overwrites_an_existing_copy_or_its_admin_edits(): void
    {
        $target = $this->copy->create($this->source, $this->taxonomy, $this->groups, $this->identities);
        $target->dictionaryWords()->first()->update(['info' => 'Administrator edit']);
        $before = $this->snapshot();
        try {
            $this->copy->create($this->source, $this->taxonomy, $this->groups, $this->identities);
            $this->fail('Repeated creation must refuse');
        } catch (InvalidArgumentException $error) {
            $this->assertStringContainsString('уже существует', $error->getMessage());
            $this->assertSame($before, $this->snapshot());
        }
    }

    public function test_failure_during_copy_rolls_back_categories_words_and_cache_invalidation(): void
    {
        $before = $this->snapshot();
        $cacheBefore = DictionaryCache::key('dictionaries', []);
        DB::listen(function ($event) {
            if (str_starts_with($event->sql, 'insert into "dictionary_words"')) {
                throw new RuntimeException('Simulated interrupted copy');
            }
        });
        try {
            $this->copy->create($this->source, $this->taxonomy, $this->groups, $this->identities);
            $this->fail('Interrupted copy must fail');
        } catch (RuntimeException $error) {
            $this->assertSame('Simulated interrupted copy', $error->getMessage());
            $this->assertSame($before, $this->snapshot());
            $this->assertSame($cacheBefore, DictionaryCache::key('dictionaries', []));
        }
    }
}
