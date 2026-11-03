<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\LessonBlock;
use App\Models\LessonBlockAttempt;
use App\Models\LessonBlockCompletion;
use App\Models\LessonBlockProgress;
use App\Models\LessonBlockResponse;
use App\Models\LessonBlockVariant;
use App\Models\LessonPage;
use App\Services\LessonProgressService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class CoursePracticeProgressTest extends TestCase
{
    private LessonProgressService $progress;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('users', fn ($table) => $table->id());
        Schema::create('course_groups', fn ($table) => $table->id());
        foreach ([
            '2026_09_11_000002_create_lesson_pages_table',
            '2026_09_11_000003_create_lesson_blocks_table',
            '2026_09_11_000005_create_lesson_block_completions_table',
            '2026_09_22_000001_add_course_skill_lesson_framework',
            '2026_09_29_000001_create_lesson_block_responses_table',
            '2026_09_25_000001_create_app_settings_table',
            '2026_10_13_000001_add_pending_assistance_to_lesson_block_progress',
            '2026_10_13_000002_add_practice_variant_archive',
        ] as $migration) {
            (require database_path("migrations/$migration.php"))->up();
        }
        DB::table('users')->insert([['id' => 5], ['id' => 9]]);
        DB::table('course_groups')->insert(['id' => 1]);
        $this->progress = new LessonProgressService;
        $this->travelTo(now('UTC')->startOfSecond());
    }

    protected function tearDown(): void
    {
        $this->travelBack();
        parent::tearDown();
    }

    private function task(string $type = 'reading', bool $groupLinked = true, ?string $skill = null): LessonBlock
    {
        $page = LessonPage::create([
            'title' => 'Course practice', 'slug' => 'practice-'.LessonPage::count(),
            'learn_lang' => 'lv', 'skill' => $skill ?? $type, 'course_group_id' => $groupLinked ? 1 : null,
            'status' => 'published', 'is_published' => true,
        ]);
        return $page->blocks()->create(['type' => $type, 'position' => 0, 'is_required' => true]);
    }

    public function test_productive_scores_allow_improvement_deduplicate_and_preserve_best_and_other_users(): void
    {
        Schema::table('users', fn ($table) => $table->integer('course_target_score')->default(60));
        DB::table('users')->where('id', 5)->update(['course_target_score' => 90]);
        $block = $this->task('speaking');
        $variant = $this->variant($block, 0);
        $this->mock(\App\Services\ProductivePracticeAssessment::class, function ($mock) {
            $mock->shouldReceive('assess')->once()->withArgs(fn ($config, $answer) => $answer === 'First answer')
                ->andReturn(['score' => 80, 'feedback' => 'Есть небольшие ошибки.', 'recommendation' => 'Исправь окончания.']);
            $mock->shouldReceive('assess')->once()->withArgs(fn ($config, $answer) => $answer === 'Improved answer')
                ->andReturn(['score' => 100, 'feedback' => 'Всё верно.', 'recommendation' => '']);
            $mock->shouldReceive('assess')->once()->withArgs(fn ($config, $answer) => $answer === 'Weaker answer')
                ->andReturn(['score' => 40, 'feedback' => 'Цель не выполнена.', 'recommendation' => 'Уточни ответ.']);
        });
        $first = $this->progress->assessPracticeBlock(5, $block, $variant->id, 'First answer');
        $this->assertSame(80, $first['score']);
        $this->assertTrue($first['can_improve']);
        $this->assertFalse($first['target_reached']);
        $this->assertSame($first['attempt_id'], $this->progress->assessPracticeBlock(5, $block, $variant->id, 'First answer')['attempt_id']);
        $last = $this->progress->assessPracticeBlock(5, $block, $variant->id, 'Improved answer');
        $this->assertSame(100, $last['score']);
        $this->assertFalse($last['can_improve']);
        $this->assertTrue($last['target_reached']);
        $this->assertSame('Бриллиант', $last['rank_label']);
        $weaker = $this->progress->assessPracticeBlock(5, $block, $variant->id, 'Weaker answer');
        $this->assertFalse($weaker['completed']);
        $this->assertSame(100, LessonBlockProgress::where('user_id', 5)->first()->best_score);
        $this->assertSame(0, LessonBlockProgress::where('user_id', 9)->count());
        $this->assertSame(3, LessonBlockAttempt::count());
    }

    public function test_failed_productive_assessment_does_not_create_completion_or_score(): void
    {
        $block = $this->task('writing'); $variant = $this->variant($block, 0);
        $this->mock(\App\Services\ProductivePracticeAssessment::class, fn ($mock) => $mock->shouldReceive('assess')->once()->andThrow(new \RuntimeException('Unavailable')));
        try { $this->progress->assessPracticeBlock(5, $block, $variant->id, 'Actual answer'); $this->fail('Expected assessment failure'); }
        catch (\Symfony\Component\HttpKernel\Exception\HttpException $error) { $this->assertSame(503, $error->getStatusCode()); }
        $this->assertSame(0, LessonBlockAttempt::count());
        $this->assertSame(0, LessonBlockCompletion::count());
    }

    private function variant(LessonBlock $block, int $position, bool $published = true): LessonBlockVariant
    {
        $config = $block->type === 'grammar'
            ? ['task_kind' => 'grammar_gap', 'questions' => [['prompt' => 'Es {{blank}} students.', 'accepted_answers' => ['esmu']]]]
            : [
                'task_kind' => $block->type === 'listening' ? 'listening' : 'reading_binary',
                'questions' => array_map(fn ($index) => ['statement' => "Statement $index", 'correct' => true], range(1, 5)),
                'assisted_questions' => array_fill(0, 5, 'Translated statement'),
            ];
        $variant = $block->variants()->create(['position' => $position, 'is_published' => $published, 'config' => $config]);
        $block->unsetRelation('variants');
        return $variant;
    }

    private function submit(LessonBlock $block, LessonBlockVariant $variant, int $correct = 5, int $userId = 5): array
    {
        return $this->progress->submitBinaryAttempt($userId, $block, $variant->id,
            [...array_fill(0, $correct, true), ...array_fill(0, 5 - $correct, false)], 2);
    }

    private function summary(LessonBlock $block, int $userId = 5): array
    {
        $page = $block->page->fresh();
        return $this->progress->summariesForPages($userId, collect([$page]))[$page->id];
    }

    private function assertInvalid(callable $action, string $field = 'variant_id'): void
    {
        try {
            $action();
            $this->fail('Expected validation to reject the request.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey($field, $exception->errors());
        }
    }

    public static function skills(): iterable
    {
        foreach (['listening', 'reading', 'writing', 'speaking'] as $skill) yield $skill => [$skill];
    }

    #[DataProvider('skills')]
    public function test_default_is_first_available_for_every_user_and_rotation_mode(string $skill): void
    {
        $block = $this->task($skill);
        $archived = $this->variant($block, 0);
        $archived->forceFill(['practice_archived_at' => now('UTC')])->save();
        $this->variant($block, 1, false);
        $last = $this->variant($block, 4);
        $first = $this->variant($block, 2);
        $this->variant($block, 3);
        LessonBlockResponse::create([
            'user_id' => 5, 'lesson_block_id' => $block->id, 'lesson_block_variant_id' => $last->id, 'status' => 'accepted',
        ]);
        foreach (array_keys(LessonProgressService::rotationModes()) as $mode) {
            AppSetting::updateOrCreate(['key' => LessonProgressService::ROTATION_SETTING], ['value' => $mode]);
            foreach ([5, 9] as $userId) {
                $this->assertSame($first->id, $this->progress->selectedVariant($block->fresh(), $userId)?->id);
                $this->assertSame($first->id, $this->progress->selectedVariant($block->fresh()->load('variants'), $userId)?->id);
            }
        }
    }

    #[DataProvider('skills')]
    public function test_students_can_select_any_available_variant_but_not_foreign_unpublished_or_archived(string $skill): void
    {
        $block = $this->task($skill);
        $this->variant($block, 0);
        $chosen = $this->variant($block, 1);
        $archived = $this->variant($block, 2);
        $archived->forceFill(['practice_archived_at' => now('UTC')])->save();
        $unpublished = $this->variant($block, 3, false);
        $foreign = $this->variant($this->task($skill), 0);
        $submit = fn ($variant, $override = false) => in_array($skill, ['writing', 'speaking'], true)
            ? $this->progress->completePracticeBlock(5, $block, $variant->id, 'My answer', null, $override)
            : $this->progress->submitBinaryAttempt(5, $block, $variant->id, array_fill(0, 5, true), 2, $override);
        foreach ([$archived, $unpublished, $foreign] as $invalid) {
            $this->assertNull($this->progress->publishedVariant($block, $invalid->id));
            $this->assertInvalid(fn () => $submit($invalid));
            $this->assertInvalid(fn () => $submit($invalid, true));
        }
        $this->assertSame(0, LessonBlockCompletion::count());
        $this->assertSame(0, LessonBlockProgress::count());
        $submit($chosen);
        $this->assertTrue($this->summary($block)['completed']);
        $this->assertSame(0, $this->summary($block)['additional_variants']);
    }

    public static function binarySkills(): iterable
    {
        yield 'reading' => ['reading'];
        yield 'listening' => ['listening'];
    }

    #[DataProvider('binarySkills')]
    public function test_sixty_passes_and_distinct_practice_successes_do_not_change_best_score_or_cooldown(string $skill): void
    {
        $block = $this->task($skill);
        $first = $this->variant($block, 0);
        $second = $this->variant($block, 1);
        $third = $this->variant($block, 2);
        $base = $this->submit($block, $third, 3);
        $this->assertSame(60, $base['score']);
        $this->assertSame('bronze', $base['rank']);
        $this->assertTrue($base['completed']);
        $this->assertSame(now('UTC')->addSeconds(10_800)->toIso8601String(), $base['progress']['next_scored_at']);
        $this->assertSame(0, $this->summary($block)['additional_variants']);
        $this->submit($block, $first, 2);
        $this->assertSame(0, $this->summary($block)['additional_variants']);
        $practice = $this->submit($block, $first, 3);
        $this->assertTrue($practice['is_practice']);
        $this->assertFalse($practice['completed']);
        $this->submit($block, $first);
        $this->assertSame(1, $this->summary($block)['additional_variants']);
        $practice = $this->submit($block, $second);
        $this->assertSame($base['progress'], $practice['progress']);
        $this->assertSame(2, $this->summary($block)['additional_variants']);
        $this->assertSame(60, $this->summary($block)['best_score']);
        $this->assertSame(0, $this->summary($block, 9)['additional_variants']);
        $this->assertFalse($this->summary($block, 9)['completed']);
    }

    public function test_practice_successes_cannot_claim_a_base_completion_after_a_failed_scored_attempt(): void
    {
        $block = $this->task();
        $first = $this->variant($block, 0);
        $second = $this->variant($block, 1);
        $this->submit($block, $first, 2);
        $this->submit($block, $first);
        $this->submit($block, $second);
        $summary = $this->summary($block);
        $this->assertSame(1, $summary['additional_variants']);
        $this->assertSame(40, $summary['best_score']);
        $this->assertSame(0, $summary['passed']);
        $this->assertFalse($summary['completed']);
        $this->assertNull($summary['best_rank']);
        $this->assertSame(0, LessonBlockCompletion::count());
        $this->assertSame(array_fill(0, 3, ['passed' => 0, 'total' => 1]), $summary['practice_rounds']);
        $this->submit($block, $this->variant($block, 2));
        $this->assertSame(2, $this->summary($block)['additional_variants']);
        $this->assertSame(array_fill(0, 3, ['passed' => 0, 'total' => 1]), $this->summary($block)['practice_rounds']);
    }

    public function test_assisted_scores_use_the_discounted_threshold_and_preserve_a_better_scored_result(): void
    {
        $block = $this->task();
        $first = $this->variant($block, 0);
        $second = $this->variant($block, 1);
        $third = $this->variant($block, 2);
        $this->submit($block, $first);
        $this->progress->startAssistance(5, $block, $second->id);
        $failed = $this->submit($block, $second, 3);
        $this->assertSame(60, $failed['raw_score']);
        $this->assertSame(48, $failed['score']);
        $this->assertSame(0, $this->summary($block)['additional_variants']);
        $this->progress->startAssistance(5, $block, $second->id);
        $passed = $this->submit($block, $second, 4);
        $this->assertSame(64, $passed['score']);
        $this->assertSame(1, $this->summary($block)['additional_variants']);
        $this->travel(10_800)->seconds();
        $this->progress->startAssistance(5, $block, $third->id);
        $scored = $this->submit($block, $third, 4);
        $this->assertFalse($scored['is_practice']);
        $this->assertSame(100, $scored['progress']['best_score']);
        $this->assertSame(2, $this->summary($block)['additional_variants']);
        $this->assertSame([], LessonBlockProgress::firstOrFail()->assisted_variant_ids);
    }

    public function test_archived_and_unpublished_history_stays_saved_but_does_not_count_as_retained_extras(): void
    {
        $block = $this->task();
        $first = $this->variant($block, 0);
        $second = $this->variant($block, 1);
        $third = $this->variant($block, 2);
        foreach ([$first, $second, $third] as $variant) $this->submit($block, $variant);
        $this->assertSame(array_fill(0, 3, ['passed' => 1, 'total' => 1]), $this->summary($block)['practice_rounds']);
        $second->forceFill(['practice_archived_at' => now('UTC')])->save();
        $this->assertSame(1, $this->summary($block)['additional_variants']);
        $this->assertSame([
            ['passed' => 1, 'total' => 1], ['passed' => 1, 'total' => 1], ['passed' => 0, 'total' => 1],
        ], $this->summary($block)['practice_rounds']);
        $third->update(['is_published' => false]);
        $this->assertSame(0, $this->summary($block)['additional_variants']);
        $this->assertSame([
            ['passed' => 1, 'total' => 1], ['passed' => 0, 'total' => 1], ['passed' => 0, 'total' => 1],
        ], $this->summary($block)['practice_rounds']);
        $first->forceFill(['practice_archived_at' => now('UTC')])->save();
        $this->assertNull($this->progress->selectedVariant($block->fresh(), 5));
        $this->assertTrue($this->summary($block)['completed']);
        $this->assertSame(100, $this->summary($block)['best_score']);
        $this->assertSame(3, LessonBlockAttempt::count());
        $this->assertSame([
            ['passed' => 1, 'total' => 1], ['passed' => 0, 'total' => 1], ['passed' => 0, 'total' => 1],
        ], $this->summary($block)['practice_rounds']);
    }

    public static function responseSkills(): iterable
    {
        yield 'writing' => ['writing'];
        yield 'speaking' => ['speaking'];
    }

    #[DataProvider('responseSkills')]
    public function test_accepted_responses_allow_distinct_extras_require_new_evidence_and_dedupe_callbacks(string $skill): void
    {
        $block = $this->task($skill);
        $first = $this->variant($block, 0);
        $second = $this->variant($block, 1);
        $third = $this->variant($block, 2);
        $this->assertTrue($this->progress->completePracticeBlock(5, $block, $third->id));
        $completedAt = LessonBlockCompletion::firstOrFail()->completed_at;
        $this->assertFalse($this->progress->completePracticeBlock(5, $block, $third->id));
        foreach ([null, '', '   '] as $empty) {
            $this->assertInvalid(fn () => $this->progress->completePracticeBlock(5, $block, $first->id, $empty), 'answer_text');
        }
        $this->assertSame(1, LessonBlockResponse::count());
        $this->travel(1)->hour();
        $this->assertTrue($this->progress->completePracticeBlock(5, $block, $first->id, ' My answer ', ' Feedback '));
        $this->assertFalse($this->progress->completePracticeBlock(5, $block, $first->id, 'Repeated answer'));
        $this->assertFalse($this->progress->completePracticeBlock(5, $block, $first->id));
        $this->assertTrue($this->progress->completePracticeBlock(5, $block, $second->id, '0'));
        $this->assertSame(['My answer', '0'], LessonBlockResponse::whereNotNull('answer_text')->orderBy('id')->pluck('answer_text')->all());
        $this->assertSame(2, $this->summary($block)['additional_variants']);
        $this->assertNull($this->summary($block)['best_score']);
        $this->assertNull($this->summary($block)['best_rank']);
        $this->assertTrue($completedAt->equalTo(LessonBlockCompletion::firstOrFail()->completed_at));
        $this->assertSame(0, LessonBlockAttempt::count());
        $this->assertSame(0, LessonBlockProgress::count());
        $this->assertTrue($this->progress->completePracticeBlock(9, $block, $first->id, 'Other learner'));
        $this->assertSame(0, $this->summary($block, 9)['additional_variants']);
        $first->forceFill(['practice_archived_at' => now('UTC')])->save();
        $this->assertSame(1, $this->summary($block)['additional_variants']);
        $this->assertSame(4, LessonBlockResponse::count());
    }

    public function test_submitted_reading_translations_are_not_successes(): void
    {
        $block = $this->task();
        foreach ([0, 1] as $position) {
            $variant = $this->variant($block, $position);
            $variant->update(['config' => ['task_kind' => 'lv_to_ru', 'text' => 'Sveiki!']]);
            $response = $this->progress->submitFreeResponse(5, $block, $variant->id, 'Translation');
            $this->assertSame('submitted', $response->status);
        }
        $this->assertFalse($this->summary($block)['completed']);
        $this->assertSame(0, $this->summary($block)['additional_variants']);
        $this->assertSame(array_fill(0, 3, ['passed' => 0, 'total' => 1]), $this->summary($block)['practice_rounds']);
    }

    #[DataProvider('skills')]
    public function test_rounds_count_required_blocks_independently_and_allow_any_first_variant(string $skill): void
    {
        $firstBlock = $this->task($skill);
        $secondBlock = $firstBlock->page->blocks()->create(['type' => $skill, 'position' => 1, 'is_required' => true]);
        $optionalBlock = $firstBlock->page->blocks()->create(['type' => $skill, 'position' => 2, 'is_required' => false]);
        $variants = [];
        foreach ([$firstBlock, $secondBlock, $optionalBlock] as $block) {
            $variants[$block->id] = collect(range(0, 2))->map(fn ($position) => $this->variant($block, $position))->all();
        }
        $succeed = function (LessonBlock $block, int $position, int $userId = 5) use ($skill, $variants): void {
            $variant = $variants[$block->id][$position];
            if (in_array($skill, ['writing', 'speaking'], true)) {
                $this->progress->completePracticeBlock($userId, $block, $variant->id, 'Accepted answer');
            } else {
                $this->submit($block, $variant, 3, $userId);
            }
        };

        $succeed($firstBlock, 2);
        $succeed($firstBlock, 0);
        $succeed($firstBlock, 0);
        foreach ([0, 1, 2] as $position) $succeed($optionalBlock, $position);
        $summary = $this->summary($firstBlock);
        $this->assertSame([
            ['passed' => 1, 'total' => 2], ['passed' => 1, 'total' => 2], ['passed' => 0, 'total' => 2],
        ], $summary['practice_rounds']);
        $this->assertSame(3, $summary['additional_variants']);
        $this->assertFalse($summary['completed']);

        $succeed($firstBlock, 1);
        $this->assertSame(array_fill(0, 3, ['passed' => 1, 'total' => 2]), $this->summary($firstBlock)['practice_rounds']);
        $succeed($secondBlock, 1);
        $this->assertSame([
            ['passed' => 2, 'total' => 2], ['passed' => 1, 'total' => 2], ['passed' => 1, 'total' => 2],
        ], $this->summary($firstBlock)['practice_rounds']);

        $succeed($secondBlock, 0, 9);
        $succeed($secondBlock, 2, 9);
        $succeed($secondBlock, 1, 9);
        $this->assertSame(array_fill(0, 3, ['passed' => 1, 'total' => 2]), $this->summary($firstBlock, 9)['practice_rounds']);
        $this->assertSame([
            ['passed' => 2, 'total' => 2], ['passed' => 1, 'total' => 2], ['passed' => 1, 'total' => 2],
        ], $this->summary($firstBlock)['practice_rounds']);
        $succeed($secondBlock, 0);
        $this->assertSame([
            ['passed' => 2, 'total' => 2], ['passed' => 2, 'total' => 2], ['passed' => 1, 'total' => 2],
        ], $this->summary($firstBlock)['practice_rounds']);
        $succeed($secondBlock, 2);
        $this->assertSame(array_fill(0, 3, ['passed' => 2, 'total' => 2]), $this->summary($firstBlock)['practice_rounds']);
    }

    public function test_rounds_with_no_required_blocks_are_zero_and_keep_optional_extras(): void
    {
        $block = $this->task();
        $block->update(['is_required' => false]);
        foreach ([0, 1, 2] as $position) $this->submit($block, $this->variant($block, $position));
        $summary = $this->summary($block);
        $this->assertSame(array_fill(0, 3, ['passed' => 0, 'total' => 0]), $summary['practice_rounds']);
        $this->assertSame(2, $summary['additional_variants']);
        $this->assertFalse($summary['completed']);
    }

    public function test_rounds_reuse_history_queries_across_pages(): void
    {
        $reading = $this->task();
        $writing = $this->task('writing');
        foreach ([0, 1, 2] as $position) {
            $this->submit($reading, $this->variant($reading, $position));
            $variant = $this->variant($writing, $position);
            $this->progress->completePracticeBlock(5, $writing, $variant->id, 'Accepted answer');
        }
        DB::enableQueryLog();
        try {
            $summaries = $this->progress->summariesForPages(5, collect([$reading->page, $writing->page]));
            $queries = collect(DB::getQueryLog())->pluck('query');
        } finally {
            DB::disableQueryLog();
            DB::flushQueryLog();
        }
        foreach (['lesson_block_attempts', 'lesson_block_responses'] as $table) {
            $this->assertCount(1, $queries->filter(fn ($query) => str_contains($query, $table)));
        }
        foreach ($summaries as $summary) {
            $this->assertSame(array_fill(0, 3, ['passed' => 1, 'total' => 1]), $summary['practice_rounds']);
        }
    }

    public function test_grammar_and_standalone_summary_contracts_do_not_gain_rounds(): void
    {
        foreach ([$this->task('grammar'), $this->task('reading', false)] as $block) {
            $this->assertSame(['completed', 'passed', 'total', 'best_score', 'best_rank', 'additional_variants'],
                array_keys($this->summary($block)));
        }
    }

    public function test_fourth_published_variant_is_not_available_or_counted_even_before_archiving(): void
    {
        $block = $this->task();
        $variants = collect(range(0, 3))->map(fn ($position) => $this->variant($block, $position));
        $fourth = $variants->last();
        $this->assertNull($this->progress->publishedVariant($block, $fourth->id));
        $this->assertInvalid(fn () => $this->submit($block, $fourth));
        foreach ($variants as $variant) {
            LessonBlockAttempt::create([
                'user_id' => 5, 'lesson_block_id' => $block->id, 'lesson_block_variant_id' => $variant->id,
                'answer' => [], 'score' => 100, 'is_practice' => true, 'scored_at' => now('UTC'),
            ]);
        }
        $this->assertSame(2, $this->summary($block)['additional_variants']);
        $this->assertFalse($this->summary($block)['completed']);
    }

    public function test_extra_counts_are_per_block_then_summed_including_optional_blocks(): void
    {
        $firstBlock = $this->task();
        $secondBlock = $firstBlock->page->blocks()->create(['type' => 'reading', 'position' => 1, 'is_required' => false]);
        $this->submit($firstBlock, $this->variant($firstBlock, 0));
        $this->submit($secondBlock, $this->variant($secondBlock, 0));
        $this->assertSame(0, $this->summary($firstBlock)['additional_variants']);
        foreach ([$firstBlock, $secondBlock] as $block) $this->submit($block, $this->variant($block, 1));
        $summary = $this->summary($firstBlock);
        $this->assertSame(2, $summary['additional_variants']);
        $this->assertSame(1, $summary['total']);
        $this->assertSame(1, $summary['passed']);
    }

    public static function nonPracticeBlocks(): iterable
    {
        yield 'standalone reading' => ['reading', false, 'reading'];
        yield 'mismatched skill' => ['reading', true, 'listening'];
        yield 'grammar has three variants' => ['grammar', true, 'grammar'];
    }

    #[DataProvider('nonPracticeBlocks')]
    public function test_variant_limits_preserve_existing_rotation_and_completion(string $type, bool $linked, string $skill): void
    {
        $block = $this->task($type, $linked, $skill);
        $variants = collect(range(0, 4))->map(fn ($position) => $this->variant($block, $position));
        $variants->first()->forceFill(['practice_archived_at' => now('UTC')])->save();
        if ($type === 'grammar') $this->assertNull($this->progress->publishedVariant($block, $variants->first()->id));
        else $this->assertNotNull($this->progress->publishedVariant($block, $variants->first()->id));
        AppSetting::create(['key' => LessonProgressService::ROTATION_SETTING, 'value' => LessonProgressService::ROTATION_EVERY]);
        $selectedIds = [];
        foreach (range(1, 5) as $iteration) {
            $selected = $this->progress->selectedVariant($block, 5);
            $selectedIds[] = $selected->id;
            $other = $variants->first(fn ($variant) => $variant->id !== $selected->id);
            if ($type === 'grammar') {
                $this->assertInvalid(fn () => $this->progress->submitGrammarAttempt(5, $block, $other->id, ['esmu'], 2));
                $this->progress->submitGrammarAttempt(5, $block, $selected->id, ['esmu'], 2);
            } else {
                $this->assertInvalid(fn () => $this->submit($block, $other));
                $this->submit($block, $selected);
            }
        }
        $this->assertCount($type === 'grammar' ? 3 : 5, array_unique($selectedIds));
        $this->assertSame(0, $this->summary($block)['additional_variants']);
        $this->assertTrue($this->summary($block)['completed']);
    }

    public function test_standalone_writing_keeps_single_completion_semantics(): void
    {
        $block = $this->task('writing', false);
        $first = $this->variant($block, 0);
        $second = $this->variant($block, 1);
        $this->assertTrue($this->progress->completePracticeBlock(5, $block, $first->id, null, null, true));
        $this->assertFalse($this->progress->completePracticeBlock(5, $block, $second->id, 'Another answer', null, true));
        $this->assertSame(1, LessonBlockResponse::count());
        $this->assertSame(0, $this->summary($block)['additional_variants']);
    }
}
