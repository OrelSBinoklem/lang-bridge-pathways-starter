<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('grammar_topics')) return;
        DB::transaction(function () {
            $pageId = DB::table('lesson_pages')->where('slug', 'grammar-a1-patik-infinitive')->value('id');
            $topic = DB::table('grammar_topics')->where('lesson_page_id', $pageId)->lockForUpdate()->first();
            if (! $topic) return;
            $keys = json_decode($topic->table_keys ?: '[]', true, 512, JSON_THROW_ON_ERROR);
            if (in_array('patikInfinitive', $keys, true)) return;
            $keys[] = 'patikInfinitive';
            DB::table('grammar_topics')->where('id', $topic->id)->update(['table_keys' => json_encode($keys)]);
        });
    }

    public function down(): void
    {
        // Preserve editorial links and all learner progress when rolling back code.
    }
};
