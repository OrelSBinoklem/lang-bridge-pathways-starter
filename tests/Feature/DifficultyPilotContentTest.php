<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\LessonController;
use App\Models\LessonBlock;
use App\Models\LessonPage;
use App\Services\LessonProgressService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use ReflectionMethod;
use Tests\TestCase;

class DifficultyPilotContentTest extends TestCase
{
    public function test_every_starter_variant_grades_both_modes_without_exposing_keys(): void
    {
        Schema::create('users', fn ($table) => $table->id());
        Schema::create('course_groups', fn ($table) => $table->id());
        foreach (['2026_09_11_000002_create_lesson_pages_table', '2026_09_11_000003_create_lesson_blocks_table',
            '2026_09_11_000005_create_lesson_block_completions_table', '2026_09_22_000001_add_course_skill_lesson_framework',
            '2026_10_13_000001_add_pending_assistance_to_lesson_block_progress'] as $migration) {
            (require database_path('migrations/'.$migration.'.php'))->up();
        }
        DB::table('users')->insert(['id' => 5]);
        $page = LessonPage::create(['title' => 'Starter pilot', 'slug' => 'starter-pilot-test', 'learn_lang' => 'lv',
            'skill' => 'reading', 'status' => 'published', 'is_published' => true]);
        $service = new LessonProgressService;
        $controller = new LessonController($service);
        $clientConfig = new ReflectionMethod(LessonController::class, 'clientConfig');
        $binary = $translation = 0;
        foreach (glob(resource_path('course/difficulty-pilots/2026-10-13/A1/*.json')) as $file) {
            $pack = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
            foreach ($pack['variants'] as $entry) {
                $config = $entry['config'];
                $this->assertNotEmpty($entry['prerequisites']);
                $this->assertNotEmpty($entry['target_patterns']);
                $client = $clientConfig->invoke($controller, $config);
                if ($config['task_kind'] === 'lv_to_ru') {
                    $translation++;
                    $this->assertArrayNotHasKey('reference_translation', $client);
                    $this->assertSame($config['source_text'], $client['source_text']);
                    continue;
                }
                $binary++;
                $this->assertCount(5, $config['questions']);
                $this->assertCount(5, $config['assisted_questions']);
                $this->assertArrayNotHasKey('assisted_questions', $client);
                $this->assertTrue($client['assistance_available']);
                foreach ($client['questions'] as $question) {
                    $this->assertArrayNotHasKey('correct', $question);
                    $this->assertArrayNotHasKey('explanation', $question);
                    $this->assertDoesNotMatchRegularExpression('/\p{Cyrillic}/u', $question['statement']);
                }
                foreach ($entry['question_review'] as $review) {
                    $this->assertStringContainsString($review['quote'], $config['text']);
                }
                $block = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'reading', 'position' => $binary, 'config' => []]);
                $variant = $block->variants()->create(['title' => $entry['title'], 'seed_key' => 'variant:1', 'position' => 1,
                    'is_published' => true, 'config' => $config]);
                $answers = array_column($config['questions'], 'correct');
                $assistance = $service->startAssistance(5, $block, $variant->id, true);
                $this->assertSame($config['assisted_questions'], $assistance['questions']);
                $assisted = $service->submitBinaryAttempt(5, $block, $variant->id, $answers, 2, true);
                $this->assertSame(80, $assisted['score']);
                $this->assertSame(100, $assisted['raw_score']);
                $this->assertSame('silver', $assisted['rank']);
                $this->assertSame(80, $assisted['progress']['best_score']);
                $normal = $service->submitBinaryAttempt(5, $block, $variant->id, $answers, 2, true);
                $this->assertSame(100, $normal['score']);
                $this->assertSame('normal', $normal['support_mode']);
                $this->assertTrue($normal['is_practice']);
                $this->assertSame(80, $normal['progress']['best_score']);
            }
        }
        $this->assertSame(10, $binary);
        $this->assertSame(10, $translation);
    }
}
