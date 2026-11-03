<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dictionaries', function (Blueprint $table) {
            if (! Schema::hasColumn('dictionaries', 'translation_languages')) {
                $table->json('translation_languages')->nullable()->after('lang');
            }
        });

        Schema::create('dictionary_word_translations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('word_id')->constrained('dictionary_words')->cascadeOnDelete();
            $table->string('lang', 10);
            $table->string('translation_1')->nullable();
            $table->string('translation_2')->nullable();
            $table->string('translation_3')->nullable();
            $table->text('translation_input_variable')->nullable();
            $table->string('difficult_translation')->nullable();
            $table->timestamps();

            $table->unique(['word_id', 'lang']);
            $table->index(['lang', 'word_id']);
        });

        Schema::create('dictionary_category_translations', function (Blueprint $table) {
            $table->id();
            $table->foreignId('category_id')->constrained('dictionary_categories')->cascadeOnDelete();
            $table->string('lang', 10);
            $table->string('name');
            $table->timestamps();

            $table->unique(['category_id', 'lang']);
            $table->index(['lang', 'category_id']);
        });

        DB::table('dictionaries')
            ->orderBy('id')
            ->chunk(200, function ($dictionaries) {
                foreach ($dictionaries as $dictionary) {
                    $lang = strtolower((string) ($dictionary->lang ?: 'ru'));
                    DB::table('dictionaries')
                        ->where('id', $dictionary->id)
                        ->update(['translation_languages' => json_encode([$lang], JSON_UNESCAPED_UNICODE)]);
                }
            });

        DB::table('dictionary_words')
            ->join('dictionaries', 'dictionaries.id', '=', 'dictionary_words.dictionary_id')
            ->select([
                'dictionary_words.id',
                'dictionary_words.translation_1',
                'dictionary_words.translation_2',
                'dictionary_words.translation_3',
                'dictionary_words.translation_input_variable',
                'dictionary_words.difficult_translation',
                'dictionaries.lang',
            ])
            ->orderBy('dictionary_words.id')
            ->chunk(500, function ($words) {
                $now = now();
                foreach ($words as $word) {
                    DB::table('dictionary_word_translations')->insertOrIgnore([
                        'word_id' => $word->id,
                        'lang' => strtolower((string) ($word->lang ?: 'ru')),
                        'translation_1' => $word->translation_1,
                        'translation_2' => $word->translation_2,
                        'translation_3' => $word->translation_3,
                        'translation_input_variable' => $word->translation_input_variable,
                        'difficult_translation' => $word->difficult_translation,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            });

        DB::table('dictionary_categories')
            ->join('dictionaries', 'dictionaries.id', '=', 'dictionary_categories.dictionary_id')
            ->select([
                'dictionary_categories.id',
                'dictionary_categories.name',
                'dictionaries.lang',
            ])
            ->orderBy('dictionary_categories.id')
            ->chunk(500, function ($categories) {
                $now = now();
                foreach ($categories as $category) {
                    DB::table('dictionary_category_translations')->insertOrIgnore([
                        'category_id' => $category->id,
                        'lang' => strtolower((string) ($category->lang ?: 'ru')),
                        'name' => $category->name,
                        'created_at' => $now,
                        'updated_at' => $now,
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::dropIfExists('dictionary_category_translations');
        Schema::dropIfExists('dictionary_word_translations');

        Schema::table('dictionaries', function (Blueprint $table) {
            if (Schema::hasColumn('dictionaries', 'translation_languages')) {
                $table->dropColumn('translation_languages');
            }
        });
    }
};
