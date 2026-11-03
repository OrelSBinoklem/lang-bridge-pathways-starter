<?php

namespace Tests\Feature;

use App\Models\Dictionary;
use App\Models\DictionaryWord;
use App\Services\EnglishDictionaryAudio;
use App\Services\EnglishSupplementDictionary;
use App\Services\EnglishSupplementRevision;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;
use RuntimeException;
use Tests\TestCase;

class EnglishSupplementRevisionTest extends TestCase
{
    private Dictionary $dictionary;

    private array $revision;

    private array $package;

    private array $original;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('users', fn ($table) => $table->id());
        foreach (['2026_08_02_000001_create_lbp_dictionary_tables.php', '2026_09_08_000001_add_multilingual_dictionary_translations.php', '2026_09_08_000002_add_info_to_dictionary_word_translations.php'] as $migration) {
            (require database_path('migrations/'.$migration))->up();
        }
        $this->original = app(EnglishSupplementDictionary::class)->load();
        $this->dictionary = app(EnglishSupplementDictionary::class)->create($this->original);
        DB::table('users')->insert(['id' => 1]);
        DB::table('user_dictionary_words')->insert(['user_id' => 1, 'dict_word_id' => $this->dictionary->dictionaryWords()->min('id'), 'correct_attempts' => 2]);
        $this->package = $this->original;
        $this->package['words'][0]['info'] = '<p>Новое пояснение.</p>';
        $this->package['words'][0]['info_uk'] = '<p>Нове пояснення.</p>';
        $this->package['categories'][0]['name'] .= ' · обновлено';
        $this->package['categories'][0]['name_uk'] .= ' · оновлено';
        $this->package['categories'][] = ['key' => 'revision-greeting', 'parent' => 'interjections', 'name' => 'Новая подборка', 'name_uk' => 'Нова добірка'];
        $this->package['words'][] = ['key' => 'hey there::interjection', 'word' => 'hey there', 'type' => 'interjection', 'level' => 2,
            'ru' => 'привет', 'uk' => 'привіт', 'info' => '', 'info_uk' => '', 'categories' => ['revision-greeting'],
            'sound_url' => $this->original['words'][0]['sound_url'], 'source_word_id' => null];
        $this->revision = $this->capture();
    }

    private function capture(bool $updateOrder = true): array
    {
        $revision = ['version' => 1, 'dictionary_id' => $this->dictionary->id,
            'package_hash' => EnglishSupplementRevision::packageHash($this->package), 'base_words' => [], 'base_categories' => []];
        if ($updateOrder) {
            $revision['update_category_order'] = true;
        }
        $desiredWords = array_column($this->package['words'], null, 'key');
        $desiredCategories = array_column($this->package['categories'], null, 'key');
        $categoryIds = [];
        foreach ($this->original['categories'] as $category) {
            $row = $this->dictionary->categories()->where('name', $category['name'])
                ->where('parent_id', $category['parent'] === null ? null : $categoryIds[$category['parent']])->with('translations')->sole();
            $categoryIds[$category['key']] = $row->id;
            $before = $row->toArray();
            $after = $before;
            $after['name'] = $desiredCategories[$category['key']]['name'];
            if ($updateOrder) {
                $after['order'] = array_search($category['key'], array_column($this->package['categories'], 'key'), true);
            }
            foreach ($after['translations'] as &$tr) {
                $tr['name'] = $desiredCategories[$category['key']][$tr['lang'] === 'uk' ? 'name_uk' : 'name'];
            }
            unset($tr);
            $revision['base_categories'][] = ['key' => $category['key'], 'id' => $row->id,
                'before_hash' => EnglishSupplementRevision::categoryHash($before), 'after_hash' => EnglishSupplementRevision::categoryHash($after)];
        }
        foreach ($this->original['words'] as $entry) {
            $row = $this->dictionary->dictionaryWords()->where('word', $entry['word'])->where('type', $entry['type'])->with(['translations', 'categories'])->sole();
            $before = $row->attributesToArray() + ['translations' => $row->translations->toArray()];
            $after = $before;
            $after['info'] = $desiredWords[$entry['key']]['info'] ?: null;
            foreach ($after['translations'] as &$tr) {
                $tr['info'] = $desiredWords[$entry['key']][$tr['lang'] === 'uk' ? 'info_uk' : 'info'] ?: null;
            }
            unset($tr);
            $revision['base_words'][] = ['key' => $entry['key'], 'id' => $row->id, 'sound_url' => $row->sound_url,
                'before_hash' => EnglishDictionaryAudio::fingerprint($before), 'after_hash' => EnglishDictionaryAudio::fingerprint($after),
                'category_ids' => $row->categories->pluck('id')->sort()->values()->all()];
        }

        return $revision;
    }

    public function test_preview_does_not_write_and_apply_keeps_existing_ids_audio_translations_and_progress(): void
    {
        $service = new EnglishSupplementRevision;
        $ids = $this->dictionary->dictionaryWords()->pluck('id')->all();
        $audio = $this->dictionary->dictionaryWords()->pluck('sound_url', 'id')->all();
        $progress = DB::table('user_dictionary_words')->get()->toJson();
        $preview = $service->prepare($this->dictionary, $this->revision, $this->package);
        $this->assertFalse($preview['already_applied']);
        $this->assertSame(1, $preview['words_added']);
        $this->assertSame(count($ids), $this->dictionary->dictionaryWords()->count());
        $service->apply($this->dictionary, $this->revision, $this->package);
        $this->assertSame(count($ids) + 1, $this->dictionary->dictionaryWords()->count());
        $this->assertSame($audio, $this->dictionary->dictionaryWords()->whereIn('id', $ids)->pluck('sound_url', 'id')->all());
        $this->assertSame($progress, DB::table('user_dictionary_words')->get()->toJson());
        $first = DictionaryWord::with('translations')->findOrFail($ids[0]);
        $this->assertSame('<p>Новое пояснение.</p>', $first->info);
        $this->assertSame('<p>Нове пояснення.</p>', $first->translations->firstWhere('lang', 'uk')->info);
        $this->assertTrue($service->apply($this->dictionary, $this->revision, $this->package)['already_applied']);
    }

    public function test_administrator_translation_edits_are_not_replaced(): void
    {
        $id = $this->revision['base_words'][0]['id'];
        DictionaryWord::findOrFail($id)->translations()->where('lang', 'ru')->update(['info' => 'Admin correction']);
        try {
            (new EnglishSupplementRevision)->apply($this->dictionary, $this->revision, $this->package);
            $this->fail('Changed translation accepted');
        } catch (InvalidArgumentException) {
            $this->assertSame('Admin correction', DictionaryWord::findOrFail($id)->translations->firstWhere('lang', 'ru')->info);
            $this->assertFalse($this->dictionary->dictionaryWords()->where('word', 'hey there')->exists());
        }
    }

    public function test_error_during_addition_rolls_back_earlier_hints_and_category_changes(): void
    {
        $id = $this->revision['base_words'][0]['id'];
        $before = DictionaryWord::findOrFail($id)->info;
        $title = $this->dictionary->categories()->orderBy('id')->value('name');
        DictionaryWord::creating(function ($word) {
            if ($word->word === 'hey there') {
                throw new RuntimeException('Injected interruption');
            }
        });
        try {
            (new EnglishSupplementRevision)->apply($this->dictionary, $this->revision, $this->package);
            $this->fail('Interrupted write committed');
        } catch (RuntimeException $error) {
            $this->assertSame('Injected interruption', $error->getMessage());
            $this->assertSame($before, DictionaryWord::findOrFail($id)->info);
            $this->assertSame($title, $this->dictionary->categories()->orderBy('id')->value('name'));
            $this->assertSame(count($this->original['words']), $this->dictionary->dictionaryWords()->count());
        } finally {
            DictionaryWord::flushEventListeners();
        }
    }

    public function test_content_only_revision_is_idempotent_without_new_rows(): void
    {
        array_pop($this->package['words']);
        array_pop($this->package['categories']);
        $this->revision = $this->capture();
        $service = new EnglishSupplementRevision;
        $service->apply($this->dictionary, $this->revision, $this->package);
        $this->assertTrue($service->prepare($this->dictionary, $this->revision, $this->package)['already_applied']);
        $this->assertSame(count($this->original['words']), $this->dictionary->dictionaryWords()->count());
    }

    public function test_legacy_revisions_without_order_flag_preserve_existing_category_order(): void
    {
        $category = $this->dictionary->categories()->where('name', 'Определители (дополнительно)')->sole();
        $category->update(['order' => 999]);
        $this->revision = $this->capture(false);
        app(EnglishSupplementRevision::class)->apply($this->dictionary, $this->revision, $this->package);
        $this->assertSame(999, $category->fresh()->order);
    }

    public function test_parts_of_speech_reclassification_keeps_word_ids_and_progress_while_reordering_categories(): void
    {
        $service = app(EnglishSupplementDictionary::class);
        $desired = $service->load();
        $desired['name'] .= ' · classification fixture';
        $newKeys = ['articles-group', 'article-basics', 'pronoun-determiner-possessive', 'pronoun-determiner-demonstrative',
            'pronoun-determiner-question', 'pronoun-quantity', 'particle-negative', 'particle-focus'];
        $legacy = $desired;
        $legacy['categories'] = array_values(array_filter($legacy['categories'], fn ($row) => ! in_array($row['key'], $newKeys, true)));
        foreach ($legacy['categories'] as &$category) {
            if ($category['key'] === 'quantity') {
                $category['name'] = 'Определители';
                $category['name_uk'] = 'Детермінативи';
            }
        }
        unset($category);
        // Simulate the former early position; the revised service must save order too.
        $quantity = array_search('quantity', array_column($legacy['categories'], 'key'), true);
        $row = $legacy['categories'][$quantity];
        array_splice($legacy['categories'], $quantity, 1);
        array_splice($legacy['categories'], 3, 0, [$row]);
        foreach ($legacy['words'] as &$word) {
            $word['categories'] = array_values(array_diff($word['categories'], $newKeys));
        }
        unset($word);
        $this->original = $legacy;
        $this->dictionary = $service->create($legacy);
        $this->package = $desired;
        $this->revision = $this->capture();
        $before = $this->dictionary->dictionaryWords()->with('translations')->orderBy('id')->get()->toJson();
        $my = $this->dictionary->dictionaryWords()->where('word', 'my')->sole();
        DB::table('user_dictionary_words')->insert(['user_id' => 1, 'dict_word_id' => $my->id, 'correct_attempts' => 2]);
        $progress = DB::table('user_dictionary_words')->get()->toJson();
        $revisionService = app(EnglishSupplementRevision::class);
        $revisionService->apply($this->dictionary, $this->revision, $this->package);
        $this->assertSame($before, $this->dictionary->dictionaryWords()->with('translations')->orderBy('id')->get()->toJson());
        $this->assertSame($progress, DB::table('user_dictionary_words')->get()->toJson());
        $this->assertCount(2, $my->fresh()->categories);
        $core = $this->dictionary->categories()->where('name', 'Важные слова A1–B2')->sole();
        $this->assertSame('Определители (дополнительно)', $core->children()->get()->last()->name);
        $this->assertSame(10, $core->children()->count());
        $this->assertTrue($revisionService->apply($this->dictionary, $this->revision, $this->package)['already_applied']);
    }
}
