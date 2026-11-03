<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\LessonController;
use App\Models\LessonBlock;
use App\Models\LessonBlockProgress;
use App\Models\LessonPage;
use App\Services\LessonProgressService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use ReflectionMethod;
use Tests\TestCase;

class ReadingRevisionContentTest extends TestCase
{
    public function test_reviewed_binary_answer_keys_grade_correct_and_inverted_answers_through_canonical_service(): void
    {
        $files = glob(resource_path('course/reading-revisions/2026-10-12/*/*.json'));
        $this->assertCount(38, $files, 'The reviewed course must contain all 38 themes.');
        Schema::create('users', fn ($table) => $table->id());
        Schema::create('course_groups', fn ($table) => $table->id());
        foreach (['2026_09_11_000002_create_lesson_pages_table', '2026_09_11_000003_create_lesson_blocks_table',
            '2026_09_11_000005_create_lesson_block_completions_table', '2026_09_22_000001_add_course_skill_lesson_framework'] as $migration) {
            (require database_path('migrations/'.$migration.'.php'))->up();
        }
        DB::table('users')->insert(['id' => 5]);
        $page = LessonPage::create(['title' => 'Reading revision test', 'slug' => 'reading-revision-test', 'learn_lang' => 'lv',
            'skill' => 'reading', 'status' => 'published', 'is_published' => true]);
        $service = new LessonProgressService;
        $clientConfig = new ReflectionMethod(LessonController::class, 'clientConfig');
        $controller = new LessonController($service);
        $binary = $translation = 0;
        foreach ($files as $file) {
            $pack = json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
            $block = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'reading', 'position' => $binary,
                'seed_key' => 'reading-review-'.$pack['category_id'], 'config' => []]);
            $position = 0;
            foreach ($pack['variants'] as $entry) {
                $config = $entry['config'];
                if ($config['task_kind'] === 'lv_to_ru') {
                    $translation++;
                    $this->assertNotEmpty($config['source_text']);
                    $this->assertNotEmpty($config['reference_translation']);
                    $client = $clientConfig->invoke($controller, $config);
                    $this->assertSame($config['source_text'], $client['source_text']);
                    $this->assertArrayNotHasKey('reference_translation', $client);
                    continue;
                }
                $binary++;
                $variant = $block->variants()->create(['title' => $entry['title'], 'seed_key' => 'variant:'.(++$position),
                    'position' => $position, 'is_published' => true, 'config' => $config]);
                $answers = array_column($config['questions'], 'correct');
                $this->assertCount(10, $answers);
                $perfect = $service->submitBinaryAttempt(5, $block, $variant->id, $answers, 2, true);
                $this->assertSame(100, $perfect['score']);
                $this->assertSame('diamond', $perfect['rank']);
                $wrong = $service->submitBinaryAttempt(5, $block, $variant->id, array_map(fn ($answer) => ! $answer, $answers), 2, true);
                $this->assertSame(0, $wrong['score']);
                $this->assertTrue($wrong['is_practice']);
                $client = $clientConfig->invoke($controller, $config);
                foreach ($client['questions'] as $question) {
                    $this->assertArrayNotHasKey('correct', $question);
                    $this->assertArrayNotHasKey('explanation', $question);
                }
            }
            $this->assertSame(100, LessonBlockProgress::where('lesson_block_id', $block->id)->value('best_score'));
        }
        $this->assertSame(190, $binary);
        $this->assertSame(190, $translation);
        $this->assertSame(380, DB::table('lesson_block_attempts')->count());
    }
}
