<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LessonBlock;
use App\Models\LessonBlockAttempt;
use App\Models\LessonBlockCompletion;
use App\Models\LessonBlockResponse;
use App\Models\LessonPage;
use App\Models\User;
use App\Services\LessonProgressService;
use App\Services\CoursePracticeVariants;
use App\Services\PracticeVariantRanks;
use App\Services\GrammarTask;
use App\Services\GrammarTableBindings;
use App\Support\LessonBinaryTask;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class LessonController extends Controller
{
    public function __construct(private LessonProgressService $progress) {}

    public function show(Request $request, string $slug): JsonResponse
    {
        $page = LessonPage::with('blocks.variants', 'blocks.sourceBlock.variants', 'blocks.sourceBlock.page.grammarTopic', 'blocks.page.grammarTopic')
            ->where('slug', $slug)
            ->where('is_published', true)
            ->where(fn ($query) => $query->whereNull('course_group_id')->orWhere('status', 'published'))
            ->where(fn ($query) => $query->whereNull('skill')->orWhere('skill', '!=', 'grammar')->orWhere('status', 'published'))
            ->firstOrFail();
        $combined = $request->boolean('combined') && $page->course_group_id !== null
            && in_array($page->skill, CoursePracticeVariants::SKILLS, true);
        if ($combined) {
            $siblings = LessonPage::with('blocks.variants', 'blocks.page')
                ->where('course_group_id', $page->course_group_id)->where('learn_lang', $page->learn_lang)
                ->where('is_published', true)->where('status', 'published')
                ->whereIn('skill', CoursePracticeVariants::SKILLS)->orderBy('id')->get()->unique('skill');
            $page->setRelation('blocks', new \Illuminate\Database\Eloquent\Collection(
                collect(CoursePracticeVariants::SKILLS)->flatMap(fn ($skill) => $siblings->firstWhere('skill', $skill)?->blocks ?? [])->all()
            ));
        }
        $page->setRelation('blocks', $page->blocks->reject(fn ($block) => $block->isRetiredCoursePractice())->values());
        $userId = $request->user()?->id;
        $isAdmin = $request->user() instanceof User && $request->user()->isFrontendAdmin();
        $singleAlphabet = $page->slug === 'grammar-a1-alphabet';
        $requestedVariants = is_array($request->input('variants')) ? $request->input('variants') : [];
        $practicePolicy = app(CoursePracticeVariants::class);
        $trainingIds = $page->blocks->map(fn ($block) => $block->trainingBlock()?->id)->filter();
        $completedIds = $userId ? LessonBlockCompletion::where('user_id', $userId)
            ->whereIn('lesson_block_id', $trainingIds)
            ->pluck('lesson_block_id')->flip() : collect();
        $responses = $userId ? LessonBlockResponse::query()->where('user_id', $userId)
            ->whereIn('lesson_block_id', $trainingIds)
            ->orderByDesc('id')->get()->unique(fn ($row) => $row->lesson_block_id.':'.$row->lesson_block_variant_id)
            ->keyBy(fn ($row) => $row->lesson_block_id.':'.$row->lesson_block_variant_id) : collect();
        $successfulVariants = $userId ? LessonBlockAttempt::query()->where('user_id', $userId)
            ->whereIn('lesson_block_id', $trainingIds)->where('score', '>=', 60)->whereNotNull('lesson_block_variant_id')
            ->get(['lesson_block_id', 'lesson_block_variant_id'])->toBase()->mapWithKeys(fn ($row) => [$row->lesson_block_id.':'.$row->lesson_block_variant_id => true]) : collect();
        if ($userId) {
            $successfulVariants = $successfulVariants->merge(LessonBlockResponse::query()->where('user_id', $userId)
                ->whereIn('lesson_block_id', $trainingIds)->where('status', 'accepted')->whereNotNull('lesson_block_variant_id')
                ->get(['lesson_block_id', 'lesson_block_variant_id'])->toBase()->mapWithKeys(fn ($row) => [$row->lesson_block_id.':'.$row->lesson_block_variant_id => true]));
        }

        $blocks = $page->blocks->map(function (LessonBlock $block) use ($page, $userId, $completedIds, $responses, $isAdmin, $singleAlphabet, $requestedVariants, $practicePolicy, $successfulVariants) {
            $training = $block->trainingBlock();
            $blockVariants = $training?->variants ?? collect();
            $practiceVariants = $practicePolicy->isCoursePractice($block);
            $limitedVariants = $practiceVariants || $block->type === 'grammar';
            if ($limitedVariants) $blockVariants = $practicePolicy->available($block);
            $singleAlphabet = $singleAlphabet || $training?->page?->slug === 'grammar-a1-alphabet';
            $numberedVariants = $limitedVariants && !$singleAlphabet
                && ($blockVariants->first()?->config['task_kind'] ?? null) !== 'grammar_items';
            $assignedVariant = $userId ? $this->progress->selectedVariant($block, (int) $userId) : null;
            $variant = $assignedVariant;
            if (($isAdmin || $practiceVariants) && !$singleAlphabet && isset($requestedVariants[$block->id]) && ctype_digit((string) $requestedVariants[$block->id])) {
                $variant = $this->progress->publishedVariant($block, (int) $requestedVariants[$block->id]) ?? $variant;
            }
            $config = $variant?->config ?? $training?->config ?? [];
            $translationAttempt = $userId && $block->type === 'reading' && ($config['task_kind'] ?? null) === 'lv_to_ru'
                ? LessonBlockAttempt::where('user_id', $userId)->where('lesson_block_id', $training?->id)
                    ->where('lesson_block_variant_id', $variant?->id)->whereNotNull('feedback->translation')
                    ->orderByDesc('id')->first() : null;
            $progress = $userId ? $this->progress->progressFor((int) $userId, $block, $variant?->id) : null;
            $productiveAttempt = $userId && in_array($block->type, ['writing', 'speaking'], true)
                ? LessonBlockAttempt::where('user_id', $userId)->where('lesson_block_id', $training?->id)
                    ->where('lesson_block_variant_id', $variant?->id)->whereNotNull('feedback->productive')->orderByDesc('id')->first() : null;
            $hasAttempt = $variant && $userId && LessonBlockAttempt::query()
                ->where('user_id', $userId)
                ->where('lesson_block_id', $training?->id)
                ->where('lesson_block_variant_id', $variant->id)
                ->exists();
            return [
                'id' => $block->id,
                'source_block_id' => $block->source_block_id,
                ...($block->type === 'grammar' ? app(GrammarTableBindings::class)->forBlock($block) : []),
                'type' => $block->type,
                'productive_result' => $productiveAttempt ? $this->progress->productiveResult($productiveAttempt) : null,
                'title' => $block->title ?? $training?->title,
                'is_required' => $block->is_required,
                'weight' => $block->weight,
                'variant_id' => $variant?->id,
                'audit_url' => $isAdmin ? url('/admin/content-audit').'?'.http_build_query(['lesson' => $block->lesson_page_id, 'block' => $block->id, 'variant' => $variant?->id, 'scope' => ($config['task_kind'] ?? null) === 'ru_to_lv' ? 'all' : null]) : null,
                'variant_title' => $numberedVariants && $variant ? 'Вариант '.($blockVariants->search(fn ($item) => $item->id === $variant->id) + 1) : $variant?->title,
                'practice_variants' => $practiceVariants,
                'variant_completed' => $variant && $successfulVariants->has($training?->id.':'.$variant->id),
                'assigned_variant_title' => $practiceVariants ? 'Вариант 1' : ($isAdmin && !$singleAlphabet && $assignedVariant
                    ? ($numberedVariants ? 'Вариант '.($blockVariants->search(fn ($item) => $item->id === $assignedVariant->id) + 1) : $assignedVariant->title) : null),
                'variants' => ($isAdmin || $practiceVariants) && !$singleAlphabet && $training?->page?->slug !== 'grammar-a1-alphabet' ? $blockVariants->where('is_published', true)->values()->map(fn ($item, $index) => [
                    'id' => $item->id,
                    'title' => $numberedVariants ? 'Вариант '.($index + 1) : $item->title,
                    'completed' => $successfulVariants->has($training?->id.':'.$item->id),
                ])->values()->all() : null,
                'config' => $block->type === 'grammar' ? ($variant
                    ? array_replace(GrammarTask::clientConfig($config), ($config['task_kind'] ?? null) === 'grammar_items'
                        ? ['items' => $userId ? $this->progress->grammarItemStateFor((int) $userId, $block, $config) : []] : [])
                    : ['task_kind' => 'unavailable', 'questions' => []]) : $this->clientConfig(
                        $config, $block->type === 'listening' && $variant !== null && !$hasAttempt,
                        $progress['assistance_active'] ?? false,
                        $variant !== null && in_array($block->type, ['reading', 'listening'], true),
                    ),
                'bot_prompt' => $block->bot_prompt,
                'completed' => $training && $completedIds->has($training->id),
                'progress' => $progress,
                'last_response' => ($practiceVariants ? $responses->get($training?->id.':'.$variant?->id)
                    : $responses->firstWhere('lesson_block_id', $training?->id))?->only(['lesson_block_variant_id', 'answer_text', 'status', 'created_at']),
                ...(($config['task_kind'] ?? null) === 'lv_to_ru' ? ['translation_result' => $translationAttempt ? $this->progress->translationResult($translationAttempt) : null] : []),
            ];
        })->values();
        $practiceBlocks = $blocks->whereIn('type', ['writing', 'speaking']);
        $requiredBlocks = $blocks->where('is_required', true);
        $isCourseSkillLesson = ($page->course_group_id !== null && $page->skill !== null) || $page->skill === 'grammar';
        $completed = $isCourseSkillLesson
            ? $requiredBlocks->isNotEmpty() && $requiredBlocks->every(fn ($block) => $block['completed'])
            : $practiceBlocks->isNotEmpty() && $practiceBlocks->every(fn ($block) => $block['completed']);
        $navigation = [];
        $variantRanks = null;
        if ($page->course_group_id !== null && in_array($page->skill, CoursePracticeVariants::SKILLS, true)) {
            $siblings = LessonPage::with('blocks')->where('course_group_id', $page->course_group_id)
                ->where('learn_lang', $page->learn_lang)->where('is_published', true)->where('status', 'published')
                ->whereIn('skill', CoursePracticeVariants::SKILLS)->orderBy('id')->get();
            $summaries = $userId ? $this->progress->summariesForPages((int) $userId, $siblings) : [];
            $rankService = app(PracticeVariantRanks::class);
            $ranks = $rankService->summariesForPages($userId !== null ? (int) $userId : null, $page, $siblings);
            $variantRanks = $ranks['aggregate'];
            foreach (CoursePracticeVariants::SKILLS as $skill) {
                $sibling = $siblings->firstWhere('skill', $skill);
                $navigation[] = ['skill' => $skill, 'slug' => $sibling?->slug, 'title' => $sibling?->title,
                    'completed' => $sibling ? ($summaries[$sibling->id]['completed'] ?? false) : false,
                    'variant_ranks' => $sibling ? $ranks['pages'][$sibling->id] : $rankService->emptySummaries()];
            }
        }

        $description = $page->description;
        if (trim((string) $description) === 'Тестовый каркас: пять вариантов каждого задания. Содержание и аудио будут редакционно заменены.') {
            $description = null;
        }

        return response()->json([
            'data' => [
                'id' => $page->id,
                'title' => $combined ? ($page->courseGroup?->title ?? preg_replace('/\s+-\s+.*$/u', '', $page->title)) : $page->title,
                'combined_practice' => $combined,
                'slug' => $page->slug,
                'course_group_id' => $page->course_group_id,
                'level' => $page->level,
                'learn_lang' => $page->learn_lang,
                'description' => $combined ? null : ($navigation && is_string($description)
                    ? \Illuminate\Support\Str::replaceStart('Пять диалогов по теме.', 'Диалоги по теме.', $description)
                    : $description),
                'skill' => $page->skill,
                'practice_navigation' => $navigation,
                ...($variantRanks !== null ? ['practice_variant_ranks' => $variantRanks] : []),
                'grammar_topic' => $page->skill === 'grammar' && $page->grammarTopic ? [
                    ...$page->grammarTopic->only(['rule', 'examples']),
                    'table_keys' => app(GrammarTableBindings::class)->resolve($page->grammarTopic->table_keys ?? []),
                ] : null,
                'grammar_summary' => $page->skill === 'grammar' ? \App\Services\GrammarTopicProgress::summary($blocks->all()) : null,
                'completed' => $completed,
                'skill_progress' => $userId ? ($this->progress->summariesForPages((int) $userId, collect([$page]))[$page->id] ?? null) : null,
                'blocks' => $blocks,
            ],
        ])->header('Cache-Control', 'private, no-store');
    }

    public function assistance(Request $request, LessonBlock $lessonBlock): JsonResponse
    {
        $lessonBlock->loadMissing('page');
        abort_unless($lessonBlock->page?->is_published
            && ($lessonBlock->page->course_group_id === null || $lessonBlock->page->status === 'published'), 404);
        abort_unless($lessonBlock->trainingBlock(), 404);
        $data = $request->validate(['variant_id' => ['required', 'integer']]);
        $result = $this->progress->startAssistance(
            (int) $request->user()->id, $lessonBlock, (int) $data['variant_id'],
            $request->user() instanceof User && $request->user()->isFrontendAdmin(),
        );

        return response()->json(['data' => $result])->header('Cache-Control', 'private, no-store');
    }

    public function submitAttempt(Request $request, LessonBlock $lessonBlock): JsonResponse
    {
        $lessonBlock->loadMissing('page');
        abort_unless(
            $lessonBlock->page?->is_published
            && ($lessonBlock->page->course_group_id === null || $lessonBlock->page->status === 'published'),
            404,
        );
        abort_if($lessonBlock->page->skill === 'grammar' && $lessonBlock->page->status !== 'published', 404);
        abort_unless($lessonBlock->trainingBlock(), 404);

        $data = $request->validate([
            'variant_id' => ['nullable', 'integer'],
            'answers' => ['required', 'array'],
            'answers.*' => $lessonBlock->type === 'grammar' ? ['required', 'string', 'max:2000'] : ['required', 'boolean'],
            'practice' => ['sometimes', 'boolean'],
            'cooldown_tier' => ['nullable', 'integer', 'in:0,2'],
        ]);

        $method = $lessonBlock->type === 'grammar' ? 'submitGrammarAttempt' : 'submitBinaryAttempt';
        $arguments = [
            (int) $request->user()->id,
            $lessonBlock,
            isset($data['variant_id']) ? (int) $data['variant_id'] : null,
            $data['answers'],
            (int) ($data['cooldown_tier'] ?? 0),
            $request->user() instanceof User && $request->user()->isFrontendAdmin(),
        ];
        if ($lessonBlock->type === 'grammar') $arguments[] = (bool) ($data['practice'] ?? false);
        $result = $this->progress->{$method}(...$arguments);
        if ($lessonBlock->type === 'listening') {
            $variant = $result['variant_id'] ? $this->progress->publishedVariant($lessonBlock, $result['variant_id']) : null;
            $result['transcript'] = $variant?->config['transcript'] ?? null;
        }
        return response()->json(['data' => $result]);
    }

    public function submitGrammarItem(Request $request, LessonBlock $lessonBlock): JsonResponse
    {
        $lessonBlock->loadMissing('page');
        abort_unless($lessonBlock->type === 'grammar'
            && $lessonBlock->page->status === 'published'
            && $lessonBlock->page->is_published, 404);
        abort_unless($lessonBlock->trainingBlock(), 404);
        $data = $request->validate([
            'variant_id' => ['required', 'integer'],
            'item_key' => ['required', 'string', 'max:64'],
            'direction' => ['required', 'in:direct,reverse'],
            'answer' => ['present', 'nullable', 'string', 'max:2000'],
            'practice' => ['sometimes', 'boolean'],
            'cooldown_tier' => ['nullable', 'integer', 'in:0,2'],
        ]);
        $result = $this->progress->submitGrammarItem(
            (int) $request->user()->id, $lessonBlock, (int) $data['variant_id'],
            $data['item_key'], $data['direction'], (string) ($data['answer'] ?? ''), (int) ($data['cooldown_tier'] ?? 0),
            $request->user() instanceof User && $request->user()->isFrontendAdmin(),
            (bool) ($data['practice'] ?? false),
        );
        return response()->json(['data' => $result]);
    }

    public function completeBlock(Request $request, LessonBlock $lessonBlock): JsonResponse
    {
        $lessonBlock->loadMissing('page');
        abort_unless($lessonBlock->trainingBlock(), 404);
        abort_unless($lessonBlock->page?->is_published && ($lessonBlock->page->course_group_id === null || $lessonBlock->page->status === 'published'), 404);
        abort_unless(in_array($lessonBlock->type, ['writing', 'speaking'], true), 403, 'Этот блок засчитывается только после проверки ответов.');
        $data = $request->validate([
            'variant_id' => ['nullable', 'integer'],
            'answer_text' => ['nullable', 'string', 'max:10000'],
            'feedback' => ['nullable', 'string', 'max:4000'],
        ]);
        $result = $this->progress->assessPracticeBlock(
            (int) $request->user()->id, $lessonBlock,
            isset($data['variant_id']) ? (int) $data['variant_id'] : null,
            $data['answer_text'] ?? '',
            $request->user() instanceof User && $request->user()->isFrontendAdmin(),
        );

        return response()->json(['data' => $result]);
    }

    public function checkTranslation(Request $request, LessonBlock $lessonBlock): JsonResponse
    {
        $lessonBlock->loadMissing('page');
        abort_unless($lessonBlock->trainingBlock(), 404);
        abort_unless($lessonBlock->page?->is_published && ($lessonBlock->page->course_group_id === null || $lessonBlock->page->status === 'published'), 404);
        $data = $request->validate([
            'variant_id' => ['required', 'integer'], 'submission_id' => ['required', 'uuid'],
            'answer_text' => ['required', 'string', 'min:1', 'max:10000'],
        ]);
        return response()->json(['data' => $this->progress->submitTranslation(
            (int) $request->user()->id, $lessonBlock, (int) $data['variant_id'], $data['answer_text'], $data['submission_id'],
            $request->user() instanceof User && $request->user()->isFrontendAdmin(),
        )])->header('Cache-Control', 'private, no-store');
    }

    public function submitResponse(Request $request, LessonBlock $lessonBlock): JsonResponse
    {
        $lessonBlock->loadMissing('page');
        abort_unless($lessonBlock->trainingBlock(), 404);
        abort_unless($lessonBlock->page?->is_published && ($lessonBlock->page->course_group_id === null || $lessonBlock->page->status === 'published'), 404);
        $data = $request->validate([
            'variant_id' => ['nullable', 'integer'],
            'answer_text' => ['required', 'string', 'min:1', 'max:10000'],
        ]);
        $response = $this->progress->submitFreeResponse(
            (int) $request->user()->id, $lessonBlock,
            isset($data['variant_id']) ? (int) $data['variant_id'] : null,
            $data['answer_text'], $request->user() instanceof User && $request->user()->isFrontendAdmin(),
        );

        return response()->json(['data' => [
            'id' => $response->id,
            'status' => $response->status,
            'variant_id' => $response->lesson_block_variant_id,
        ]]);
    }

    /** @param array<string, mixed> $config */
    private function clientConfig(array $config, bool $hideTranscript = false, bool $assistanceActive = false, bool $allowAssistance = true): array
    {
        $translated = array_key_exists('assisted_questions', $config) ? LessonBinaryTask::assistedQuestions($config) : null;
        unset($config['reference_translation'], $config['accepted_answers'], $config['correct_index'],
            $config['dialogue_segments'], $config['speaker_profiles'], $config['audio_generation'], $config['assisted_questions']);
        $config['assistance_available'] = $allowAssistance && $translated !== null;
        $config['assistance_active'] = $assistanceActive;
        if ($assistanceActive && $translated !== null) $config['assisted_questions'] = $translated;
        if ($hideTranscript) unset($config['transcript']);
        if (!is_array($config['questions'] ?? null)) return $config;

        $config['questions'] = array_map(function ($question) {
            if (!is_array($question)) return $question;
            unset($question['correct'], $question['explanation']);
            return $question;
        }, $config['questions']);
        return $config;
    }
}
