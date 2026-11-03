<?php

use App\Services\LessonProgressService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        $blocks = DB::table('lesson_blocks')->where('type', 'grammar')->get(['id']);
        foreach ($blocks as $block) {
            $variant = DB::table('lesson_block_variants')
                ->where('lesson_block_id', $block->id)->where('is_published', true)
                ->orderBy('position')->first(['config']);
            $config = $variant ? json_decode($variant->config, true) : null;
            $itemCount = is_array($config) && ($config['task_kind'] ?? null) === 'grammar_items'
                ? count($config['items'] ?? []) : 0;
            if ($itemCount === 0) continue;

            $rows = DB::table('lesson_grammar_item_progress')
                ->where('lesson_block_id', $block->id)->get()->groupBy('user_id');
            foreach ($rows as $userId => $items) {
                $steps = $items->sum(fn ($item) => min(2, (int) $item->direct_correct_attempts)
                    + min(2, (int) $item->reverse_correct_attempts));
                $derived = intdiv($steps * 100, $itemCount * 4);
                $existing = DB::table('lesson_block_progress')->where('user_id', $userId)
                    ->where('lesson_block_id', $block->id)->first(['best_score']);
                $score = max((int) ($existing?->best_score ?? 0), $derived);
                if ($existing && $score === (int) $existing->best_score) continue;

                $key = ['user_id' => $userId, 'lesson_block_id' => $block->id];
                $values = ['best_score' => $score, 'best_rank' => LessonProgressService::rankFor($score),
                    'updated_at' => now()];
                if ($existing) DB::table('lesson_block_progress')->where($key)->update($values);
                else DB::table('lesson_block_progress')->insert($key + $values + ['created_at' => now()]);
            }
        }
    }

    public function down(): void
    {
        // The restored progress must not be discarded on rollback.
    }
};
