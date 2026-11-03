<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $pages = DB::table('lesson_pages')->whereNotNull('course_group_id')
            ->where('skill', 'reading')->where('learn_lang', 'lv')->pluck('id');
        $blocks = DB::table('lesson_blocks')->whereIn('lesson_page_id', $pages)
            ->where('type', 'reading')->whereNull('source_block_id')->where('is_required', false)->get();
        $variants = DB::table('lesson_block_variants')->whereIn('lesson_block_id', $blocks->pluck('id'))
            ->get()->groupBy('lesson_block_id');
        foreach ($blocks as $block) {
            $configs = collect([$block->config])->merge($variants->get($block->id, collect())->pluck('config'));
            if ($configs->contains(fn ($config) => (json_decode($config ?? '{}', true)['task_kind'] ?? null) === 'lv_to_ru')) {
                DB::table('lesson_blocks')->where('id', $block->id)->update(['is_required' => true]);
            }
        }
    }

    public function down(): void
    {
        // Data correction: do not discard later administrator decisions on rollback.
    }
};
