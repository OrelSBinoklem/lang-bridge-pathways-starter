<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\LessonController;
use App\Models\AppSetting;
use App\Models\LessonBlock;
use App\Models\LessonBlockAttempt;
use App\Models\LessonBlockCompletion;
use App\Models\LessonBlockProgress;
use App\Models\LessonPage;
use App\Services\LessonProgressService;
use App\Support\LessonBinaryTask;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class LessonBinaryTaskLengthTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('users', fn ($table) => $table->id());
        Schema::create('course_groups', fn ($table) => $table->id());
        (require database_path('migrations/2026_09_11_000002_create_lesson_pages_table.php'))->up();
        (require database_path('migrations/2026_09_11_000003_create_lesson_blocks_table.php'))->up();
        (require database_path('migrations/2026_09_11_000005_create_lesson_block_completions_table.php'))->up();
        (require database_path('migrations/2026_09_22_000001_add_course_skill_lesson_framework.php'))->up();
        (require database_path('migrations/2026_10_13_000001_add_pending_assistance_to_lesson_block_progress.php'))->up();
        (require database_path('migrations/2026_09_29_000001_create_lesson_block_responses_table.php'))->up();
        (require database_path('migrations/2026_09_25_000001_create_app_settings_table.php'))->up();
        DB::table('users')->insert([['id' => 5], ['id' => 9]]);
        AppSetting::create(['key' => LessonProgressService::ROTATION_SETTING, 'value' => LessonProgressService::ROTATION_FIXED]);
    }

    private static function configFor(int $count): array
    {
        return ['questions' => array_map(fn (int $index) => [
            'statement' => "Statement $index",
            'correct' => $index % 2 === 0,
            'explanation' => "Explanation $index",
        ], range(0, $count - 1))];
    }

    private function task(string $type, mixed $config): array
    {
        $page = LessonPage::create([
            'title' => 'Binary lesson', 'slug' => 'binary-'.LessonPage::count(),
            'learn_lang' => 'lv', 'skill' => $type, 'status' => 'published', 'is_published' => true,
        ]);
        $block = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => $type, 'position' => 0]);
        $variant = $block->variants()->create(['position' => 0, 'is_published' => true, 'config' => $config]);

        return [$block, $variant];
    }

    public static function lengths(): iterable
    {
        foreach (['reading', 'listening'] as $type) {
            foreach ([3, 5, 6, 7, 8, 9, 10] as $count) {
                foreach ([0, 2] as $tier) {
                    yield "$type-$count-tier-$tier" => [$type, $count, $tier];
                }
            }
        }
    }

    #[DataProvider('lengths')]
    public function test_lengths_preserve_scoring_maximum_cooldown_and_false_answers(string $type, int $count, int $tier): void
    {
        $this->travelTo(now('UTC')->startOfSecond());
        $config = self::configFor($count);
        LessonBinaryTask::validate($config);
        [$block, $variant] = $this->task($type, $config);
        $service = new LessonProgressService;
        $correct = array_column($config['questions'], 'correct');
        $partial = $correct;
        $partial[0] = ! $partial[0];
        $score = intdiv(($count - 1) * 100, $count);
        $cooldown = $tier === 2 ? 10_800 : 72_000;

        $first = $service->submitBinaryAttempt(5, $block, $variant->id, $partial, $tier);
        $this->assertSame($score, $first['score']);
        $this->assertSame(LessonProgressService::rankFor($score), $first['rank']);
        $this->assertFalse($first['is_practice']);
        $this->assertTrue($first['completed']);
        $this->assertCount($count, $first['feedback']);
        $this->assertFalse($first['feedback'][1]['correct']);
        $this->assertFalse($first['feedback'][1]['selected']);
        $this->assertTrue($first['feedback'][1]['is_correct']);
        $this->assertSame($partial, LessonBlockAttempt::findOrFail($first['attempt_id'])->answer['answers']);
        $this->assertSame($tier, $first['progress']['cooldown_tier']);
        $this->assertSame(now('UTC')->addSeconds($cooldown)->toIso8601String(), $first['progress']['next_scored_at']);

        $practice = $service->submitBinaryAttempt(5, $block, $variant->id, $correct, $tier);
        $this->assertSame(100, $practice['score']);
        $this->assertTrue($practice['is_practice']);
        $this->assertFalse($practice['completed']);
        $this->assertSame($first['progress'], $practice['progress']);

        $this->travel($cooldown)->seconds();
        $perfect = $service->submitBinaryAttempt(5, $block, $variant->id, $correct, $tier);
        $this->assertSame(100, $perfect['score']);
        $this->assertSame('diamond', $perfect['rank']);
        $this->assertFalse($perfect['is_practice']);
        $this->assertSame(100, $perfect['progress']['best_score']);
        $this->assertSame($correct, LessonBlockAttempt::findOrFail($perfect['attempt_id'])->answer['answers']);

        $this->travel($cooldown)->seconds();
        $failed = $service->submitBinaryAttempt(5, $block, $variant->id, array_map(fn (bool $answer) => ! $answer, $correct), $tier);
        $this->assertSame(0, $failed['score']);
        $this->assertNull($failed['rank']);
        $this->assertFalse($failed['is_practice']);
        $this->assertFalse($failed['completed']);
        $this->assertSame(100, $failed['progress']['best_score']);
        $this->assertSame('diamond', $failed['progress']['best_rank']);
        $this->assertSame(1, LessonBlockCompletion::where('user_id', 5)->where('lesson_block_id', $block->id)->count());
        $this->assertSame(4, $block->attempts()->count());
        $this->assertSame(0, LessonBlockProgress::where('user_id', 9)->count());
        $this->travelBack();
    }

    public static function invalidConfigs(): iterable
    {
        yield 'two questions' => [self::configFor(2)];
        yield 'eleven questions' => [self::configFor(11)];
        yield 'empty questions' => [['questions' => []]];
        yield 'missing questions' => [[]];
        foreach ([null, false, 'questions', 3] as $value) {
            yield 'questions '.get_debug_type($value) => [['questions' => $value]];
        }
        yield 'scalar config' => ['invalid'];
        $config = self::configFor(3);
        $questions = $config['questions'];
        yield 'sparse questions' => [['questions' => [0 => $questions[0], 2 => $questions[1], 3 => $questions[2]]]];
        yield 'named questions' => [['questions' => ['a' => $questions[0], 'b' => $questions[1], 'c' => $questions[2]]]];
        yield 'reordered questions' => [['questions' => [1 => $questions[1], 0 => $questions[0], 2 => $questions[2]]]];
        foreach (['statement', 'correct'] as $key) {
            $missing = $config;
            unset($missing['questions'][0][$key]);
            yield "missing $key" => [$missing];
        }
        foreach ([null, '', '   ', 42, false, [], ['text' => 'A']] as $index => $value) {
            $malformed = $config;
            $malformed['questions'][0]['statement'] = $value;
            yield "statement-$index" => [$malformed];
        }
        foreach ([null, 'false', 'true', '0', '1', '', 0, 1, [], ['value' => false]] as $index => $value) {
            $malformed = $config;
            $malformed['questions'][0]['correct'] = $value;
            yield "correct-$index" => [$malformed];
        }
        foreach ([null, false, 1, [], ['text' => 'A']] as $index => $value) {
            $malformed = $config;
            $malformed['questions'][0]['explanation'] = $value;
            yield "explanation-$index" => [$malformed];
        }
        foreach ([null, false, 'statement', ['A', false]] as $index => $value) {
            $malformed = $config;
            $malformed['questions'][0] = $value;
            yield "question-$index" => [$malformed];
        }
    }

    #[DataProvider('invalidConfigs')]
    public function test_malformed_published_configs_fail_validation_without_writing_progress(mixed $config): void
    {
        try {
            LessonBinaryTask::validate($config);
            $this->fail('The importer validator must reject malformed questions.');
        } catch (ValidationException $exception) {
            $this->assertStringStartsWith('config.questions', array_key_first($exception->errors()));
        }

        foreach (['reading', 'listening'] as $type) {
            [$block, $variant] = $this->task($type, $config);
            $this->assertRejected($block, $variant->id, array_fill(0, 3, false), 'config.questions');
        }
        $this->assertSame(0, LessonBlockProgress::count());
        $this->assertSame(0, LessonBlockAttempt::count());
        $this->assertSame(0, LessonBlockCompletion::count());
    }

    public static function invalidAnswers(): iterable
    {
        yield 'empty' => [[]];
        yield 'too short' => [[false, false]];
        yield 'too long' => [[false, false, false, false]];
        yield 'sparse' => [[0 => false, 2 => false, 3 => false]];
        yield 'one based' => [[1 => false, 2 => false, 3 => false]];
        yield 'named' => [['a' => false, 'b' => false, 'c' => false]];
        yield 'reordered' => [[1 => false, 0 => false, 2 => false]];
        foreach ([null, 'false', 'true', '0', '1', '', 0, 1, [], ['value' => false]] as $index => $value) {
            yield "value-$index" => [[false, $value, false]];
        }
    }

    #[DataProvider('invalidAnswers')]
    public function test_invalid_answers_cannot_mutate_existing_progress(array $answers): void
    {
        foreach (['reading', 'listening'] as $type) {
            $config = ['questions' => array_fill(0, 3, ['statement' => 'False statement', 'correct' => false])];
            [$block, $variant] = $this->task($type, $config);
            $first = (new LessonProgressService)->submitBinaryAttempt(5, $block, $variant->id, [false, false, false], 2);
            $before = LessonBlockProgress::where('lesson_block_id', $block->id)->firstOrFail()->getAttributes();
            $this->assertRejected($block, $variant->id, $answers, 'answers');
            $this->assertSame($before, LessonBlockProgress::where('lesson_block_id', $block->id)->firstOrFail()->getAttributes());
            $this->assertSame(1, $block->attempts()->count());
            $this->assertSame(100, $first['score']);
        }
    }

    public function test_legacy_block_fallback_accepts_ten_boolean_false_answers_without_explanations(): void
    {
        foreach (['reading', 'listening'] as $type) {
            $config = ['questions' => array_fill(0, 10, ['statement' => 'False statement', 'correct' => false])];
            [$block, $variant] = $this->task($type, $config);
            $variant->delete();
            $block->update(['config' => $config]);
            $result = (new LessonProgressService)->submitBinaryAttempt(5, $block, null, array_fill(0, 10, false), 0);
            $this->assertSame(100, $result['score']);
            $this->assertNull($result['variant_id']);
            $this->assertSame('', $result['feedback'][0]['explanation']);
            $this->assertFalse($result['feedback'][0]['selected']);
        }
    }

    public function test_short_tasks_keep_variant_assignment_publication_and_block_ownership(): void
    {
        foreach (['reading', 'listening'] as $type) {
            $config = self::configFor(3);
            [$block] = $this->task($type, $config);
            $block->variants()->create(['position' => 1, 'is_published' => true, 'config' => $config]);
            $hidden = $block->variants()->create(['position' => 2, 'is_published' => false, 'config' => $config]);
            [, $foreign] = $this->task($type, $config);
            $service = new LessonProgressService;
            $assigned = $service->selectedVariant($block, 5);
            $other = $block->variants()->where('is_published', true)->whereKeyNot($assigned->id)->firstOrFail();
            $answers = array_column($config['questions'], 'correct');

            $this->assertRejected($block, null, $answers, 'variant_id');
            $this->assertRejected($block, $other->id, $answers, 'variant_id');
            foreach ([false, true] as $override) {
                $this->assertRejected($block, $hidden->id, $answers, 'variant_id', $override);
                $this->assertRejected($block, $foreign->id, $answers, 'variant_id', $override);
                $this->assertRejected($block, 999999, $answers, 'variant_id', $override);
            }
            $this->assertSame(0, $block->attempts()->count());
            $this->assertSame(0, LessonBlockProgress::where('lesson_block_id', $block->id)->count());
            $accepted = $service->submitBinaryAttempt(5, $block, $assigned->id, $answers, 2);
            $this->assertSame($assigned->id, $accepted['variant_id']);
            $override = $service->submitBinaryAttempt(5, $block, $other->id, $answers, 2, true);
            $this->assertSame($other->id, $override['variant_id']);
            $this->assertTrue($override['is_practice']);
        }
    }

    public function test_controller_accepts_short_boolean_answers_and_rejects_coercible_strings(): void
    {
        foreach (['reading', 'listening'] as $type) {
            $config = self::configFor(3);
            $config['task_kind'] = $type === 'reading' ? 'reading_binary' : 'listening';
            [$block, $variant] = $this->task($type, $config);
            $controller = new LessonController(new LessonProgressService);
            $request = Request::create('/api/lessons/blocks/'.$block->id.'/attempt', 'POST', [
                'variant_id' => $variant->id, 'answers' => array_column($config['questions'], 'correct'),
            ]);
            $request->setUserResolver(fn () => (object) ['id' => 5]);
            $result = $controller->submitAttempt($request, $block)->getData(true)['data'];
            $this->assertSame(100, $result['score']);
            $this->assertCount(3, $result['feedback']);
            $request->merge(['answers' => ['1', '0', '1']]);
            try {
                $controller->submitAttempt($request, $block);
                $this->fail('Boolean-like strings must not become boolean answers.');
            } catch (ValidationException $exception) {
                $this->assertArrayHasKey('answers.0', $exception->errors());
            }
            $this->assertSame(1, $block->attempts()->count());
        }
    }

    private function assertRejected(LessonBlock $block, ?int $variantId, array $answers, string $errorPrefix, bool $override = false): void
    {
        try {
            (new LessonProgressService)->submitBinaryAttempt(5, $block, $variantId, $answers, 2, $override);
            $this->fail('Invalid binary task submission must be rejected.');
        } catch (ValidationException $exception) {
            $this->assertStringStartsWith($errorPrefix, array_key_first($exception->errors()));
        }
    }
}
