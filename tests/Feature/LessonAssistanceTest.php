<?php

namespace Tests\Feature;

use App\Models\AppSetting;
use App\Models\LessonBlock;
use App\Models\LessonBlockAttempt;
use App\Models\LessonBlockCompletion;
use App\Models\LessonBlockProgress;
use App\Models\LessonPage;
use App\Models\User;
use App\Services\LessonProgressService;
use App\Support\LessonBinaryTask;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Testing\TestResponse;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use RuntimeException;
use Tests\TestCase;

class LessonAssistanceTest extends TestCase
{
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
        ] as $migration) {
            (require database_path("migrations/$migration.php"))->up();
        }
        DB::table('users')->insert([['id' => 5], ['id' => 9]]);
        AppSetting::create(['key' => LessonProgressService::ROTATION_SETTING, 'value' => LessonProgressService::ROTATION_FIXED]);
    }

    private function login(int $id = 5, bool $admin = false): void
    {
        $user = new class extends User
        {
            public bool $frontendAdmin = false;

            public function isFrontendAdmin(): bool
            {
                return $this->frontendAdmin;
            }
        };
        $user->id = $id;
        $user->frontendAdmin = $admin;
        $this->actingAs($user, 'sanctum');
    }

    private function task(string $type = 'reading', int $count = 5, bool $translations = true): array
    {
        $page = LessonPage::create([
            'title' => 'Assistance lesson', 'slug' => 'assistance-'.LessonPage::count(),
            'learn_lang' => 'lv', 'skill' => $type, 'status' => 'published', 'is_published' => true,
        ]);
        $block = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => $type, 'position' => 0]);
        $config = [
            'task_kind' => $type === 'reading' ? 'reading_binary' : 'listening',
            'questions' => array_map(fn ($index) => [
                'statement' => "Apgalvojums $index", 'correct' => $index % 2 === 0,
                'explanation' => "Объяснение $index",
            ], range(0, $count - 1)),
        ];
        if ($type === 'listening') {
            $config['transcript'] = 'Private listening transcript';
            $config['audio_url'] = '/audio/test.mp3';
        }
        if ($translations) {
            $config['assisted_questions'] = array_map(fn ($index) => "Русское утверждение $index", range(0, $count - 1));
        }
        $variant = $block->variants()->create(['position' => 0, 'is_published' => true, 'config' => $config]);

        return [$block, $variant];
    }

    private function assist(LessonBlock $block, int $variantId): TestResponse
    {
        return $this->postJson("/api/lessons/blocks/$block->id/assistance", ['variant_id' => $variantId]);
    }

    private function submit(LessonBlock $block, int $variantId, array $answers, array $extra = []): TestResponse
    {
        return $this->postJson("/api/lessons/blocks/$block->id/attempt", [
            'variant_id' => $variantId, 'answers' => $answers, 'cooldown_tier' => 2, ...$extra,
        ]);
    }

    private function show(LessonBlock $block, ?int $variantId = null): TestResponse
    {
        $query = $variantId !== null ? '?'.http_build_query(['variants' => [$block->id => $variantId]]) : '';

        return $this->getJson('/api/lessons/'.$block->page->slug.$query);
    }

    private function pending(LessonBlock $block, int $userId = 5): array
    {
        return LessonBlockProgress::where('user_id', $userId)->where('lesson_block_id', $block->id)
            ->first()?->assisted_variant_ids ?? [];
    }

    public static function assistedScores(): iterable
    {
        foreach (['reading', 'listening'] as $type) {
            foreach ([3, 5, 10] as $count) {
                yield "$type-$count-perfect" => [$type, $count, $count];
            }
            yield "$type-4-of-5" => [$type, 5, 4];
            yield "$type-2-of-3" => [$type, 3, 2];
        }
    }

    #[DataProvider('assistedScores')]
    public function test_server_state_controls_assisted_scores_and_history(string $type, int $count, int $correctCount): void
    {
        $this->login();
        [$block, $variant] = $this->task($type, $count);
        $config = $variant->config;
        $this->assist($block, $variant->id)->assertOk()->assertExactJson(['data' => [
            'questions' => $config['assisted_questions'], 'score_multiplier' => 0.8,
        ]])->assertHeader('Cache-Control', 'no-store, private');
        $this->assertSame([$variant->id], $this->pending($block));

        $reload = $this->show($block)->assertOk()
            ->assertJsonPath('data.blocks.0.config.assistance_available', true)
            ->assertJsonPath('data.blocks.0.config.assistance_active', true)
            ->assertJsonPath('data.blocks.0.config.assisted_questions', $config['assisted_questions'])
            ->assertJsonPath('data.blocks.0.config.questions.0.statement', $config['questions'][0]['statement'])
            ->assertJsonMissingPath('data.blocks.0.config.questions.0.correct')
            ->assertJsonMissingPath('data.blocks.0.config.questions.0.explanation')
            ->assertJsonMissingPath('data.blocks.0.progress.assisted_variant_ids');
        if ($type === 'listening') {
            $reload->assertJsonMissingPath('data.blocks.0.config.transcript');
        }
        $answers = array_column($config['questions'], 'correct');
        for ($index = $correctCount; $index < $count; $index++) {
            $answers[$index] = ! $answers[$index];
        }
        $score = intdiv($correctCount * 80, $count);
        $raw = intdiv($correctCount * 100, $count);
        // A forged normal request cannot undo the assistance already recorded by the server.
        $result = $this->submit($block, $variant->id, $answers, [
            'support_mode' => 'normal', 'assistance_active' => false, 'score_multiplier' => 1, 'raw_score' => 100,
        ])->assertOk()->assertJsonPath('data.score', $score)->assertJsonPath('data.raw_score', $raw)
            ->assertJsonPath('data.support_mode', 'translated_questions')->assertJsonPath('data.score_multiplier', 0.8)
            ->assertJsonPath('data.progress.best_score', $score)->assertJsonPath('data.is_practice', false)
            ->assertJsonPath('data.completed', $score >= 60)->assertJsonPath('data.progress.assistance_active', false);
        $attempt = LessonBlockAttempt::findOrFail($result->json('data.attempt_id'));
        $this->assertSame($score, $attempt->score);
        foreach (['answer', 'feedback'] as $field) {
            $this->assertSame('translated_questions', $attempt->{$field}['support_mode']);
            $this->assertSame(0.8, $attempt->{$field}['score_multiplier']);
            $this->assertSame($raw, $attempt->{$field}['raw_score']);
            $this->assertSame($score, $attempt->{$field}['score']);
        }
        $this->assertSame($answers, $attempt->answer['answers']);
        $this->assertSame([], $this->pending($block));
        $this->show($block)->assertOk()->assertJsonPath('data.blocks.0.config.assistance_active', false)
            ->assertJsonMissingPath('data.blocks.0.config.assisted_questions');
    }

    public function test_unauthenticated_users_cannot_start_assistance_or_read_lesson(): void
    {
        [$block, $variant] = $this->task();
        $this->assist($block, $variant->id)->assertUnauthorized();
        $this->show($block)->assertUnauthorized();
        $this->assertSame(0, LessonBlockProgress::count());
    }

    public function test_default_get_hides_translations_and_answer_keys_from_students_and_admins(): void
    {
        [$block, $variant] = $this->task();
        foreach ([false, true] as $admin) {
            $this->login(5, $admin);
            $this->show($block)->assertOk()->assertHeader('Cache-Control', 'no-store, private')
                ->assertJsonPath('data.blocks.0.config.assistance_available', true)
                ->assertJsonPath('data.blocks.0.config.assistance_active', false)
                ->assertJsonPath('data.blocks.0.config.questions.0.statement', $variant->config['questions'][0]['statement'])
                ->assertJsonMissingPath('data.blocks.0.config.assisted_questions')
                ->assertJsonMissingPath('data.blocks.0.config.questions.0.correct')
                ->assertJsonMissingPath('data.blocks.0.config.questions.0.explanation');
        }
        $this->assertSame(0, LessonBlockProgress::count());
    }

    public function test_normal_attempt_stays_100_and_cannot_enable_assistance_with_client_flags(): void
    {
        $this->login();
        [$block, $variant] = $this->task();
        $result = $this->submit($block, $variant->id, array_column($variant->config['questions'], 'correct'), [
            'support_mode' => 'translated_questions', 'assistance_active' => true, 'score_multiplier' => 0.8,
        ])->assertOk()->assertJsonPath('data.score', 100)->assertJsonPath('data.raw_score', 100)
            ->assertJsonPath('data.support_mode', 'normal')->assertJsonPath('data.score_multiplier', 1);
        $attempt = LessonBlockAttempt::findOrFail($result->json('data.attempt_id'));
        $this->assertSame('normal', $attempt->answer['support_mode']);
        $this->assertSame('normal', $attempt->feedback['support_mode']);
    }

    public function test_assistance_is_private_idempotent_and_does_not_create_attempts_or_cooldown(): void
    {
        $this->login();
        [$block, $variant] = $this->task();
        $this->assist($block, $variant->id)->assertOk();
        $this->assist($block, $variant->id)->assertOk();
        $progress = LessonBlockProgress::where('lesson_block_id', $block->id)->firstOrFail();
        $this->assertSame([$variant->id], $this->pending($block));
        $this->assertArrayNotHasKey('assisted_variant_ids', $progress->toArray());
        $this->assertNull($progress->best_score);
        $this->assertNull($progress->next_scored_at);
        $this->assertSame(0, LessonBlockAttempt::count());
        $this->assertSame(0, LessonBlockCompletion::count());
        $this->login(9);
        $this->show($block)->assertOk()->assertJsonPath('data.blocks.0.config.assistance_active', false)
            ->assertJsonMissingPath('data.blocks.0.config.assisted_questions');
        $this->submit($block, $variant->id, array_column($variant->config['questions'], 'correct'))
            ->assertOk()->assertJsonPath('data.score', 100)->assertJsonPath('data.support_mode', 'normal');
        $this->assertSame([$variant->id], $this->pending($block, 5));
    }

    public function test_endpoint_checks_assignment_publication_and_admin_override_ownership(): void
    {
        $this->login();
        [$block, $first] = $this->task();
        $second = $block->variants()->create(['position' => 1, 'is_published' => true, 'config' => $first->config]);
        $hidden = $block->variants()->create(['position' => 2, 'is_published' => false, 'config' => $first->config]);
        [, $foreign] = $this->task();
        $assigned = (new LessonProgressService)->selectedVariant($block, 5);
        $other = $assigned->id === $first->id ? $second : $first;
        $this->postJson("/api/lessons/blocks/$block->id/assistance", [])->assertUnprocessable()->assertJsonValidationErrors('variant_id');
        $this->assist($block, $other->id)->assertUnprocessable()->assertJsonValidationErrors('variant_id');
        $this->assertSame(0, LessonBlockProgress::count());
        foreach ([false, true] as $admin) {
            $this->login(5, $admin);
            foreach ([$hidden->id, $foreign->id, 999999] as $variantId) {
                $this->assist($block, $variantId)->assertUnprocessable()->assertJsonValidationErrors('variant_id');
            }
        }
        $this->assertSame(0, LessonBlockProgress::count());
        $this->assist($block, $other->id)->assertOk();
        $this->assertSame([$other->id], $this->pending($block));
    }

    public function test_pending_assistance_survives_variant_switching_and_clears_only_the_submitted_variant(): void
    {
        $this->login(5, true);
        [$block, $first] = $this->task();
        $config = $first->config;
        $config['assisted_questions'] = array_map(fn ($index) => "Другой перевод $index", range(0, 4));
        $second = $block->variants()->create(['position' => 1, 'is_published' => true, 'config' => $config]);
        $this->assist($block, $first->id)->assertOk();
        $this->show($block, $second->id)->assertOk()->assertJsonPath('data.blocks.0.config.assistance_active', false)
            ->assertJsonMissingPath('data.blocks.0.config.assisted_questions');
        $this->show($block, $first->id)->assertOk()->assertJsonPath('data.blocks.0.config.assistance_active', true)
            ->assertJsonPath('data.blocks.0.config.assisted_questions', $first->config['assisted_questions']);
        $this->assist($block, $second->id)->assertOk();
        $this->assertSame([$first->id, $second->id], $this->pending($block));
        $answers = array_column($config['questions'], 'correct');
        $this->submit($block, $first->id, $answers)->assertOk()->assertJsonPath('data.score', 80);
        $this->assertSame([$second->id], $this->pending($block));
        $this->show($block, $second->id)->assertOk()->assertJsonPath('data.blocks.0.config.assistance_active', true)
            ->assertJsonPath('data.blocks.0.config.assisted_questions', $config['assisted_questions']);
        $this->submit($block, $second->id, $answers)->assertOk()->assertJsonPath('data.score', 80)->assertJsonPath('data.is_practice', true);
        $this->assertSame([], $this->pending($block));
    }

    public function test_attempting_another_variant_does_not_clear_pending_assistance(): void
    {
        $this->login(5, true);
        [$block, $first] = $this->task();
        $second = $block->variants()->create(['position' => 1, 'is_published' => true, 'config' => $first->config]);
        $this->assist($block, $first->id)->assertOk();
        $answers = array_column($first->config['questions'], 'correct');
        $this->submit($block, $second->id, $answers)->assertOk()->assertJsonPath('data.score', 100)->assertJsonPath('data.support_mode', 'normal');
        $this->assertSame([$first->id], $this->pending($block));
        $this->submit($block, $first->id, $answers)->assertOk()->assertJsonPath('data.score', 80)->assertJsonPath('data.is_practice', true);
        $this->assertSame([], $this->pending($block));
    }

    public function test_cooldown_keeps_best_score_and_records_assisted_practice_before_normal_next_attempt(): void
    {
        $this->travelTo(now('UTC')->startOfSecond());
        $this->login();
        [$block, $variant] = $this->task();
        $answers = array_column($variant->config['questions'], 'correct');
        $this->assist($block, $variant->id)->assertOk();
        $first = $this->submit($block, $variant->id, $answers)->assertOk()->assertJsonPath('data.score', 80)
            ->assertJsonPath('data.rank', 'silver')->assertJsonPath('data.progress.best_score', 80)
            ->assertJsonPath('data.progress.next_scored_at', now('UTC')->addSeconds(10_800)->toIso8601String());
        $this->assist($block, $variant->id)->assertOk();
        $partial = $answers;
        $partial[0] = ! $partial[0];
        $practice = $this->submit($block, $variant->id, $partial)->assertOk()->assertJsonPath('data.score', 64)
            ->assertJsonPath('data.raw_score', 80)->assertJsonPath('data.is_practice', true)
            ->assertJsonPath('data.progress.best_score', 80);
        $this->assertSame($first->json('data.progress'), $practice->json('data.progress'));
        $this->assertSame([], $this->pending($block));
        $this->travel(10_800)->seconds();
        $this->submit($block, $variant->id, $answers)->assertOk()->assertJsonPath('data.score', 100)
            ->assertJsonPath('data.support_mode', 'normal')->assertJsonPath('data.progress.best_score', 100);
        $this->travel(10_800)->seconds();
        $this->assist($block, $variant->id)->assertOk();
        $this->submit($block, $variant->id, $partial)->assertOk()->assertJsonPath('data.score', 64)
            ->assertJsonPath('data.is_practice', false)->assertJsonPath('data.progress.best_score', 100);
        $this->assertSame([80, 64, 100, 64], LessonBlockAttempt::orderBy('id')->pluck('score')->all());
        $this->assertSame(1, LessonBlockCompletion::count());
        $this->travelBack();
    }

    public static function invalidTranslations(): iterable
    {
        yield 'null' => [null];
        yield 'scalar' => ['Перевод'];
        yield 'empty' => [[]];
        yield 'too short' => [['Один', 'Два']];
        yield 'too long' => [['Один', 'Два', 'Три', 'Четыре']];
        yield 'sparse' => [[0 => 'Один', 2 => 'Два', 3 => 'Три']];
        yield 'named' => [['a' => 'Один', 'b' => 'Два', 'c' => 'Три']];
        yield 'reordered' => [[1 => 'Два', 0 => 'Один', 2 => 'Три']];
        foreach ([null, false, 1, '', '   ', ['statement' => 'Один'], ['correct' => true]] as $index => $value) {
            yield "value-$index" => [['Один', $value, 'Три']];
        }
    }

    #[DataProvider('invalidTranslations')]
    public function test_invalid_translations_are_rejected_without_creating_or_consuming_pending_state(mixed $translations): void
    {
        $this->login();
        [$block, $variant] = $this->task('reading', 3);
        $valid = $variant->config;
        $invalid = $valid;
        $invalid['assisted_questions'] = $translations;
        try {
            LessonBinaryTask::validate($invalid);
            $this->fail('The importer validator must reject malformed translations.');
        } catch (ValidationException $exception) {
            $this->assertStringStartsWith('config.assisted_questions', array_key_first($exception->errors()));
        }
        $variant->update(['config' => $invalid]);
        $this->assist($block, $variant->id)->assertUnprocessable();
        $this->assertSame(0, LessonBlockProgress::count());
        $variant->update(['config' => $valid]);
        $this->assist($block, $variant->id)->assertOk();
        $before = LessonBlockProgress::where('lesson_block_id', $block->id)->firstOrFail()->getAttributes();
        $variant->update(['config' => $invalid]);
        $this->submit($block, $variant->id, array_column($valid['questions'], 'correct'))->assertUnprocessable();
        $this->assertSame($before, LessonBlockProgress::where('lesson_block_id', $block->id)->firstOrFail()->getAttributes());
        $this->assertSame([$variant->id], $this->pending($block));
        $this->assertSame(0, LessonBlockAttempt::count());
        $this->assertSame(0, LessonBlockCompletion::count());
    }

    public function test_missing_translations_and_non_binary_tasks_cannot_start_assistance(): void
    {
        $this->login();
        [$block, $variant] = $this->task('reading', 3, false);
        $this->show($block)->assertOk()->assertJsonPath('data.blocks.0.config.assistance_available', false);
        $this->assist($block, $variant->id)->assertUnprocessable()->assertJsonValidationErrors('config.assisted_questions');
        $block->update(['type' => 'writing']);
        $this->assist($block, $variant->id)->assertUnprocessable()->assertJsonValidationErrors('type');
        $this->assertSame(0, LessonBlockProgress::count());
    }

    public static function malformedConfigs(): iterable
    {
        yield 'scalar config' => ['invalid'];
        yield 'boolean config' => [false];
        yield 'missing questions' => [['assisted_questions' => ['Один', 'Два', 'Три']]];
    }

    #[DataProvider('malformedConfigs')]
    public function test_malformed_binary_config_returns_a_validation_error_without_pending_state(mixed $config): void
    {
        $this->login();
        [$block, $variant] = $this->task('reading', 3);
        $variant->update(['config' => $config]);
        $this->assist($block, $variant->id)->assertUnprocessable()->assertJsonValidationErrors('config.questions');
        $this->assertSame(0, LessonBlockProgress::count());
    }

    public function test_unpublished_pages_cannot_start_assistance(): void
    {
        $this->login();
        [$block, $variant] = $this->task();
        $block->page->update(['is_published' => false]);
        $this->assist($block, $variant->id)->assertNotFound();
        $block->page->update(['is_published' => true, 'status' => 'review']);
        DB::table('course_groups')->insert(['id' => 1]);
        $block->page->update(['course_group_id' => 1]);
        $this->assist($block, $variant->id)->assertNotFound();
        $this->assertSame(0, LessonBlockProgress::count());
    }

    public function test_invalid_answers_leave_assistance_active_until_a_valid_attempt(): void
    {
        $this->login();
        [$block, $variant] = $this->task('reading', 3);
        $this->assist($block, $variant->id)->assertOk();
        foreach ([[true, false], [0 => true, 2 => false, 3 => true], ['1', '0', '1']] as $answers) {
            $this->submit($block, $variant->id, $answers)->assertUnprocessable();
            $this->assertSame([$variant->id], $this->pending($block));
        }
        $this->assertSame(0, LessonBlockAttempt::count());
        $this->submit($block, $variant->id, array_column($variant->config['questions'], 'correct'))
            ->assertOk()->assertJsonPath('data.score', 80);
        $this->assertSame([], $this->pending($block));
    }

    public function test_missing_translations_after_activation_do_not_allow_a_normal_score(): void
    {
        $this->login();
        [$block, $variant] = $this->task();
        $this->assist($block, $variant->id)->assertOk();
        $config = $variant->config;
        unset($config['assisted_questions']);
        $variant->update(['config' => $config]);
        $this->submit($block, $variant->id, array_column($config['questions'], 'correct'))
            ->assertUnprocessable()->assertJsonValidationErrors('config.assisted_questions');
        $this->assertSame([$variant->id], $this->pending($block));
        $this->assertSame(0, LessonBlockAttempt::count());
    }

    public static function writeFailureStages(): iterable
    {
        yield 'attempt insert' => ['lesson_block_attempts'];
        yield 'completion insert' => ['lesson_block_completions'];
        yield 'pending state clear' => ['assisted_variant_ids'];
    }

    #[DataProvider('writeFailureStages')]
    public function test_write_failures_roll_back_attempt_progress_completion_and_assistance(string $stage): void
    {
        [$block, $variant] = $this->task();
        $service = new LessonProgressService;
        $service->startAssistance(5, $block, $variant->id);
        $before = LessonBlockProgress::where('lesson_block_id', $block->id)->firstOrFail()->getAttributes();
        $db = DB::connection();
        $db->beforeExecuting(function ($query, $bindings) use ($stage) {
            $fail = $stage === 'assisted_variant_ids'
                ? str_starts_with($query, 'update') && str_contains($query, 'assisted_variant_ids')
                : str_starts_with($query, 'insert') && str_contains($query, $stage);
            if ($fail) {
                throw new RuntimeException('Simulated assistance write failure');
            }
        });
        try {
            $service->submitBinaryAttempt(5, $block, $variant->id, array_column($variant->config['questions'], 'correct'), 2);
            $this->fail('A failed database write must abort the transaction.');
        } catch (RuntimeException $exception) {
            $this->assertSame('Simulated assistance write failure', $exception->getMessage());
        }
        $this->assertSame($before, LessonBlockProgress::where('lesson_block_id', $block->id)->firstOrFail()->getAttributes());
        $this->assertSame(0, LessonBlockAttempt::count());
        $this->assertSame(0, LessonBlockCompletion::count());
        $this->assertSame([$variant->id], $this->pending($block));
    }
}
