<?php

namespace App\Console\Commands;

use App\Models\GrammarTopic;
use App\Models\CourseGroup;
use App\Models\LessonBlock;
use App\Models\LessonBlockVariant;
use App\Models\LessonPage;
use App\Services\GrammarTask;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PrepareGrammarPilots extends Command
{
    protected $signature = 'grammar:prepare-pilots {--write : Create missing pilot topics in the configured database} {--slug= : Import only this topic slug}';
    protected $description = 'Validate/import fixed grammar topics without overwriting existing content';

    public function handle(): int
    {
        $topics = array_merge(
            json_decode(file_get_contents(resource_path('course/grammar-pilots.json')), true, 512, JSON_THROW_ON_ERROR),
            json_decode(file_get_contents(resource_path('course/grammar-alphabet.json')), true, 512, JSON_THROW_ON_ERROR),
        );
        if ($slug = $this->option('slug')) {
            $topics = array_values(array_filter($topics, fn ($topic) => $topic['slug'] === $slug));
            if (!$topics) {
                $this->error("Unknown grammar topic slug: $slug");
                return self::FAILURE;
            }
        }
        foreach ($topics as &$topic) {
            foreach ($topic['blocks'] as &$block) {
                if (!isset($block['config'])) continue;
                $expectedVariants = $topic['slug'] === 'grammar-a1-alphabet' ? 1 : 5;
                if (count($block['variant_prompts'] ?? []) !== $expectedVariants) {
                    $this->error("Expected $expectedVariants variants: {$topic['slug']} / {$block['key']}");
                    return self::FAILURE;
                }
                $block['variants'] = [];
                foreach ($block['variant_prompts'] as $index => $prompt) {
                    $config = $block['config'];
                    if ($config['task_kind'] !== 'grammar_items') {
                        $config['questions'][0]['prompt'] = $prompt;
                    }
                    $block['variants'][] = [
                        'title' => $topic['slug'] === 'grammar-a1-alphabet' ? 'Задание' : 'Вариант '.($index + 1),
                        'config' => $config,
                    ];
                }
            }
            unset($block);
        }
        unset($topic);
        foreach ($topics as $topic) foreach ($topic['blocks'] as $block) foreach ($block['variants'] as $variant) GrammarTask::validate($variant['config']);
        $blocks = array_sum(array_map(fn ($topic) => count($topic['blocks']), $topics));
        $variants = array_sum(array_map(fn ($topic) => array_sum(array_map(fn ($block) => count($block['variants']), $topic['blocks'])), $topics));
        $questions = array_sum(array_map(fn ($topic) => array_sum(array_map(fn ($block) => array_sum(array_map(fn ($variant) => count($variant['config']['questions'] ?? $variant['config']['items'] ?? []), $block['variants'])), $topic['blocks'])), $topics));
        $this->info("Validated: ".count($topics)." topics, $blocks tasks, $variants variants, $questions questions.");
        if (!$this->option('write')) return self::SUCCESS;
        DB::transaction(function () use ($topics) {
            foreach ($topics as $topic) {
                $groupId = null;
                if (isset($topic['course_group_seed_key'])) {
                    $groupId = CourseGroup::where('seed_key', $topic['course_group_seed_key'])->value('id');
                    if (!$groupId) throw new \RuntimeException("Missing course group: {$topic['course_group_seed_key']}");
                }
                $page = LessonPage::firstOrCreate(['slug' => $topic['slug']], [
                    'title' => $topic['title'], 'description' => $topic['description'], 'level' => $topic['level'] ?? 'A1',
                    'learn_lang' => 'lv', 'skill' => 'grammar', 'status' => 'published', 'is_published' => true,
                    'seed_key' => $topic['slug'], 'course_group_id' => $groupId,
                ]);
                if (!$page->wasRecentlyCreated) { $this->line("Preserved: {$page->slug}"); continue; }
                GrammarTopic::create(['lesson_page_id' => $page->id, ...array_intersect_key($topic, array_flip(['rule', 'examples', 'table_keys']))]);
                foreach ($topic['blocks'] as $position => $source) {
                    $block = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'grammar', 'title' => $source['title'], 'is_required' => true, 'weight' => 100, 'position' => $position, 'seed_key' => $topic['slug'].'-'.($source['key'] ?? $source['kind'])]);
                    foreach ($source['variants'] as $index => $variant) LessonBlockVariant::create([
                        'lesson_block_id' => $block->id, 'title' => $variant['title'], 'config' => $variant['config'],
                        'position' => $index, 'is_published' => true, 'seed_key' => $block->seed_key.'-'.($index + 1),
                    ]);
                }
                $this->line("Created: {$page->slug}");
            }
        });
        return self::SUCCESS;
    }
}
