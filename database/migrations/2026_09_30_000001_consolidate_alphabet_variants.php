<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::transaction(function () {
            $pageId = DB::table('lesson_pages')->where('slug', 'grammar-a1-alphabet')->value('id');
            if (!$pageId) return;

            $blockIds = DB::table('lesson_blocks')->where('lesson_page_id', $pageId)->pluck('id');
            foreach ($blockIds as $blockId) {
                $variants = DB::table('lesson_block_variants')->where('lesson_block_id', $blockId)
                    ->orderByDesc('is_published')->orderBy('position')->orderBy('id')->get();
                $canonical = $variants->first();
                if (!$canonical) continue;

                $canonicalConfig = json_decode($canonical->config, true, 512, JSON_THROW_ON_ERROR);
                foreach ($variants->skip(1) as $extra) {
                    $hasAttempts = DB::table('lesson_block_attempts')->where('lesson_block_variant_id', $extra->id)->exists();
                    $hasResponses = DB::table('lesson_block_responses')->where('lesson_block_variant_id', $extra->id)->exists();
                    if ($hasAttempts || $hasResponses) {
                        $extraConfig = json_decode($extra->config, true, 512, JSON_THROW_ON_ERROR);
                        if (!$this->sameExercise($canonicalConfig, $extraConfig)) {
                            throw new RuntimeException("Alphabet variant {$extra->id} has attempts with different content.");
                        }
                        DB::table('lesson_block_attempts')->where('lesson_block_variant_id', $extra->id)
                            ->update(['lesson_block_variant_id' => $canonical->id]);
                        DB::table('lesson_block_responses')->where('lesson_block_variant_id', $extra->id)
                            ->update(['lesson_block_variant_id' => $canonical->id]);
                    }
                    DB::table('lesson_block_variants')->where('id', $extra->id)->delete();
                }

                if ($canonical->title === 'Вариант 1') {
                    DB::table('lesson_block_variants')->where('id', $canonical->id)->update(['title' => 'Задание']);
                }
            }
        });
    }

    private function sameExercise(array $canonical, array $extra): bool
    {
        if ($canonical === $extra) return true;
        if (($canonical['task_kind'] ?? null) !== 'grammar_items' || ($extra['task_kind'] ?? null) !== 'grammar_items') return false;

        $index = static function (array $config): array {
            $items = [];
            foreach ($config['items'] ?? [] as $item) {
                $items[$item['key']] = [$item['letter'], $item['hint']];
            }
            ksort($items);
            return $items;
        };
        return $index($canonical) === $index($extra);
    }

    public function down(): void
    {
        // Deleted duplicate content cannot be reconstructed without a database backup.
    }
};
