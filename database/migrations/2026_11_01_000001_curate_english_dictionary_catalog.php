<?php

use App\Services\DictionaryCache;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const NAMES = [
        31 => ['Русско-Английский (Американский) Тематический', 'Русско-Английский (Американский) Тематический · устаревший', false],
        32 => ['Авторский (Американский) расширенный', 'Авторский (Американский) расширенный · устаревший', false],
        38 => ['Английский (американский) — по уровням и темам', 'Русско-Английский (Американский) Тематический', true],
        39 => ['Английский — дополнительный', 'Авторский (Американский) расширенный', true],
    ];

    public function up(): void
    {
        Schema::table('dictionaries', function (Blueprint $table) {
            $table->boolean('is_listed')->default(true);
        });
        DB::transaction(function () {
            foreach (self::NAMES as $id => [$before, $after, $listed]) {
                // Fresh installations may not contain these dictionaries. Never
                // overwrite another language or an independently edited title.
                DB::table('dictionaries')->where('id', $id)->whereRaw('LOWER(learn_lang) = ?', ['en'])
                    ->where('name', $before)->update(['name' => $after, 'is_listed' => $listed]);
            }
        });
        DictionaryCache::invalidate();
    }

    public function down(): void
    {
        DB::transaction(function () {
            foreach (self::NAMES as $id => [$before, $after, $listed]) {
                DB::table('dictionaries')->where('id', $id)->whereRaw('LOWER(learn_lang) = ?', ['en'])
                    ->where('name', $after)->where('is_listed', $listed)->update(['name' => $before]);
            }
        });
        Schema::table('dictionaries', fn (Blueprint $table) => $table->dropColumn('is_listed'));
        DictionaryCache::invalidate();
    }
};
