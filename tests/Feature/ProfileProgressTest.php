<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\ProfileController;
use App\Models\UserDictionaryWord;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ProfileProgressTest extends TestCase
{
    public function test_plain_rows_match_eloquent_json_and_remain_scoped_to_user_and_dictionary(): void
    {
        Schema::create('dictionaries', fn ($table) => $table->integer('id'));
        Schema::create('dictionary_words', function ($table) {
            $table->integer('id');
            $table->integer('dictionary_id');
        });
        Schema::create('user_dictionary_words', function ($table) {
            foreach (['id', 'user_id', 'dict_word_id', 'attempts', 'easy_education',
                'mode_education', 'mode_education_revert', 'easy_correct', 'easy_correct_revert', 'is_reset'] as $field) {
                $table->integer($field)->default(0);
            }
            foreach (['last_shown', 'last_shown_revert', 'created_at', 'updated_at'] as $field) {
                $table->timestamp($field)->nullable();
            }
        });
        DB::table('dictionaries')->insert(['id' => 20]);
        DB::table('dictionary_words')->insert([['id' => 1, 'dictionary_id' => 20], ['id' => 2, 'dictionary_id' => 21]]);
        DB::table('user_dictionary_words')->insert([
            'id' => 1, 'user_id' => 5, 'dict_word_id' => 1, 'attempts' => 7,
            'easy_education' => 1, 'last_shown' => '2026-09-01 12:34:56',
            'created_at' => '2026-08-01 00:00:00',
        ]);
        DB::table('user_dictionary_words')->insert([
            ['id' => 2, 'user_id' => 6, 'dict_word_id' => 1],
            ['id' => 3, 'user_id' => 5, 'dict_word_id' => 2],
        ]);
        $expected = UserDictionaryWord::where('id', 1)->first()->toArray();
        $hydrated = 0;
        UserDictionaryWord::retrieved(function () use (&$hydrated) { ++$hydrated; });
        $request = Request::create('/api/me/progress', 'GET', ['dictionary_id' => 20]);
        $request->setUserResolver(fn () => (object) ['id' => 5]);
        $response = (new ProfileController)->progress($request);
        $this->assertSame(['data' => [$expected]], $response->getData(true));
        $this->assertSame(0, $hydrated);
        $request->query->set('date_format', 'raw');
        $raw = (new ProfileController)->progress($request)->getData(true);
        $this->assertSame('UTC', $raw['timezone']);
        $this->assertSame('2026-09-01 12:34:56', $raw['data'][0]['last_shown']);
        $this->assertNull($raw['data'][0]['last_shown_revert']);
        $this->assertTrue($raw['data'][0]['easy_education']);
        $this->assertSame(0, $hydrated);
    }
}
