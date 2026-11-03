<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('dictionary_word_translations', function (Blueprint $table) {
            if (! Schema::hasColumn('dictionary_word_translations', 'info')) {
                $table->text('info')->nullable()->after('difficult_translation');
            }
        });

        DB::table('dictionary_words')
            ->join('dictionaries', 'dictionaries.id', '=', 'dictionary_words.dictionary_id')
            ->select([
                'dictionary_words.id',
                'dictionary_words.info',
                'dictionaries.lang',
            ])
            ->whereNotNull('dictionary_words.info')
            ->where('dictionary_words.info', '<>', '')
            ->orderBy('dictionary_words.id')
            ->chunk(500, function ($words) {
                $now = now();

                foreach ($words as $word) {
                    DB::table('dictionary_word_translations')->updateOrInsert(
                        [
                            'word_id' => $word->id,
                            'lang' => strtolower((string) ($word->lang ?: 'ru')),
                        ],
                        [
                            'info' => $word->info,
                            'updated_at' => $now,
                            'created_at' => $now,
                        ],
                    );
                }
            });
    }

    public function down(): void
    {
        Schema::table('dictionary_word_translations', function (Blueprint $table) {
            if (Schema::hasColumn('dictionary_word_translations', 'info')) {
                $table->dropColumn('info');
            }
        });
    }
};
