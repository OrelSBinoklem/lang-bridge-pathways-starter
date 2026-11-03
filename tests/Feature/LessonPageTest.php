<?php

namespace Tests\Feature;

use App\Filament\Pages\SuperSettings;
use App\Http\Controllers\Api\LessonController;
use App\Models\LessonBlock;
use App\Models\LessonBlockCompletion;
use App\Models\LessonBlockProgress;
use App\Models\LessonBlockResponse;
use App\Models\LessonBlockVariant;
use App\Models\LessonPage;
use App\Models\AppSetting;
use App\Models\User;
use App\Services\LessonProgressService;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Livewire\Livewire;
use Tests\TestCase;

class LessonPageTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('users', fn ($table) => $table->id());
        Schema::create('course_groups', fn ($table) => $table->id());
        (require database_path('migrations/2026_09_11_000002_create_lesson_pages_table.php'))->up();
        (require database_path('migrations/2026_09_11_000003_create_lesson_blocks_table.php'))->up();
        (require database_path('migrations/2026_09_11_000005_create_lesson_block_completions_table.php'))->up();
        (require database_path('migrations/2026_09_22_000001_add_course_skill_lesson_framework.php'))->up();
        (require database_path('migrations/2026_09_27_000001_create_grammar_topics_table.php'))->up();
        (require database_path('migrations/2026_10_13_000001_add_pending_assistance_to_lesson_block_progress.php'))->up();
        (require database_path('migrations/2026_09_29_000001_create_lesson_block_responses_table.php'))->up();
        (require database_path('migrations/2026_09_25_000001_create_app_settings_table.php'))->up();
        (require database_path('migrations/2026_10_01_000001_add_grammar_stage_references.php'))->up();
        DB::table('users')->insert([['id' => 5], ['id' => 9]]);
    }

    private function requestAs(int $userId): Request
    {
        $request = Request::create('/api/lessons/urok-1');
        $request->setUserResolver(fn () => (object) ['id' => $userId]);
        return $request;
    }

    private function controller(): LessonController
    {
        return new LessonController(new LessonProgressService);
    }

    public function test_published_page_returns_ordered_blocks_with_completion_flag(): void
    {
        $page = LessonPage::create(['title' => 'Урок 1', 'slug' => 'urok-1', 'learn_lang' => 'lv', 'is_published' => true]);
        LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'reading', 'position' => 1, 'config' => ['text' => 'Sveiki!']]);
        $words = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'words', 'position' => 0, 'config' => ['dictionary_id' => 20, 'category_id' => 1763]]);
        LessonBlockCompletion::create(['user_id' => 5, 'lesson_block_id' => $words->id, 'completed_at' => now()]);

        $data = $this->controller()->show($this->requestAs(5), 'urok-1')->getData(true)['data'];

        $this->assertSame('Урок 1', $data['title']);
        $this->assertCount(2, $data['blocks']);
        $this->assertSame('words', $data['blocks'][0]['type']);
        $this->assertSame(1763, $data['blocks'][0]['config']['category_id']);
        $this->assertTrue($data['blocks'][0]['completed']);
        $this->assertFalse($data['blocks'][1]['completed']);
    }

    public function test_legacy_pilot_description_is_hidden_but_editorial_descriptions_are_preserved(): void
    {
        $page = LessonPage::create(['title' => 'Lesson', 'slug' => 'description-test', 'learn_lang' => 'lv',
            'is_published' => true, 'description' => 'Тестовый каркас: пять вариантов каждого задания. Содержание и аудио будут редакционно заменены.']);
        $data = $this->controller()->show($this->requestAs(5), $page->slug)->getData(true)['data'];
        $this->assertNull($data['description']);

        $page->update(['description' => 'Read the dialogue and answer the questions.']);
        $data = $this->controller()->show($this->requestAs(5), $page->slug)->getData(true)['data'];
        $this->assertSame($page->description, $data['description']);
    }

    private function translationFixture(): array
    {
        DB::table('course_groups')->insert(['id' => 1]);
        $page = LessonPage::create(['title' => 'Translation', 'slug' => 'translation', 'course_group_id' => 1,
            'skill' => 'reading', 'level' => 'A1', 'learn_lang' => 'lv', 'status' => 'published', 'is_published' => true]);
        $block = $page->blocks()->create(['type' => 'reading', 'is_required' => true, 'position' => 0]);
        $variant = $block->variants()->create(['position' => 0, 'is_published' => true,
            'config' => ['task_kind' => 'lv_to_ru', 'source_text' => 'Mani sauc Anna.', 'reference_translation' => 'Меня зовут Анна.']]);
        return [$page, $block, $variant];
    }

    private function fakeTranslationGrade(int $score): void
    {
        $this->mock(\App\Services\TranslationAssessment::class, function ($mock) use ($score) {
            $mock->shouldReceive('assess')->once()->with('Mani sauc Anna.', 'Меня зовут Анна.', 'Меня зовут Анна.', 'A1')
                ->andReturn(['score' => $score, 'meaning' => min(80, $score), 'clarity' => max(0, $score - 80),
                    'feedback' => 'Проверка завершена.', 'model' => 'test', 'rubric' => 'lv-ru-meaning-v1']);
        });
    }

    public function test_translation_check_records_score_and_refreshes_private_page_progress(): void
    {
        [$page, $block, $variant] = $this->translationFixture();
        $this->fakeTranslationGrade(80);
        $request = $this->requestAs(5);
        $request->merge(['variant_id' => $variant->id, 'answer_text' => 'Меня зовут Анна.', 'submission_id' => (string) \Illuminate\Support\Str::uuid(), 'score' => 100]);
        $result = $this->controller()->checkTranslation($request, $block)->getData(true)['data'];
        $this->assertSame(80, $result['score']);
        $this->assertTrue($result['completed']);
        $this->assertFalse($result['is_practice']);
        $data = $this->controller()->show($this->requestAs(5), $page->slug)->getData(true)['data'];
        $this->assertSame(80, $data['blocks'][0]['translation_result']['score']);
        $this->assertSame(1, $data['practice_navigation'][1]['variant_ranks'][0]['passed']);
        $this->assertSame(80, $data['skill_progress']['best_score']);
        $other = $this->controller()->show($this->requestAs(9), $page->slug)->getData(true)['data'];
        $this->assertNull($other['blocks'][0]['translation_result']);
        $this->assertFalse($other['completed']);
        $this->assertArrayNotHasKey('reference_translation', $data['blocks'][0]['config']);
    }

    public function test_translation_http_retry_is_idempotent(): void
    {
        [, $block, $variant] = $this->translationFixture();
        $this->fakeTranslationGrade(60);
        $id = (string) \Illuminate\Support\Str::uuid();
        $service = app(LessonProgressService::class);
        $first = $service->submitTranslation(5, $block, $variant->id, 'Меня зовут Анна.', $id);
        $second = $service->submitTranslation(5, $block, $variant->id, 'Меня зовут Анна.', $id);
        $this->assertSame($first, $second);
        $this->assertSame(1, \App\Models\LessonBlockAttempt::count());
        $this->assertTrue($first['completed']);
    }

    public function test_failed_translation_does_not_complete_and_cooldown_attempt_cannot_improve_record(): void
    {
        [, $block, $variant] = $this->translationFixture();
        $this->fakeTranslationGrade(59);
        $service = app(LessonProgressService::class);
        $result = $service->submitTranslation(5, $block, $variant->id, 'Меня зовут Анна.', (string) \Illuminate\Support\Str::uuid());
        $this->assertFalse($result['completed']);
        $this->assertSame(0, LessonBlockCompletion::count());
        $this->fakeTranslationGrade(100);
        $result = $service->submitTranslation(5, $block, $variant->id, 'Меня зовут Анна.', (string) \Illuminate\Support\Str::uuid());
        $this->assertTrue($result['is_practice']);
        $this->assertFalse($result['completed']);
        $this->assertSame(59, LessonBlockProgress::first()->best_score);
        $this->assertSame(0, LessonBlockCompletion::count());
    }

    public function test_provider_failure_does_not_write_score_or_cooldown(): void
    {
        [, $block, $variant] = $this->translationFixture();
        $this->mock(\App\Services\TranslationAssessment::class, fn ($mock) => $mock->shouldReceive('assess')->once()->andThrow(new \RuntimeException('Unavailable')));
        try {
            app(LessonProgressService::class)->submitTranslation(5, $block, $variant->id, 'Перевод', (string) \Illuminate\Support\Str::uuid());
            $this->fail('Expected provider failure');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $error) {
            $this->assertSame(503, $error->getStatusCode());
        }
        $this->assertSame(0, \App\Models\LessonBlockAttempt::count());
        $this->assertSame(0, LessonBlockProgress::count());
        $this->assertSame(0, LessonBlockCompletion::count());
    }

    public function test_foreign_or_unpublished_translation_variant_is_rejected_before_grading(): void
    {
        [, $block, $variant] = $this->translationFixture();
        $variant->update(['is_published' => false]);
        $this->mock(\App\Services\TranslationAssessment::class, fn ($mock) => $mock->shouldNotReceive('assess'));
        $this->expectException(ValidationException::class);
        app(LessonProgressService::class)->submitTranslation(5, $block, $variant->id, 'Перевод', (string) \Illuminate\Support\Str::uuid());
    }

    public function test_translation_changed_during_grading_does_not_receive_a_stale_score(): void
    {
        [, $block, $variant] = $this->translationFixture();
        $this->mock(\App\Services\TranslationAssessment::class, function ($mock) use ($variant) {
            $mock->shouldReceive('assess')->once()->andReturnUsing(function () use ($variant) {
                $variant->update(['config' => ['task_kind' => 'lv_to_ru', 'source_text' => 'Uz redzēšanos!']]);
                return ['score' => 100, 'feedback' => 'Correct'];
            });
        });
        try {
            app(LessonProgressService::class)->submitTranslation(5, $block, $variant->id, 'Перевод', (string) \Illuminate\Support\Str::uuid());
            $this->fail('Expected stale-content rejection');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $error) {
            $this->assertSame(409, $error->getStatusCode());
        }
        $this->assertSame(0, \App\Models\LessonBlockAttempt::count());
        $this->assertSame(0, LessonBlockProgress::count());
    }

    public function test_parallel_translation_check_is_rejected_without_calling_the_model(): void
    {
        [, $block, $variant] = $this->translationFixture();
        $this->mock(\App\Services\TranslationAssessment::class, fn ($mock) => $mock->shouldNotReceive('assess'));
        $lock = \Illuminate\Support\Facades\Cache::lock("translation-check:5:{$block->id}", 150);
        $this->assertTrue($lock->get());
        try {
            app(LessonProgressService::class)->submitTranslation(5, $block, $variant->id, 'Перевод', (string) \Illuminate\Support\Str::uuid());
            $this->fail('Expected concurrent-request rejection');
        } catch (\Symfony\Component\HttpKernel\Exception\HttpException $error) {
            $this->assertSame(409, $error->getStatusCode());
        } finally {
            $lock->release();
        }
        $this->assertSame(0, \App\Models\LessonBlockAttempt::count());
    }

    public function test_translation_check_requires_authentication(): void
    {
        [, $block, $variant] = $this->translationFixture();
        $this->postJson("/api/lessons/blocks/{$block->id}/translation-check", [
            'variant_id' => $variant->id, 'answer_text' => 'Перевод', 'submission_id' => (string) \Illuminate\Support\Str::uuid(),
        ])->assertUnauthorized();
    }

    public function test_completion_is_scoped_per_user(): void
    {
        $page = LessonPage::create(['title' => 'Урок 1', 'slug' => 'urok-1', 'learn_lang' => 'lv', 'is_published' => true]);
        $words = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'words', 'position' => 0]);
        LessonBlockCompletion::create(['user_id' => 5, 'lesson_block_id' => $words->id, 'completed_at' => now()]);

        $data = $this->controller()->show($this->requestAs(9), 'urok-1')->getData(true)['data'];
        $this->assertFalse($data['blocks'][0]['completed']);
    }

    public function test_audit_link_is_admin_only_and_targets_the_current_block_variant(): void
    {
        $page = LessonPage::create(['title'=>'Audit link', 'slug'=>'audit-link', 'learn_lang'=>'lv', 'is_published'=>true]);
        $block = LessonBlock::create(['lesson_page_id'=>$page->id, 'type'=>'reading', 'position'=>0]);
        $variant = $block->variants()->create(['position'=>0, 'is_published'=>true, 'config'=>['text'=>'Sveiki!']]);
        $student = $this->controller()->show($this->requestAs(5), 'audit-link')->getData(true)['data']['blocks'][0];
        $this->assertNull($student['audit_url']);
        $admin = \Mockery::mock(User::class)->makePartial();
        $admin->id = 5;
        $admin->shouldReceive('isFrontendAdmin')->andReturn(true);
        $request = $this->requestAs(5);
        $request->setUserResolver(fn () => $admin);
        $data = $this->controller()->show($request, 'audit-link')->getData(true)['data']['blocks'][0];
        $this->assertStringContainsString('/admin/content-audit?', $data['audit_url']);
        parse_str(parse_url($data['audit_url'], PHP_URL_QUERY), $params);
        $this->assertSame(['lesson'=>(string)$page->id, 'block'=>(string)$block->id, 'variant'=>(string)$variant->id], $params);
    }

    public function test_listening_transcript_is_revealed_only_after_an_attempt(): void
    {
        $page = LessonPage::create(['title' => 'Аудирование', 'slug' => 'audio-a1', 'learn_lang' => 'lv', 'is_published' => true]);
        $block = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'listening', 'position' => 0]);
        $variant = LessonBlockVariant::create([
            'lesson_block_id' => $block->id,
            'title' => 'Диалог',
            'position' => 0,
            'is_published' => true,
            'config' => [
                'task_kind' => 'listening',
                'audio_url' => '/audio/test.mp3',
                'transcript' => 'A: Sveiki! B: Labdien!',
                'dialogue_segments' => [['speaker' => 'a', 'text' => 'Sveiki!']],
                'questions' => array_fill(0, 10, ['statement' => 'Sveiki?', 'correct' => true, 'explanation' => 'Jā.']),
            ],
        ]);

        $before = $this->controller()->show($this->requestAs(5), 'audio-a1')->getData(true)['data']['blocks'][0]['config'];
        $this->assertArrayNotHasKey('transcript', $before);
        $this->assertArrayNotHasKey('dialogue_segments', $before);
        $this->assertArrayNotHasKey('correct', $before['questions'][0]);

        $attempt = Request::create('/api/lessons/blocks/' . $block->id . '/attempt', 'POST', [
            'variant_id' => $variant->id,
            'answers' => array_fill(0, 10, true),
        ]);
        $attempt->setUserResolver(fn () => (object) ['id' => 5]);
        $result = $this->controller()->submitAttempt($attempt, $block)->getData(true)['data'];
        $this->assertSame('A: Sveiki! B: Labdien!', $result['transcript']);

        $after = $this->controller()->show($this->requestAs(5), 'audio-a1')->getData(true)['data']['blocks'][0]['config'];
        $this->assertSame('A: Sveiki! B: Labdien!', $after['transcript']);
    }

    public function test_unpublished_page_is_not_found(): void
    {
        LessonPage::create(['title' => 'Черновик', 'slug' => 'draft', 'learn_lang' => 'lv', 'is_published' => false]);
        $this->expectException(ModelNotFoundException::class);
        $this->controller()->show($this->requestAs(5), 'draft');
    }

    public function test_block_rejects_unknown_type(): void
    {
        $page = LessonPage::create(['title' => 'Урок 2', 'slug' => 'urok-2', 'learn_lang' => 'lv']);
        $this->expectException(ValidationException::class);
        LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'juggling', 'position' => 0]);
    }

    public function test_page_completed_requires_all_practice_blocks_done(): void
    {
        $page = LessonPage::create(['title' => 'Урок 4', 'slug' => 'urok-4', 'learn_lang' => 'lv', 'is_published' => true]);
        LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'reading', 'position' => 0]);
        $data = $this->controller()->show($this->requestAs(5), 'urok-4')->getData(true)['data'];
        $this->assertFalse($data['completed'], 'no practice blocks yet, page is not "completed"');

        $writing = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'writing', 'position' => 1]);
        $speaking = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'speaking', 'position' => 2]);
        LessonBlockCompletion::create(['user_id' => 5, 'lesson_block_id' => $writing->id, 'completed_at' => now()]);
        $data = $this->controller()->show($this->requestAs(5), 'urok-4')->getData(true)['data'];
        $this->assertFalse($data['completed'], 'speaking still pending');

        LessonBlockCompletion::create(['user_id' => 5, 'lesson_block_id' => $speaking->id, 'completed_at' => now()]);
        $data = $this->controller()->show($this->requestAs(5), 'urok-4')->getData(true)['data'];
        $this->assertTrue($data['completed']);
    }

    public function test_complete_block_records_completion_and_is_idempotent(): void
    {
        $page = LessonPage::create(['title' => 'Урок 3', 'slug' => 'urok-3', 'learn_lang' => 'lv', 'is_published' => true]);
        $speaking = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'speaking', 'position' => 0]);

        $this->mock(\App\Services\ProductivePracticeAssessment::class, fn ($mock) => $mock->shouldReceive('assess')->once()->andReturn(['score' => 80, 'feedback' => 'Верно.', 'recommendation' => 'Продолжай.']));
        $request = $this->requestAs(5); $request->merge(['answer_text' => 'Mani sauc Iryna.']);
        $first = $this->controller()->completeBlock($request, $speaking)->getData(true)['data'];
        $this->assertSame(80, $first['score']);
        $this->controller()->completeBlock($request, $speaking);

        $this->assertSame(1, LessonBlockCompletion::where('user_id', 5)->where('lesson_block_id', $speaking->id)->count());
    }

    public function test_binary_attempt_keeps_maximum_and_marks_cooldown_attempt_as_training(): void
    {
        $page = LessonPage::create([
            'title' => 'Навык', 'slug' => 'skill', 'learn_lang' => 'lv', 'is_published' => true,
        ]);
        $block = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'reading', 'position' => 0]);
        $questions = array_map(fn (int $index) => [
            'statement' => "Утверждение {$index}",
            'correct' => $index % 2 === 0,
            'explanation' => 'Пояснение.',
        ], range(1, 10));
        $correctAnswers = array_map(fn (array $question) => $question['correct'], $questions);
        $variant = LessonBlockVariant::create([
            'lesson_block_id' => $block->id,
            'title' => 'Вариант 1',
            'position' => 10,
            'config' => ['questions' => $questions],
        ]);

        $service = new LessonProgressService;
        $first = $service->submitBinaryAttempt(5, $block, $variant->id, $correctAnswers, 2);
        $second = $service->submitBinaryAttempt(5, $block, $variant->id, array_map(fn (bool $answer) => !$answer, $correctAnswers), 2);

        $this->assertSame(100, $first['score']);
        $this->assertFalse($first['is_practice']);
        $this->assertSame('diamond', $first['rank']);
        $this->assertTrue($second['is_practice']);
        $this->assertSame(100, LessonBlockProgress::where('user_id', 5)->where('lesson_block_id', $block->id)->value('best_score'));
        $this->assertSame(1, LessonBlockCompletion::where('user_id', 5)->where('lesson_block_id', $block->id)->count());
    }

    public function test_course_variant_hides_answers_and_rejects_an_unassigned_variant(): void
    {
        DB::table('course_groups')->insert(['id' => 1]);
        $page = LessonPage::create([
            'course_group_id' => 1,
            'skill' => 'reading',
            'status' => 'published',
            'title' => 'Навык',
            'slug' => 'assigned-variant',
            'learn_lang' => 'lv',
            'is_published' => true,
        ]);
        $block = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'reading', 'position' => 0]);
        $first = LessonBlockVariant::create([
            'lesson_block_id' => $block->id,
            'position' => 10,
            'config' => ['questions' => [['statement' => 'A', 'correct' => true, 'explanation' => 'Скрыто.']]],
        ]);
        $second = LessonBlockVariant::create([
            'lesson_block_id' => $block->id,
            'position' => 20,
            'config' => ['questions' => [['statement' => 'B', 'correct' => false, 'explanation' => 'Скрыто.']]],
        ]);

        $service = new LessonProgressService;
        $assigned = $service->selectedVariant($block, 5);
        $data = $this->controller()->show($this->requestAs(5), 'assigned-variant')->getData(true)['data'];

        $this->assertSame($assigned?->id, $data['blocks'][0]['variant_id']);
        $this->assertArrayNotHasKey('correct', $data['blocks'][0]['config']['questions'][0]);
        $this->assertArrayNotHasKey('explanation', $data['blocks'][0]['config']['questions'][0]);

        $other = $assigned?->id === $first->id ? $second : $first;
        $this->expectException(ValidationException::class);
        $service->submitBinaryAttempt(5, $block, $other->id, [true], 2);
    }

    public function test_variants_rotate_after_every_attempt_and_wrap_around(): void
    {
        $page = LessonPage::create(['title' => 'Навык', 'slug' => 'rotate', 'learn_lang' => 'lv', 'is_published' => true]);
        $block = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'reading', 'position' => 0]);
        for ($position = 0; $position < 3; $position++) {
            LessonBlockVariant::create([
                'lesson_block_id' => $block->id,
                'title' => 'Вариант '.($position + 1),
                'position' => $position,
                'config' => ['questions' => array_fill(0, 10, ['statement' => 'A', 'correct' => true])],
            ]);
        }

        $service = new LessonProgressService;
        $initial = $service->selectedVariant($block, 5);
        $this->assertSame($initial->id, $service->selectedVariant($block, 5)->id);

        $seen = [$initial->id];
        for ($attempt = 0; $attempt < 3; $attempt++) {
            $service->submitBinaryAttempt(5, $block, $seen[$attempt], array_fill(0, 10, true), 2);
            $seen[] = $service->selectedVariant($block, 5)->id;
        }

        $this->assertCount(3, array_unique(array_slice($seen, 0, 3)));
        $this->assertSame($initial->id, $seen[3]);
    }

    public function test_scored_mode_does_not_rotate_on_practice_and_fixed_mode_never_rotates(): void
    {
        $page = LessonPage::create(['title' => 'Навык', 'slug' => 'modes', 'learn_lang' => 'lv', 'is_published' => true]);
        $block = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'reading', 'position' => 0]);
        foreach ([0, 1] as $position) {
            LessonBlockVariant::create([
                'lesson_block_id' => $block->id,
                'position' => $position,
                'config' => ['questions' => array_fill(0, 10, ['statement' => 'A', 'correct' => true])],
            ]);
        }

        AppSetting::updateOrCreate(['key' => LessonProgressService::ROTATION_SETTING], ['value' => LessonProgressService::ROTATION_SCORED]);
        $service = new LessonProgressService;
        $first = $service->selectedVariant($block, 5);
        $service->submitBinaryAttempt(5, $block, $first->id, array_fill(0, 10, true), 2);
        $second = $service->selectedVariant($block, 5);
        $this->assertNotSame($first->id, $second->id);
        $practice = $service->submitBinaryAttempt(5, $block, $second->id, array_fill(0, 10, true), 2);
        $this->assertTrue($practice['is_practice']);
        $this->assertSame($second->id, $service->selectedVariant($block, 5)->id);

        AppSetting::updateOrCreate(['key' => LessonProgressService::ROTATION_SETTING], ['value' => LessonProgressService::ROTATION_FIXED]);
        $this->assertSame($first->id, $service->selectedVariant($block, 5)->id);
    }

    public function test_admin_can_select_published_variant_without_exposing_choices_to_students(): void
    {
        $page = LessonPage::create(['title' => 'Навык', 'slug' => 'admin-choice', 'learn_lang' => 'lv', 'is_published' => true]);
        $block = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'reading', 'position' => 0]);
        $variants = collect([0, 1])->map(fn ($position) => LessonBlockVariant::create([
            'lesson_block_id' => $block->id,
            'title' => 'Вариант '.($position + 1),
            'position' => $position,
            'config' => ['questions' => array_fill(0, 10, ['statement' => 'A', 'correct' => true])],
        ]));
        $assigned = (new LessonProgressService)->selectedVariant($block, 5);
        $other = $variants->firstWhere('id', '!=', $assigned->id);

        $studentRequest = Request::create('/api/lessons/admin-choice', 'GET', ['variants' => [$block->id => $other->id]]);
        $studentRequest->setUserResolver(fn () => (object) ['id' => 5]);
        $studentBlock = $this->controller()->show($studentRequest, 'admin-choice')->getData(true)['data']['blocks'][0];
        $this->assertSame($assigned->id, $studentBlock['variant_id']);
        $this->assertNull($studentBlock['variants']);

        $admin = new class extends User {
            public function isFrontendAdmin(): bool { return true; }
        };
        $admin->id = 5;
        $adminRequest = Request::create('/api/lessons/admin-choice', 'GET', ['variants' => [$block->id => $other->id]]);
        $adminRequest->setUserResolver(fn () => $admin);
        $adminBlock = $this->controller()->show($adminRequest, 'admin-choice')->getData(true)['data']['blocks'][0];
        $this->assertSame($other->id, $adminBlock['variant_id']);
        $this->assertSame($assigned->title, $adminBlock['assigned_variant_title']);
        $this->assertCount(2, $adminBlock['variants']);

        $result = (new LessonProgressService)->submitBinaryAttempt(5, $block, $other->id, array_fill(0, 10, true), 2, true);
        $this->assertSame($other->id, $result['variant_id']);

        $hidden = LessonBlockVariant::create([
            'lesson_block_id' => $block->id,
            'position' => 3,
            'is_published' => false,
            'config' => ['questions' => array_fill(0, 10, ['statement' => 'Secret', 'correct' => true])],
        ]);
        $this->expectException(ValidationException::class);
        (new LessonProgressService)->submitBinaryAttempt(5, $block, $hidden->id, array_fill(0, 10, true), 2, true);
    }

    public function test_super_settings_are_restricted_and_save_rotation_mode(): void
    {
        $admin = new class extends User {
            public function isSuperAdmin(): bool { return false; }
            public function hasAnyRole(...$roles): bool { return true; }
        };
        $admin->id = 5;
        Auth::setUser($admin);
        $this->assertFalse(SuperSettings::canAccess());
        Livewire::test(SuperSettings::class)->assertStatus(403);

        $superAdmin = new class extends User {
            public function isSuperAdmin(): bool { return true; }
            public function hasAnyRole(...$roles): bool { return true; }
        };
        $superAdmin->id = 9;
        Auth::setUser($superAdmin);
        $this->assertTrue(SuperSettings::canAccess());

        Livewire::test(SuperSettings::class)
            ->set('data.lesson_variant_rotation_mode', LessonProgressService::ROTATION_FIXED)
            ->call('save')
            ->assertHasNoErrors();

        $this->assertSame(LessonProgressService::ROTATION_FIXED, (new LessonProgressService)->rotationMode());
    }

    public function test_translation_response_is_saved_privately_and_rotates_without_inventing_a_score(): void
    {
        $page = LessonPage::create(['title' => 'Чтение', 'slug' => 'translate', 'learn_lang' => 'lv', 'is_published' => true]);
        $block = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'reading', 'position' => 0]);
        foreach ([0, 1] as $position) {
            LessonBlockVariant::create(['lesson_block_id' => $block->id, 'position' => $position,
                'config' => ['task_kind' => 'lv_to_ru', 'source_text' => 'Sveiki!']]);
        }
        $service = new LessonProgressService;
        $assigned = $service->selectedVariant($block, 5);
        $request = Request::create('/api/lessons/blocks/'.$block->id.'/response', 'POST', [
            'variant_id' => $assigned->id, 'answer_text' => 'Привет!',
        ]);
        $request->setUserResolver(fn () => (object) ['id' => 5]);
        $this->controller()->submitResponse($request, $block);

        $saved = LessonBlockResponse::sole();
        $this->assertSame('Привет!', $saved->answer_text);
        $this->assertSame('submitted', $saved->status);
        $this->assertNotSame($assigned->id, $service->selectedVariant($block, 5)->id);
        $this->assertSame('Привет!', $this->controller()->show($this->requestAs(5), 'translate')->getData(true)['data']['blocks'][0]['last_response']['answer_text']);
        $this->assertNull($this->controller()->show($this->requestAs(9), 'translate')->getData(true)['data']['blocks'][0]['last_response']);
        $this->assertDatabaseMissing('lesson_block_completions', ['user_id' => 5, 'lesson_block_id' => $block->id]);
        $this->assertDatabaseMissing('lesson_block_progress', ['user_id' => 5, 'lesson_block_id' => $block->id]);
    }

    public function test_tutor_completion_saves_ungraded_evidence_once(): void
    {
        $page = LessonPage::create(['title' => 'Письмо', 'slug' => 'writing', 'learn_lang' => 'lv', 'is_published' => true]);
        $block = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'writing', 'position' => 0]);
        $service = new LessonProgressService;
        $this->assertTrue($service->completePracticeBlock(5, $block, null, 'Es dzīvoju Rīgā.', 'Смысл передан.'));
        $this->assertFalse($service->completePracticeBlock(5, $block, null, 'Other answer'));

        $this->assertSame(1, LessonBlockCompletion::where('user_id', 5)->where('lesson_block_id', $block->id)->count());
        $this->assertSame(1, LessonBlockResponse::where('user_id', 5)->where('lesson_block_id', $block->id)->count());
        $this->assertSame('Es dzīvoju Rīgā.', LessonBlockResponse::sole()->answer_text);
        $summary = $service->summariesForPages(5, collect([$page->load('blocks')]))[$page->id];
        $this->assertTrue($summary['completed']);
        $this->assertNull($summary['best_score']);
        $this->assertNull($summary['best_rank']);
    }
}
