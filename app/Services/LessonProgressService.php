<?php

namespace App\Services;

use App\Models\AppSetting;
use App\Models\LessonBlock;
use App\Models\LessonBlockAttempt;
use App\Models\LessonBlockCompletion;
use App\Models\LessonBlockProgress;
use App\Models\LessonBlockResponse;
use App\Models\LessonBlockVariant;
use App\Models\LessonGrammarItemProgress;
use App\Support\LessonBinaryTask;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class LessonProgressService
{
    private const COOLDOWN_SECONDS = [0 => 72_000, 2 => 10_800];

    public const ROTATION_SETTING = 'lesson_variant_rotation_mode';
    public const ROTATION_FIXED = 'fixed';
    public const ROTATION_SCORED = 'scored';
    public const ROTATION_EVERY = 'every';

    public static function rotationModes(): array
    {
        return [
            self::ROTATION_EVERY => 'После каждой попытки, включая тренировочные',
            self::ROTATION_SCORED => 'После зачётной попытки',
            self::ROTATION_FIXED => 'Закрепить вариант за учеником',
        ];
    }

    public function rotationMode(): string
    {
        $mode = AppSetting::query()->where('key', self::ROTATION_SETTING)->value('value');

        return array_key_exists($mode, self::rotationModes()) ? $mode : self::ROTATION_EVERY;
    }

    public static function rankFor(?int $score): ?string
    {
        if ($score === null || $score < 60) return null;
        if ($score === 100) return 'diamond';
        if ($score >= 90) return 'gold';
        if ($score >= 80) return 'silver';
        return 'bronze';
    }

    public static function rankLabel(?string $rank): ?string
    {
        return match ($rank) {
            'bronze' => 'Бронза',
            'silver' => 'Серебро',
            'gold' => 'Золото',
            'diamond' => 'Бриллиант',
            default => null,
        };
    }

    public function selectedVariant(LessonBlock $block, int $userId): ?LessonBlockVariant
    {
        $block = $block->trainingBlock();
        if (!$block) return null;
        $practiceVariants = app(CoursePracticeVariants::class);
        if ($practiceVariants->isCoursePractice($block)) {
            return $practiceVariants->available($block)->first();
        }
        $variants = $block->type === 'grammar' ? $practiceVariants->available($block) : ($block->relationLoaded('variants')
            ? $block->variants->where('is_published', true)->values()
            : $block->variants()->where('is_published', true)->orderBy('position')->get());

        if ($variants->isEmpty()) return null;

        // Keep legacy alphabet variants for attempt history, but use one authored task per block.
        if ($block->type === 'grammar' && ($this->isAlphabetBlock($block) || ($variants->first()?->config['task_kind'] ?? null) === 'grammar_items')) {
            return $variants->first();
        }

        $offset = match ($this->rotationMode()) {
            self::ROTATION_EVERY => LessonBlockAttempt::query()
                ->where('user_id', $userId)->where('lesson_block_id', $block->id)->count()
                + LessonBlockResponse::query()->where('user_id', $userId)->where('lesson_block_id', $block->id)->count(),
            self::ROTATION_SCORED => LessonBlockAttempt::query()
                ->where('user_id', $userId)->where('lesson_block_id', $block->id)->where('is_practice', false)->count()
                + LessonBlockResponse::query()->where('user_id', $userId)->where('lesson_block_id', $block->id)->where('status', 'accepted')->count(),
            default => 0,
        };
        $index = (((int) sprintf('%u', crc32("{$userId}:{$block->id}"))) + $offset) % $variants->count();
        return $variants->get($index);
    }

    public function publishedVariant(LessonBlock $block, int $variantId): ?LessonBlockVariant
    {
        $block = $block->trainingBlock();
        if (!$block) return null;
        $practiceVariants = app(CoursePracticeVariants::class);
        if ($practiceVariants->isCoursePractice($block) || $block->type === 'grammar') {
            return $practiceVariants->available($block)->firstWhere('id', $variantId);
        }
        return $block->variants()->where('is_published', true)->whereKey($variantId)->first();
    }

    public function progressFor(int $userId, LessonBlock $block, ?int $variantId = null): array
    {
        $block = $block->trainingBlock();
        if (!$block) return $this->progressPayload(null);
        $progress = LessonBlockProgress::query()
            ->where('user_id', $userId)
            ->where('lesson_block_id', $block->id)
            ->first();

        return $this->progressPayload($progress, $variantId);
    }

    /** @param Collection<int, \App\Models\LessonPage> $pages
     *  @return array<int, array{completed: bool, passed: int, total: int, best_score: ?int, best_rank: ?string, additional_variants: int, practice_rounds?: list<array{passed: int, total: int}>}>
     */
    public function summariesForPages(int $userId, Collection $pages): array
    {
        foreach ($pages as $page) $page->loadMissing('blocks.sourceBlock.page', 'blocks.page', 'blocks.variants');
        $blockIds = $pages->flatMap(fn ($page) => $page->blocks->map(fn ($block) => $block->trainingBlock()?->id))->filter()->unique()->values();
        if ($blockIds->isEmpty()) return [];

        $completed = LessonBlockCompletion::query()->where('user_id', $userId)
            ->whereIn('lesson_block_id', $blockIds)->pluck('lesson_block_id')->flip();
        $progress = LessonBlockProgress::query()->where('user_id', $userId)
            ->whereIn('lesson_block_id', $blockIds)->get()->keyBy('lesson_block_id');
        $additionalVariants = $this->additionalVariantsForBlocks($userId, $pages->flatMap(fn ($page) => $page->blocks));

        $summaries = [];
        foreach ($pages as $page) {
            $visible = $page->blocks->filter(fn ($block) => !$block->isRetiredCoursePractice());
            $required = $visible->where('is_required', true);
            $total = $required->count();
            $completedRequired = $required->filter(fn ($block) => $completed->has($block->trainingBlock()?->id));
            $passed = $completedRequired->count();
            $requiredScores = $required->map(fn ($block) => $progress->get($block->trainingBlock()?->id)?->best_score);
            $allScores = $visible->map(fn ($block) => $progress->get($block->trainingBlock()?->id)?->best_score);
            $fullyScored = $total > 0 && $passed === $total && $requiredScores->every(fn ($score) => $score !== null);
            $hasScore = $allScores->contains(fn ($value) => $value !== null);
            $score = $allScores->isNotEmpty() && ($page->skill === 'grammar' || $hasScore)
                ? (int) round($allScores->sum(fn ($value) => $value ?? 0) / $allScores->count())
                : null;
            $rank = $fullyScored ? self::rankFor($score) : null;
            $summaries[$page->id] = [
                'completed' => $total > 0 && $passed === $total,
                'passed' => $passed,
                'total' => $total,
                'best_score' => $score,
                'best_rank' => $rank,
                'additional_variants' => $page->blocks->unique('id')->sum(fn ($block) => $additionalVariants[$block->id] ?? 0),
            ];
            if ($page->course_group_id !== null && in_array($page->skill, CoursePracticeVariants::SKILLS, true)) {
                $summaries[$page->id]['practice_rounds'] = [
                    ['passed' => $passed, 'total' => $total],
                    ...array_map(fn ($extra) => [
                        'passed' => $completedRequired->filter(fn ($block) => ($additionalVariants[$block->id] ?? 0) >= $extra)->count(),
                        'total' => $total,
                    ], [1, 2]),
                ];
            }
        }

        return $summaries;
    }

    /** @return array<int, int> */
    private function additionalVariantsForBlocks(int $userId, Collection $blocks): array
    {
        $practiceVariants = app(CoursePracticeVariants::class);
        $blocks = $blocks->unique('id')->filter(fn ($block) => $practiceVariants->isCoursePractice($block));
        if ($blocks->isEmpty()) return [];

        (new EloquentCollection($blocks->all()))->loadMissing('variants');
        $available = $blocks->mapWithKeys(function ($block) use ($practiceVariants) {
            return [$block->id => $practiceVariants->available($block)->pluck('id')];
        });
        $attempts = LessonBlockAttempt::query()->where('user_id', $userId)
            ->whereIn('lesson_block_id', $blocks->whereIn('type', ['listening', 'reading'])->pluck('id'))
            ->where('score', '>=', 60)->whereNotNull('lesson_block_variant_id')
            ->select('lesson_block_id', 'lesson_block_variant_id')->distinct()->get();
        $responses = LessonBlockResponse::query()->where('user_id', $userId)
            ->whereIn('lesson_block_id', $blocks->whereIn('type', ['writing', 'speaking'])->pluck('id'))
            ->where('status', 'accepted')->whereNotNull('lesson_block_variant_id')
            ->select('lesson_block_id', 'lesson_block_variant_id')->distinct()->get();

        // Practice successes add variety, but never grant a scored completion or improve the best score.
        return $attempts->toBase()->concat($responses)->groupBy('lesson_block_id')
            ->map(fn ($successes, $blockId) => max(0, $successes->pluck('lesson_block_variant_id')
                ->unique()->intersect($available->get($blockId))->count() - 1))->all();
    }

    public function submitTranslation(int $userId, LessonBlock $block, int $variantId, string $answer, string $submissionId, bool $allowVariantOverride = false): array
    {
        if ($block->type !== 'reading' || trim($answer) === '') {
            throw ValidationException::withMessages(['answer_text' => 'Введите перевод для проверки.']);
        }
        $variant = $this->variantForAttempt($block, $userId, $variantId, $allowVariantOverride);
        $config = $variant?->config ?? [];
        if (($config['task_kind'] ?? null) !== 'lv_to_ru' || !is_string($config['source_text'] ?? null) || trim($config['source_text']) === '') {
            throw ValidationException::withMessages(['type' => 'Это не опубликованное задание на перевод.']);
        }
        $answer = trim($answer);
        $lock = Cache::lock("translation-check:{$userId}:{$block->id}", 150);
        if (!$lock->get()) abort(409, 'Перевод уже проверяется. Подождите и повторите запрос.');
        try {
            $existing = LessonBlockAttempt::where('user_id', $userId)->where('lesson_block_id', $block->id)
                ->where('answer->submission_id', $submissionId)->first();
            if ($existing) {
                if ($existing->lesson_block_variant_id !== $variantId || ($existing->answer['answer_text'] ?? null) !== $answer) {
                    throw ValidationException::withMessages(['submission_id' => 'Эта проверка относится к другому ответу.']);
                }
                return $this->translationResult($existing);
            }
            try {
                $grade = app(TranslationAssessment::class)->assess($config['source_text'], $answer,
                    is_string($config['reference_translation'] ?? null) ? $config['reference_translation'] : '', $block->page->level ?? 'A1');
            } catch (\Throwable $error) {
                Log::warning('Translation assessment failed', ['block_id' => $block->id, 'variant_id' => $variantId, 'exception' => get_class($error)]);
                if ($error instanceof \App\Services\Credits\CreditException) throw $error;
                abort(503, 'Не удалось проверить перевод. Ответ не оценён, попробуйте ещё раз.');
            }
            // The provider call must not hold database row locks. Recheck publication and content afterwards.
            return DB::transaction(function () use ($userId, $block, $variantId, $answer, $submissionId, $config, $grade, $allowVariantOverride) {
                $current = $block->fresh(['page', 'variants']);
                abort_unless($current?->page?->is_published && ($current->page->course_group_id === null || $current->page->status === 'published'), 404);
                $variant = $this->variantForAttempt($current, $userId, $variantId, $allowVariantOverride);
                if ($variant?->config !== $config) abort(409, 'Задание изменилось. Обновите страницу перед проверкой.');
                $progress = LessonBlockProgress::query()->firstOrCreate(['user_id' => $userId, 'lesson_block_id' => $block->id]);
                $progress = LessonBlockProgress::whereKey($progress->id)->lockForUpdate()->firstOrFail();
                $now = now('UTC');
                $practice = $progress->next_scored_at?->isFuture() ?? false;
                $score = $grade['score'];
                $attempt = LessonBlockAttempt::create([
                    'user_id' => $userId, 'lesson_block_id' => $block->id, 'lesson_block_variant_id' => $variantId,
                    'answer' => ['answer_text' => $answer, 'submission_id' => $submissionId],
                    'feedback' => ['translation' => $grade], 'score' => $score, 'rank' => self::rankFor($score),
                    'is_practice' => $practice, 'cooldown_tier' => 0, 'scored_at' => $now,
                ]);
                if (!$practice) {
                    $best = max($progress->best_score ?? 0, $score);
                    $progress->fill(['best_score' => $best, 'best_rank' => self::rankFor($best), 'cooldown_tier' => 0,
                        'last_scored_at' => $now, 'next_scored_at' => $now->copy()->addSeconds(self::COOLDOWN_SECONDS[0])])->save();
                    if ($score >= 60) LessonBlockCompletion::firstOrCreate(
                        ['user_id' => $userId, 'lesson_block_id' => $block->id], ['completed_at' => $now]);
                }
                return $this->translationResult($attempt);
            });
        } finally {
            $lock->release();
        }
    }

    public function translationResult(LessonBlockAttempt $attempt): array
    {
        return [
            'attempt_id' => $attempt->id, 'variant_id' => $attempt->lesson_block_variant_id,
            'answer_text' => $attempt->answer['answer_text'] ?? '', 'score' => $attempt->score,
            'feedback' => $attempt->feedback['translation']['feedback'] ?? '',
            'is_practice' => $attempt->is_practice, 'completed' => !$attempt->is_practice && $attempt->score >= 60,
        ];
    }

    public function submitFreeResponse(int $userId, LessonBlock $block, ?int $variantId, string $answer, bool $allowVariantOverride = false): LessonBlockResponse
    {
        if ($block->type !== 'reading') {
            throw ValidationException::withMessages(['type' => 'Свободный ответ здесь пока не принимается.']);
        }

        return DB::transaction(function () use ($userId, $block, $variantId, $answer, $allowVariantOverride) {
            $variant = $this->variantForAttempt($block, $userId, $variantId, $allowVariantOverride);
            if (($variant?->config ?? $block->config ?? [])['task_kind'] !== 'lv_to_ru') {
                throw ValidationException::withMessages(['type' => 'Это не задание на перевод.']);
            }

            return LessonBlockResponse::create([
                'user_id' => $userId,
                'lesson_block_id' => $block->id,
                'lesson_block_variant_id' => $variant?->id,
                'answer_text' => trim($answer),
                'status' => 'submitted',
            ]);
        });
    }

    public function assessPracticeBlock(int $userId, LessonBlock $block, ?int $variantId, string $answer, bool $allowVariantOverride = false): array
    {
        abort_unless(in_array($block->type, ['writing', 'speaking'], true) && !$block->isRetiredCoursePractice(), 422);
        if (trim($answer) === '') throw ValidationException::withMessages(['answer_text' => 'Нужен самостоятельный ответ ученика.']);
        $variant = $this->variantForAttempt($block, $userId, $variantId, $allowVariantOverride);
        $config = $variant?->config ?? $block->config ?? [];
        $answer = trim($answer);
        $hash = hash('sha256', json_encode(['productive-cefr-v1', $variantId, $config, $answer, $block->page->level, $block->page->learn_lang], JSON_THROW_ON_ERROR));
        $lock = Cache::lock("productive-check:{$userId}:{$block->id}", 180);
        abort_unless($lock->get(), 409, 'Ответ уже проверяется.');
        try {
            $existing = LessonBlockAttempt::where('user_id', $userId)->where('lesson_block_id', $block->id)
                ->where('answer->assessment_hash', $hash)->first();
            if ($existing) return $this->productiveResult($existing);
            try {
                $grade = app(\App\Services\Credits\CreditContext::class)->run($userId,
                    fn () => app(ProductivePracticeAssessment::class)->assess($config, $answer, $block->type, $block->page->level ?? 'A1', $block->page->learn_lang ?? 'lv'),
                    'practice_check', null, ['type' => 'lesson_block', 'id' => $block->id]);
            } catch (\Throwable $error) {
                Log::warning('Productive practice assessment failed', ['block_id' => $block->id, 'exception' => get_class($error)]);
                if ($error instanceof \App\Services\Credits\CreditException) throw $error;
                abort(503, 'Ответ не оценён: проверка недоступна. Попробуйте ещё раз.');
            }
            return DB::transaction(function () use ($userId, $block, $variantId, $answer, $hash, $config, $grade, $allowVariantOverride) {
                $current = $block->fresh(['page', 'variants']);
                abort_unless($current?->page?->is_published && ($current->page->course_group_id === null || $current->page->status === 'published'), 404);
                $variant = $this->variantForAttempt($current, $userId, $variantId, $allowVariantOverride);
                abort_if(($variant?->config ?? $current->config ?? []) !== $config, 409, 'Задание изменилось. Обновите страницу.');
                $progress = LessonBlockProgress::firstOrCreate(['user_id' => $userId, 'lesson_block_id' => $block->id]);
                $progress = LessonBlockProgress::whereKey($progress->id)->lockForUpdate()->firstOrFail();
                $score = $grade['score'];
                $attempt = LessonBlockAttempt::create(['user_id' => $userId, 'lesson_block_id' => $block->id,
                    'lesson_block_variant_id' => $variantId, 'answer' => ['answer_text' => $answer, 'assessment_hash' => $hash],
                    'feedback' => ['productive' => $grade], 'score' => $score, 'rank' => self::rankFor($score),
                    'is_practice' => false, 'cooldown_tier' => 0, 'scored_at' => now('UTC')]);
                $best = max($progress->best_score ?? 0, $score);
                $progress->fill(['best_score' => $best, 'best_rank' => self::rankFor($best), 'last_scored_at' => now('UTC')])->save();
                if ($score >= 60) {
                    LessonBlockCompletion::firstOrCreate(['user_id' => $userId, 'lesson_block_id' => $block->id], ['completed_at' => now('UTC')]);
                    LessonBlockResponse::create(['user_id' => $userId, 'lesson_block_id' => $block->id, 'lesson_block_variant_id' => $variantId,
                        'answer_text' => $answer, 'status' => 'accepted', 'feedback' => $grade['feedback'], 'accepted_at' => now('UTC')]);
                }
                return $this->productiveResult($attempt);
            });
        } finally { $lock->release(); }
    }

    public function productiveResult(LessonBlockAttempt $attempt): array
    {
        $target = (int) (\App\Models\User::find($attempt->user_id)?->course_target_score ?? 60);
        $target = in_array($target, [60, 80, 90, 100], true) ? $target : 60;
        return ['score' => $attempt->score, 'rank_label' => self::rankLabel(self::rankFor($attempt->score)),
            'completed' => $attempt->score >= 60, 'target_score' => $target, 'target_reached' => $attempt->score >= $target,
            'can_improve' => $attempt->score < 100, 'feedback' => $attempt->feedback['productive']['feedback'] ?? '',
            'recommendation' => $attempt->feedback['productive']['recommendation'] ?? '', 'attempt_id' => $attempt->id];
    }

    public function completePracticeBlock(int $userId, LessonBlock $block, ?int $variantId = null, ?string $answer = null, ?string $feedback = null, bool $allowVariantOverride = false): bool
    {
        abort_if($block->isRetiredCoursePractice(), 404);
        if (!in_array($block->type, ['writing', 'speaking'], true)) {
            throw ValidationException::withMessages(['type' => 'Этот блок нельзя зачесть без проверки ответов.']);
        }

        return DB::transaction(function () use ($userId, $block, $variantId, $answer, $feedback, $allowVariantOverride) {
            $variant = $variantId !== null
                ? $this->variantForAttempt($block, $userId, $variantId, $allowVariantOverride)
                : $this->selectedVariant($block, $userId);
            $completion = LessonBlockCompletion::firstOrCreate(
                ['user_id' => $userId, 'lesson_block_id' => $block->id],
                ['completed_at' => now('UTC')],
            );
            if (!$completion->wasRecentlyCreated) {
                if (!$variant || !app(CoursePracticeVariants::class)->isCoursePractice($block)) return false;

                // Serialize callbacks for this learner/block before checking for a variant response.
                LessonBlockCompletion::query()->whereKey($completion->id)->lockForUpdate()->first();
                if (LessonBlockResponse::query()->where('user_id', $userId)->where('lesson_block_id', $block->id)
                    ->where('lesson_block_variant_id', $variant->id)->where('status', 'accepted')->lockForUpdate()->first()) return false;
                if (trim($answer ?? '') === '') {
                    throw ValidationException::withMessages(['answer_text' => 'Для зачёта дополнительного варианта нужен ответ.']);
                }
            }

            LessonBlockResponse::create([
                'user_id' => $userId,
                'lesson_block_id' => $block->id,
                'lesson_block_variant_id' => $variant?->id,
                'answer_text' => $answer !== null ? trim($answer) : null,
                'status' => 'accepted',
                'feedback' => $feedback ? trim($feedback) : null,
                'accepted_at' => now('UTC'),
            ]);

            return true;
        });
    }

    /** @return array{questions: list<string>, score_multiplier: float} */
    public function startAssistance(int $userId, LessonBlock $block, int $variantId, bool $allowVariantOverride = false): array
    {
        if (!in_array($block->type, ['listening', 'reading'], true)) {
            throw ValidationException::withMessages(['type' => 'Помощь доступна только для утверждений чтения и аудирования.']);
        }

        return DB::transaction(function () use ($userId, $block, $variantId, $allowVariantOverride) {
            $progress = LessonBlockProgress::query()->lockForUpdate()->firstOrCreate([
                'user_id' => $userId,
                'lesson_block_id' => $block->id,
            ]);
            $variant = $this->variantForAttempt($block, $userId, $variantId, $allowVariantOverride);
            $questions = LessonBinaryTask::assistedQuestions($variant->config ?? []);
            if (!$progress->hasPendingAssistance($variant->id)) {
                $progress->forceFill([
                    'assisted_variant_ids' => [...($progress->assisted_variant_ids ?? []), $variant->id],
                ])->save();
            }

            return ['questions' => $questions, 'score_multiplier' => 0.8];
        });
    }

    /** @return array<string, mixed> */
    public function submitBinaryAttempt(int $userId, LessonBlock $block, ?int $variantId, array $answers, int $cooldownTier, bool $allowVariantOverride = false): array
    {
        if (!in_array($block->type, ['listening', 'reading'], true)) {
            throw ValidationException::withMessages(['type' => 'Этот тип задания пока не проверяется автоматически.']);
        }

        return DB::transaction(function () use ($userId, $block, $variantId, $answers, $cooldownTier, $allowVariantOverride) {
            $progress = LessonBlockProgress::query()->lockForUpdate()->firstOrCreate([
                'user_id' => $userId,
                'lesson_block_id' => $block->id,
            ]);
            $variant = $this->variantForAttempt($block, $userId, $variantId, $allowVariantOverride);
            $config = $variant?->config ?? $block->config ?? [];
            LessonBinaryTask::validate($config);
            $questions = $config['questions'];
            LessonBinaryTask::validateAnswers($answers, count($questions));
            $assisted = $progress->hasPendingAssistance($variant?->id);
            if ($assisted) LessonBinaryTask::assistedQuestions($config);

            $checked = [];
            foreach ($questions as $index => $question) {
                $correct = $question['correct'];
                $selected = $answers[$index];
                $isCorrect = $selected === $correct;
                $checked[] = [
                    'statement' => $question['statement'],
                    'correct' => $correct,
                    'selected' => $selected,
                    'is_correct' => $isCorrect,
                    'explanation' => $question['explanation'] ?? '',
                ];
            }

            return $this->saveAttempt($userId, $block, $variant, $progress, $answers, $checked, $cooldownTier, false,
                $assisted ? 'translated_questions' : 'normal');
        });
    }

    public function submitGrammarAttempt(int $userId, LessonBlock $block, ?int $variantId, array $answers, int $cooldownTier, bool $allowVariantOverride = false, bool $practice = false): array
    {
        $block = $block->trainingBlock() ?? throw ValidationException::withMessages(['source_block_id' => 'Исходное подзадание недоступно.']);
        if ($block->type !== 'grammar') throw ValidationException::withMessages(['type' => 'Ожидалось задание грамматики.']);
        return DB::transaction(function () use ($userId, $block, $variantId, $answers, $cooldownTier, $allowVariantOverride, $practice) {
            $progress = LessonBlockProgress::query()->lockForUpdate()->firstOrCreate([
                'user_id' => $userId, 'lesson_block_id' => $block->id,
            ]);
            $variant = $this->variantForAttempt($block, $userId, $variantId, $allowVariantOverride);
            // Grammar always uses a published authored variant, never an unfinished block fallback.
            if (!$variant) throw ValidationException::withMessages(['variant_id' => 'Нет опубликованного варианта.']);
            $checked = GrammarTask::grade($variant->config ?? [], $answers);
            return $this->saveAttempt($userId, $block, $variant, $progress, $answers, $checked, $cooldownTier, $practice);
        });
    }

    public function grammarItemStateFor(int $userId, LessonBlock $block, array $config): array
    {
        $block = $block->trainingBlock();
        if (!$block) return [];
        GrammarTask::validate($config);
        if ($config['task_kind'] !== 'grammar_items') return [];
        $rows = LessonGrammarItemProgress::query()->where('user_id', $userId)
            ->where('lesson_block_id', $block->id)->get()->keyBy('item_key');
        $choicePools = [
            'direct' => array_values(array_unique(array_column($config['items'], 'hint'))),
            'reverse' => array_values(array_unique(array_column($config['items'], 'letter'))),
        ];
        return array_map(function ($item) use ($rows, $choicePools, $userId, $block) {
            $row = $rows->get($item['key']);
            $directCount = min(2, (int) ($row?->direct_correct_attempts ?? 0));
            $reverseCount = min(2, (int) ($row?->reverse_correct_attempts ?? 0));
            $directEducation = (bool) $row?->direct_mode_education;
            $reverseEducation = (bool) $row?->reverse_mode_education;
            $directReady = ($directCount < 2 || $directEducation) && !($row?->direct_next_review_at?->isFuture() ?? false);
            $reverseReady = ($reverseCount < 2 || $reverseEducation) && !($row?->reverse_next_review_at?->isFuture() ?? false);
            $direction = $directEducation && $directReady ? 'direct'
                : ($reverseEducation && $reverseReady ? 'reverse'
                    : ($directReady ? 'direct' : ($reverseReady ? 'reverse' : null)));
            $nextReview = collect([$row?->direct_next_review_at, $row?->reverse_next_review_at])
                ->filter(fn ($time) => $time?->isFuture())->sort()->first();
            $directions = [];
            foreach (['direct', 'reverse'] as $side) {
                $answer = $side === 'direct' ? $item['hint'] : $item['letter'];
                $distractors = array_values(array_filter($choicePools[$side], fn ($value) => $value !== $answer));
                $seed = "$userId:{$block->id}:{$item['key']}:$side";
                usort($distractors, fn ($a, $b) => strcmp(hash('sha256', "$seed:$a"), hash('sha256', "$seed:$b")));
                $choices = [$answer, ...array_slice($distractors, 0, 5)];
                usort($choices, fn ($a, $b) => strcmp(hash('sha256', "choice:$seed:$a"), hash('sha256', "choice:$seed:$b")));
                $directions[$side] = [
                    'prompt' => $side === 'direct' ? $item['letter'] : $item['hint'],
                    'choices' => $choices,
                    'available' => $side === 'direct' ? $directReady : $reverseReady,
                    'mode_education' => $side === 'direct' ? $directEducation : $reverseEducation,
                    'correct_attempts' => $side === 'direct' ? $directCount : $reverseCount,
                    'next_review_at' => $row?->{$side.'_next_review_at'}?->toIso8601String(),
                ];
            }
            return [
                'key' => $item['key'],
                'prompt' => $direction === 'reverse' ? $item['hint'] : $item['letter'],
                'display_letter' => !$row || $reverseCount >= 2 || $reverseEducation ? $item['letter'] : null,
                'display_hint' => !$row || $directCount >= 2 || $directEducation ? $item['hint'] : null,
                'choices' => $direction !== null ? $directions[$direction]['choices'] : [],
                'directions' => $directions,
                'direction' => $direction,
                'available' => $direction !== null,
                'mode_education' => $direction === 'direct' ? $directEducation : ($direction === 'reverse' && $reverseEducation),
                'direct_correct' => $directCount >= 2,
                'reverse_correct' => $reverseCount >= 2,
                'steps' => $directCount + $reverseCount,
                'completed' => $directCount >= 2 && $reverseCount >= 2 && !$directEducation && !$reverseEducation,
                'next_review_at' => $direction === null ? $nextReview?->toIso8601String() : null,
            ];
        }, $config['items']);
    }

    public function submitGrammarItem(int $userId, LessonBlock $block, ?int $variantId, string $itemKey, string $direction, string $answer, int $cooldownTier, bool $allowVariantOverride = false, bool $practice = false): array
    {
        $block = $block->trainingBlock() ?? throw ValidationException::withMessages(['source_block_id' => 'Исходное подзадание недоступно.']);
        if ($block->type !== 'grammar') throw ValidationException::withMessages(['type' => 'Ожидалось задание грамматики.']);

        return DB::transaction(function () use ($userId, $block, $variantId, $itemKey, $direction, $answer, $cooldownTier, $allowVariantOverride, $practice) {
            $variant = $this->variantForAttempt($block, $userId, $variantId, $allowVariantOverride);
            $config = $variant?->config ?? [];
            GrammarTask::validate($config);
            if ($config['task_kind'] !== 'grammar_items') throw ValidationException::withMessages(['type' => 'Это не поэлементное задание.']);
            $item = collect($config['items'])->firstWhere('key', $itemKey);
            if (!$item || !in_array($direction, ['direct', 'reverse'], true)) {
                throw ValidationException::withMessages(['item_key' => 'Неизвестная буква или направление.']);
            }

            $progress = LessonBlockProgress::query()->lockForUpdate()->firstOrCreate([
                'user_id' => $userId, 'lesson_block_id' => $block->id,
            ]);
            $row = LessonGrammarItemProgress::query()->lockForUpdate()->firstOrNew([
                'user_id' => $userId, 'lesson_block_id' => $block->id, 'item_key' => $itemKey,
            ]);
            $current = collect($this->grammarItemStateFor($userId, $block, $config))->firstWhere('key', $itemKey);
            if (!$practice && !$current['directions'][$direction]['available']) {
                throw ValidationException::withMessages(['item_key' => 'Состояние буквы изменилось. Обновите задание.']);
            }

            $expected = $direction === 'direct' ? $item['hint'] : $item['letter'];
            $correct = GrammarTask::normalize($answer) === GrammarTask::normalize($expected);
            $now = now('UTC');
            if (!$practice) {
                $countField = $direction.'_correct_attempts';
                $modeField = $direction.'_mode_education';
                $nextField = $direction.'_next_review_at';
                if (!$correct) {
                    $row->fill([$modeField => true, $nextField => null])->save();
                } elseif ($row->{$modeField}) {
                    $row->fill([$modeField => false, $nextField => $now->copy()->addMinutes(30)])->save();
                } else {
                    $count = min(2, (int) $row->{$countField} + 1);
                    $row->fill([
                        $countField => $count,
                        $direction.'_correct' => $count >= 2,
                        $nextField => $count < 2 ? $now->copy()->addHours($cooldownTier === 2 ? 3 : 20) : null,
                    ])->save();
                }
            }
            $items = $this->grammarItemStateFor($userId, $block, $config);
            $steps = array_sum(array_column($items, 'steps'));
            $score = intdiv($steps * 100, count($items) * 4);
            LessonBlockAttempt::create([
                'user_id' => $userId, 'lesson_block_id' => $block->id, 'lesson_block_variant_id' => $variant->id,
                'answer' => ['item_key' => $itemKey, 'direction' => $direction, 'answer' => $answer],
                'feedback' => ['expected' => $expected, 'is_correct' => $correct, 'was_education' => $current['directions'][$direction]['mode_education']],
                'score' => $score, 'rank' => self::rankFor($score), 'is_practice' => $practice,
                'cooldown_tier' => $cooldownTier === 2 ? 2 : 0, 'scored_at' => $now,
            ]);
            if ($correct && !$practice) {
                $best = max($progress->best_score ?? 0, $score);
                $progress->fill(['best_score' => $best, 'best_rank' => self::rankFor($best), 'last_scored_at' => $now])->save();
                if ($score >= 60) LessonBlockCompletion::firstOrCreate(
                    ['user_id' => $userId, 'lesson_block_id' => $block->id], ['completed_at' => $now],
                );
            }
            return [
                'score' => $score, 'rank' => self::rankFor($score), 'rank_label' => self::rankLabel(self::rankFor($score)),
                'is_practice' => $practice, 'is_correct' => $correct, 'expected' => $expected,
                'was_education' => $current['directions'][$direction]['mode_education'],
                'item_key' => $itemKey, 'items' => $items, 'progress' => $this->progressPayload($progress->fresh()),
            ];
        });
    }

    private function saveAttempt(int $userId, LessonBlock $block, ?LessonBlockVariant $variant, LessonBlockProgress $progress, array $answers, array $checked, int $cooldownTier, bool $practice = false, ?string $supportMode = null): array
    {
            $correctCount = count(array_filter($checked, fn ($q) => $q['is_correct']));
            $assisted = $supportMode === 'translated_questions';
            $rawScore = intdiv($correctCount * 100, count($checked));
            $score = intdiv($correctCount * ($assisted ? 80 : 100), count($checked));
            $support = $supportMode !== null ? [
                'support_mode' => $supportMode,
                'raw_score' => $rawScore,
                'score' => $score,
                'score_multiplier' => $assisted ? 0.8 : 1,
            ] : [];
            $rank = self::rankFor($score);
            $tier = $cooldownTier === 2 ? 2 : 0;
            $now = now('UTC');
            $isPractice = $practice || ($progress->next_scored_at?->isFuture() ?? false);

            $attempt = LessonBlockAttempt::create([
                'user_id' => $userId,
                'lesson_block_id' => $block->id,
                'lesson_block_variant_id' => $variant?->id,
                'answer' => ['answers' => $answers, ...$support],
                'feedback' => ['questions' => $checked, ...$support],
                'score' => $score,
                'rank' => $rank,
                'is_practice' => $isPractice,
                'cooldown_tier' => $tier,
                'scored_at' => $now,
            ]);

            if (!$isPractice) {
                $bestScore = max($progress->best_score ?? 0, $score);
                $progress->fill([
                    'best_score' => $bestScore,
                    'best_rank' => self::rankFor($bestScore),
                    'cooldown_tier' => $tier,
                    'last_scored_at' => $now,
                    'next_scored_at' => $now->copy()->addSeconds(self::COOLDOWN_SECONDS[$tier]),
                ])->save();

                if ($score >= 60) {
                    LessonBlockCompletion::updateOrCreate(
                        ['user_id' => $userId, 'lesson_block_id' => $block->id],
                        ['completed_at' => $now],
                    );
                }
            }

            if ($assisted) {
                $progress->forceFill(['assisted_variant_ids' => array_values(array_filter(
                    $progress->assisted_variant_ids ?? [], fn ($id) => $id !== $variant->id,
                ))])->save();
            }

            return [
                'attempt_id' => $attempt->id,
                'variant_id' => $variant?->id,
                'score' => $score,
                'rank' => $rank,
                'rank_label' => self::rankLabel($rank),
                'is_practice' => $isPractice,
                'feedback' => $checked,
                'progress' => $this->progressPayload($progress->fresh(), $variant?->id),
                'completed' => !$isPractice && $score >= 60,
                ...$support,
            ];
    }

    private function variantForAttempt(LessonBlock $block, int $userId, ?int $variantId, bool $allowVariantOverride): ?LessonBlockVariant
    {
        if ($variantId === null) {
            if ($this->selectedVariant($block, $userId) === null) return null;
            throw ValidationException::withMessages(['variant_id' => 'Обновите страницу задания и выберите вариант.']);
        }
        if (app(CoursePracticeVariants::class)->isCoursePractice($block)) {
            return $this->publishedVariant($block, $variantId)
                ?? throw ValidationException::withMessages(['variant_id' => 'Этот вариант задания недоступен.']);
        }
        if ($allowVariantOverride && !$this->isAlphabetBlock($block)) {
            $variant = $this->publishedVariant($block, $variantId);
            if ($variant) return $variant;
        }
        $variant = $this->selectedVariant($block, $userId);
        if (!$variant || $variant->id !== $variantId) {
            throw ValidationException::withMessages(['variant_id' => 'Этот вариант сейчас не назначен этому ученику. Обновите страницу задания.']);
        }
        return $variant;
    }

    private function isAlphabetBlock(LessonBlock $block): bool
    {
        if ($block->type !== 'grammar') return false;
        if ($block->seed_key !== null) return str_starts_with($block->seed_key, 'grammar-a1-alphabet-');
        return $block->page?->slug === 'grammar-a1-alphabet';
    }

    /** @return array<string, mixed> */
    private function progressPayload(?LessonBlockProgress $progress, ?int $variantId = null): array
    {
        $next = $progress?->next_scored_at;
        return [
            'best_score' => $progress?->best_score,
            'best_rank' => $progress?->best_rank,
            'best_rank_label' => self::rankLabel($progress?->best_rank),
            'cooldown_tier' => $progress?->cooldown_tier ?? 0,
            'last_scored_at' => $progress?->last_scored_at?->toIso8601String(),
            'next_scored_at' => $next?->toIso8601String(),
            'is_training' => $next?->isFuture() ?? false,
            'assistance_active' => $progress?->hasPendingAssistance($variantId) ?? false,
        ];
    }
}
