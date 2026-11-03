<?php

namespace Tests\Feature;

use App\Models\Dictionary;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DictionaryCatalogTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('dictionaries', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('lang')->default('RU');
            $table->string('learn_lang')->default('EN');
            $table->integer('words')->default(1);
            $table->integer('level')->default(1);
            $table->integer('max_level')->default(4);
            $table->boolean('sound')->default(true);
            $table->json('translation_languages')->default('["ru"]');
            $table->timestamps();
        });
        foreach ([31 => 'Русско-Английский (Американский) Тематический', 32 => 'Авторский (Американский) расширенный',
            38 => 'Английский (американский) — по уровням и темам', 39 => 'Английский — дополнительный'] as $id => $name) {
            DB::table('dictionaries')->insert(['id' => $id, 'name' => $name]);
        }
        Schema::create('dictionary_words', function ($table) {
            $table->id();
            $table->integer('dictionary_id');
            $table->string('word');
        });
        Schema::create('user_dictionary_words', function ($table) {
            $table->integer('user_id');
            $table->integer('dict_word_id');
            $table->integer('progress');
        });
        DB::table('dictionary_words')->insert(['id' => 91, 'dictionary_id' => 31, 'word' => 'example']);
        DB::table('user_dictionary_words')->insert(['user_id' => 7, 'dict_word_id' => 91, 'progress' => 4]);
    }

    private function migration(): object
    {
        return require database_path('migrations/2026_11_01_000001_curate_english_dictionary_catalog.php');
    }

    public function test_old_sources_are_hidden_but_keep_their_urls_words_progress_and_ids(): void
    {
        $words = DB::table('dictionary_words')->get()->all();
        $progress = DB::table('user_dictionary_words')->get()->all();
        $this->migration()->up();
        $items = $this->getJson('/api/dictionaries?learn_lang=en')->assertOk()->json('data');
        $this->assertSame([38, 39], array_column($items, 'id'));
        $this->assertSame(['Русско-Английский (Американский) Тематический', 'Авторский (Американский) расширенный'], array_column($items, 'name'));
        $user = new User;
        $user->forceFill(['id' => 7, 'name' => 'Learner']);
        $this->actingAs($user);
        $this->getJson('/api/dictionaries/31')->assertOk()->assertJsonPath('data.name', 'Русско-Английский (Американский) Тематический · устаревший');
        $this->getJson('/api/dictionaries/32')->assertOk()->assertJsonPath('data.name', 'Авторский (Американский) расширенный · устаревший');
        $this->assertSame(4, Dictionary::count());
        $this->assertEquals($words, DB::table('dictionary_words')->get()->all());
        $this->assertEquals($progress, DB::table('user_dictionary_words')->get()->all());
        $this->assertSame(4, Dictionary::findOrFail(39)->max_level);
    }

    public function test_admin_visibility_changes_invalidate_the_cached_catalog_and_new_records_are_visible(): void
    {
        $this->migration()->up();
        $this->getJson('/api/dictionaries?learn_lang=en')->assertJsonCount(2, 'data');
        Dictionary::findOrFail(38)->update(['is_listed' => false]);
        $this->assertSame([39], array_column($this->getJson('/api/dictionaries?learn_lang=en')->assertOk()->json('data'), 'id'));
        $new = Dictionary::create(['name' => 'New', 'learn_lang' => 'EN']);
        $this->assertTrue($new->fresh()->is_listed);
        $this->getJson('/api/dictionaries?learn_lang=en')->assertJsonCount(2, 'data');
    }

    public function test_independent_admin_titles_and_other_languages_are_not_overwritten_and_down_restores_names(): void
    {
        DB::table('dictionaries')->where('id', 38)->update(['name' => 'Administrator title']);
        DB::table('dictionaries')->where('id', 32)->update(['learn_lang' => 'LV']);
        $migration = $this->migration();
        $migration->up();
        $this->assertSame('Administrator title', Dictionary::findOrFail(38)->name);
        $this->assertTrue(Dictionary::findOrFail(32)->is_listed);
        $migration->down();
        $this->assertFalse(Schema::hasColumn('dictionaries', 'is_listed'));
        $this->assertSame('Английский — дополнительный', Dictionary::findOrFail(39)->name);
        $this->assertSame('Administrator title', Dictionary::findOrFail(38)->name);
        $this->assertSame('Русско-Английский (Американский) Тематический', Dictionary::findOrFail(31)->name);
    }
}
