<?php

namespace Tests\Feature;

use App\Models\Dictionary;
use App\Services\EnglishSupplementDictionary;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;
use RuntimeException;
use Tests\TestCase;

class EnglishSupplementDictionaryTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('users', fn ($table) => $table->id());
        foreach (['2026_08_02_000001_create_lbp_dictionary_tables.php', '2026_09_08_000001_add_multilingual_dictionary_translations.php', '2026_09_08_000002_add_info_to_dictionary_word_translations.php'] as $migration) {
            (require database_path('migrations/'.$migration))->up();
        }
        $source = Dictionary::create(['name' => 'Keep original', 'lang' => 'RU', 'learn_lang' => 'LV', 'words' => 1]);
        $word = $source->dictionaryWords()->create(['word' => 'es', 'translation_1' => 'я', 'learn_lang' => 'LV']);
        $category = $source->categories()->create(['name' => 'Original']);
        $word->categories()->attach($category);
        DB::table('users')->insert(['id' => 1]);
        DB::table('user_dictionary_words')->insert(['user_id' => 1, 'dict_word_id' => $word->id, 'correct_attempts' => 2]);
    }

    public function test_package_preview_is_read_only_and_has_no_oversized_or_empty_leaves(): void
    {
        $package = app(EnglishSupplementDictionary::class)->load();
        $this->assertCount(665, $package['words']);
        $this->assertCount(82, $package['categories']);
        $this->artisan('dictionary:prepare-english-supplement')->assertSuccessful();
        $this->assertSame(1, Dictionary::count());
        $this->assertSame(1, DB::table('dictionary_words')->count());
        foreach ($package['words'] as $word) {
            $this->assertNotEmpty($word['ru']);
            $this->assertNotEmpty($word['uk']);
        }
    }

    public function test_install_preserves_existing_content_and_progress_and_reuses_verbs_between_categories(): void
    {
        $oldProgress = DB::table('user_dictionary_words')->get()->toJson();
        $service = app(EnglishSupplementDictionary::class);
        $target = $service->create($service->load());
        $this->assertSame(['ru', 'uk'], $target->translation_languages);
        $this->assertSame('EN', $target->learn_lang);
        $this->assertSame(665, $target->words);
        $this->assertSame(665, $target->dictionaryWords()->count());
        $this->assertSame(1330, DB::table('dictionary_word_translations')->count());
        $this->assertSame($oldProgress, DB::table('user_dictionary_words')->get()->toJson());
        $this->assertSame('es', DB::table('dictionary_words')->where('id', 1)->value('word'));
        $go = $target->dictionaryWords()->where('word', 'go')->sole();
        $this->assertCount(2, $go->categories);
        $this->assertStringContainsString('went', $go->translations()->where('lang', 'ru')->sole()->info);
        $this->assertSame(0, DB::table('user_dictionary_words')->where('dict_word_id', $go->id)->count());
        $you = $target->dictionaryWords()->where('word', 'you')->sole();
        $this->assertSame('ты', $you->translation_1);
        $this->assertSame('вы', $you->translation_2);
        $this->assertSame('ви', $you->translations()->where('lang', 'uk')->sole()->translation_2);
        foreach ($target->categories as $category) {
            $this->assertLessThanOrEqual(30, $category->words()->count());
        }
    }

    public function test_shared_a1_b2_core_includes_connector_examples_and_keeps_their_parts_of_speech(): void
    {
        $package = app(EnglishSupplementDictionary::class)->load();
        $words = collect($package['words'])->keyBy('key');
        $roots = collect($package['categories'])->whereNull('parent')->pluck('name')->all();
        $this->assertSame(['Важные слова A1–B2', 'Глаголы', 'Формы слов'], $roots);
        $this->assertCount(38, $words->where('type', 'conjunction'));
        foreach ($words->where('type', 'conjunction') as $word) {
            foreach (['info', 'info_uk'] as $field) {
                $this->assertStringContainsString('<strong>', $word[$field]);
                $this->assertStringContainsString('<br>', $word[$field]);
            }
        }
        foreach (['although::conjunction', 'even though::conjunction', 'even if::conjunction', 'provided that::conjunction',
            'as long as::conjunction', 'in case::conjunction', 'whereas::conjunction', 'that::conjunction',
            'his::pronoun', 'nobody::pronoun', 'whom::pronoun', 'this::determiner', 'fewer::determiner',
            'in spite of::preposition', 'however::adverb', 'well::adverb', 'hardly::adverb'] as $key) {
            $this->assertTrue($words->has($key), 'Missing functional baseline: '.$key);
        }
        $this->assertFalse($words->has('however::conjunction'));
        $this->assertFalse($words->has('despite::conjunction'));
    }

    public function test_second_creation_refuses_to_replace_administrator_edits(): void
    {
        $service = app(EnglishSupplementDictionary::class);
        $target = $service->create($service->load());
        $first = $target->dictionaryWords()->firstOrFail();
        $first->update(['translation_1' => 'Administrator correction']);
        try {
            $service->create($service->load());
            $this->fail('Duplicate dictionary accepted');
        } catch (InvalidArgumentException) {
            $this->assertSame(2, Dictionary::count());
            $this->assertSame('Administrator correction', $first->fresh()->translation_1);
        }
    }

    public function test_complete_authoring_audio_package_enables_sound_for_new_copies(): void
    {
        $service = app(EnglishSupplementDictionary::class);
        $package = $service->load();
        $url = '/audio/dictionary/en-flash/'.str_repeat('a', 64).'.mp3';
        foreach ($package['words'] as &$word) {
            $word['sound_url'] = $url;
        }
        unset($word);
        $target = $service->create($package);
        $this->assertTrue($target->sound);
        $this->assertSame(665, $target->dictionaryWords()->where('sound_url', $url)->count());
    }

    public function test_important_words_have_requested_categories_and_meanings_on_the_third_level(): void
    {
        $service = app(EnglishSupplementDictionary::class);
        $target = $service->create($service->load());
        $core = $target->categories()->where('name', 'Важные слова A1–B2')->sole();
        $expectedOrder = ['Артикли', 'Местоимения', 'Предлоги', 'Числа', 'Наречия', 'Союзы', 'Частицы', 'Междометия', 'Вопросы', 'Определители (дополнительно)'];
        foreach ($expectedOrder as $name) {
            $this->assertSame(1, $core->children()->where('name', $name)->count());
        }
        $this->assertSame($expectedOrder, $core->children()->pluck('name')->all());
        $this->assertSame(10, $core->children()->count());
        $this->assertSame('Определители (дополнительно)', $core->children()->get()->last()->name);
        foreach ($core->children as $group) {
            $this->assertSame(0, $group->words()->count());
            $this->assertTrue($group->children()->exists());
        }
        $particles = $core->children()->where('name', 'Частицы')->sole();
        $this->assertSame('to', $particles->children()->where('name', 'Инфинитив')->sole()->words()->sole()->word);
        $this->assertTrue($particles->children()->where('name', 'Отрицание')->sole()->words()->where('word', 'not')->exists());
        $determiners = $core->children()->where('name', 'Определители (дополнительно)')->sole();
        $this->assertSame(3, $determiners->children()->where('name', 'Артикли')->sole()->words()->count());
        $adverbs = $core->children()->where('name', 'Наречия')->sole();
        $this->assertSame('not', $adverbs->children()->where('name', 'Отрицание')->sole()->words()->sole()->word);
        $this->assertTrue($adverbs->children()->where('name', 'Выделение и усиление')->sole()->words()->where('word', 'even')->exists());
        $just = $target->dictionaryWords()->where('word', 'just')->sole();
        $this->assertSame('adverb', $just->type);
        $this->assertSame(3, $just->categories()->count());
        $articles = $core->children()->where('name', 'Артикли')->sole();
        $this->assertSame(['a', 'an', 'the'], $articles->children()->sole()->words()->orderBy('word')->pluck('word')->all());
        foreach ($target->dictionaryWords()->where('type', 'determiner')->with('categories.parent')->get() as $word) {
            $this->assertCount(in_array($word->word, ['what', 'which', 'whose']) ? 3 : 2, $word->categories);
            $parents = $word->categories->map(fn ($category) => $category->parent->name)->all();
            $this->assertContains('Определители (дополнительно)', $parents);
            $this->assertContains(in_array($word->word, ['a', 'an', 'the']) ? 'Артикли' : 'Местоимения', $parents);
        }
        $questions = $core->children()->where('name', 'Вопросы')->sole();
        $questionWords = $questions->children()->with('words')->get()->flatMap->words;
        $this->assertCount(50, $questionWords);
        $who = $target->dictionaryWords()->where('word', 'who')->where('type', 'pronoun')->sole();
        $this->assertSame($who->id, $questionWords->firstWhere('word', 'who')->id);
        $this->assertCount(2, $who->categories);
    }

    public function test_question_expansion_has_translated_examples_and_keeps_distinct_meanings(): void
    {
        $package = app(EnglishSupplementDictionary::class)->load();
        $words = collect($package['words'])->keyBy('key');
        $groups = collect($package['categories'])->where('parent', 'question-words')->pluck('key')->all();
        $expanded = collect($package['words'])->filter(fn ($word) => $word['type'] === 'phrase' && array_intersect($word['categories'], $groups));
        $this->assertCount(30, $expanded);
        foreach ($expanded as $word) {
            foreach (['info', 'info_uk'] as $field) {
                $this->assertStringContainsString('<strong>', $word[$field]);
                $this->assertStringContainsString('<br>', $word[$field]);
            }
            $this->assertGreaterThanOrEqual(1, $word['level']);
            $this->assertLessThanOrEqual(4, $word['level']);
        }
        $this->assertStringContainsString('порядок утверждения', $words['how come::phrase']['info']);
        $this->assertStringContainsString('the store is closed', $words['how come::phrase']['info']);
        $this->assertStringContainsString('Крайний срок', $words['by when::phrase']['info']);
        $this->assertStringContainsString('продолжается', $words['until when::phrase']['info']);
        foreach (['to what extent', 'in what way', 'for what reason', 'under what circumstances', 'how likely'] as $phrase) {
            $this->assertSame(4, $words[$phrase.'::phrase']['level']);
        }
    }

    public function test_package_rejects_words_assigned_to_the_wrong_part_of_speech(): void
    {
        $service = app(EnglishSupplementDictionary::class);
        $package = $service->load();
        $package['words'][0]['categories'] = ['articles'];
        $this->expectException(InvalidArgumentException::class);
        $service->create($package);
    }

    public function test_additional_determiners_cannot_be_the_only_location_of_a_word(): void
    {
        $service = app(EnglishSupplementDictionary::class);
        $package = $service->load();
        $index = array_search('my::determiner', array_column($package['words'], 'key'), true);
        $package['words'][$index]['categories'] = ['determiner-possessive'];
        $this->expectException(InvalidArgumentException::class);
        $this->expectExceptionMessage('повторять слова основных категорий');
        $service->validate($package);
    }

    public function test_package_rejects_thirty_one_words_in_one_leaf(): void
    {
        $service = app(EnglishSupplementDictionary::class);
        $package = $service->load();
        for ($i = 0; $i < 31; $i++) {
            $word = $package['words'][0];
            $word['key'] = $word['word'] = 'fixture-'.$i;
            $word['categories'] = ['personal'];
            $package['words'][] = $word;
        }
        $this->expectException(InvalidArgumentException::class);
        $service->create($package);
    }

    public function test_package_rejects_missing_translation_and_duplicate_records(): void
    {
        $service = app(EnglishSupplementDictionary::class);
        foreach (['missing', 'duplicate'] as $mode) {
            $package = $service->load();
            if ($mode === 'missing') {
                $package['words'][0]['uk'] = '';
            } else {
                $package['words'][] = $package['words'][0];
            }
            try {
                $service->create($package);
                $this->fail('Invalid package accepted');
            } catch (InvalidArgumentException) {
                $this->assertSame(1, Dictionary::count());
            }
        }
    }

    public function test_failed_insert_rolls_back_the_whole_new_dictionary(): void
    {
        $armed = true;
        DB::listen(function ($query) use (&$armed) {
            if ($armed && str_starts_with($query->sql, 'insert into "dictionary_words"') && in_array('you', $query->bindings, true)) {
                $armed = false;
                throw new RuntimeException('Simulated interrupted insert');
            }
        });
        $service = app(EnglishSupplementDictionary::class);
        try {
            $service->create($service->load());
            $this->fail('Expected insertion failure');
        } catch (RuntimeException $error) {
            $this->assertSame('Simulated interrupted insert', $error->getMessage());
            $this->assertSame(1, Dictionary::count());
            $this->assertSame(1, DB::table('dictionary_words')->count());
            $this->assertSame(1, DB::table('dictionary_categories')->count());
            $this->assertSame(0, DB::table('dictionary_word_translations')->count());
        }
    }
}
