<?php

use App\Http\Controllers\Api\Admin\CategoryAdminController;
use App\Http\Controllers\Api\Admin\WordAdminController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\DemoController;
use App\Http\Controllers\Api\DictionaryController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\ProductController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\TrainingController;
use App\Http\Controllers\Api\TutorConversationController;
use App\Http\Controllers\Api\TutorLearningContextController;
use App\Http\Controllers\Api\TutorMemoryController;
use DebugBar\AssetHandler;
use Fruitcake\LaravelDebugbar\LaravelDebugbar;
use Fruitcake\LaravelDebugbar\Controllers\AssetController;
use Fruitcake\LaravelDebugbar\Requests\AssetRequest;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/health', fn () => response()->json([
    'status' => 'ok',
    'app' => config('app.name'),
]));

Route::get('/tutor/presets', [\App\Http\Controllers\Api\TutorPresetController::class, 'index'])->middleware('throttle:120,1');
Route::put('/tutor/presets/{preset}', [\App\Http\Controllers\Api\TutorPresetController::class, 'update'])->middleware(['auth:sanctum', 'throttle:20,1']);
Route::middleware(['auth:sanctum', 'throttle:60,1'])->prefix('tutor/flows')->group(function () {
    Route::get('/project-schemes', [\App\Http\Controllers\Api\TutorProjectSchemeController::class, 'index']);
    Route::get('/project-schemes/blocks', [\App\Http\Controllers\Api\TutorProjectSchemeController::class, 'blocks']);
    Route::post('/project-schemes', [\App\Http\Controllers\Api\TutorProjectSchemeController::class, 'create']);
    Route::put('/project-schemes/{project}', [\App\Http\Controllers\Api\TutorProjectSchemeController::class, 'update']);
    Route::get('/modules', [\App\Http\Controllers\Api\TutorFlowModuleController::class, 'index']);
    Route::post('/modules', [\App\Http\Controllers\Api\TutorFlowModuleController::class, 'store']);
    Route::get('/workflows', [\App\Http\Controllers\Api\AiStudioController::class, 'workflows']);
    Route::post('/workflows/{scheme}/{action}', [\App\Http\Controllers\Api\AiStudioController::class, 'workflowMutation'])->where('scheme', '[a-z_]+')->where('action', 'save|activate|deactivate|preview');
    Route::get('/bots', [\App\Http\Controllers\Api\AiStudioController::class, 'index']);
    Route::put('/bots/{bot}', [\App\Http\Controllers\Api\AiStudioController::class, 'update'])->where('bot', '[a-z_]+');
    Route::get('/debug-users', [\App\Http\Controllers\Api\TutorDebugController::class, 'users']);
    Route::get('/', [\App\Http\Controllers\Api\TutorFlowController::class, 'index']);
    Route::post('/', [\App\Http\Controllers\Api\TutorFlowController::class, 'store']);
    Route::post('/deactivate', [\App\Http\Controllers\Api\TutorFlowController::class, 'deactivate']);
    Route::get('/{version}', [\App\Http\Controllers\Api\TutorFlowController::class, 'show'])->whereNumber('version');
    Route::post('/{version}/activate', [\App\Http\Controllers\Api\TutorFlowController::class, 'activate'])->whereNumber('version');
});

Route::post('/register', [AuthController::class, 'register']);
Route::post('/login', [AuthController::class, 'login']);
Route::post('/forgot-password', [PasswordResetController::class, 'forgot']);
Route::post('/reset-password', [PasswordResetController::class, 'reset']);
Route::post('/internal/credits', [\App\Http\Controllers\Api\CreditController::class, 'gateway']);
Route::get('/me/credits', [\App\Http\Controllers\Api\CreditController::class, 'balance'])->middleware('auth:sanctum');
Route::get('/me/credits/statistics', [\App\Http\Controllers\Api\CreditController::class, 'statistics'])->middleware('auth:sanctum');
Route::get('/me/subscription', [\App\Http\Controllers\Api\SubscriptionController::class, 'show'])->middleware('auth:sanctum');
Route::post('/me/subscription', [\App\Http\Controllers\Api\SubscriptionController::class, 'purchase'])->middleware(['auth:sanctum', 'throttle:10,1']);
Route::post('/tutor/ticket', [\App\Http\Controllers\Api\CreditController::class, 'ticket'])->middleware(['auth:sanctum', 'throttle:20,1']);

Route::get('/dictionaries', [DictionaryController::class, 'index']);
Route::get('/course', [\App\Http\Controllers\Api\CourseController::class, 'index'])->middleware('auth:sanctum');
Route::get('/course/continue', [\App\Http\Controllers\Api\CourseLearningController::class, 'show'])->middleware('auth:sanctum');
Route::patch('/me/course-target', [\App\Http\Controllers\Api\CourseLearningController::class, 'update'])->middleware(['auth:sanctum', 'throttle:30,1']);
Route::get('/lessons/{slug}', [\App\Http\Controllers\Api\LessonController::class, 'show'])->middleware('auth:sanctum');
Route::get('/grammar-topics', [\App\Http\Controllers\Api\GrammarTopicController::class, 'index'])->middleware('auth:sanctum');
Route::post('/lessons/blocks/{lessonBlock}/attempt', [\App\Http\Controllers\Api\LessonController::class, 'submitAttempt'])->middleware('auth:sanctum');
Route::post('/lessons/blocks/{lessonBlock}/assistance', [\App\Http\Controllers\Api\LessonController::class, 'assistance'])->middleware('auth:sanctum');
Route::post('/lessons/blocks/{lessonBlock}/grammar-item', [\App\Http\Controllers\Api\LessonController::class, 'submitGrammarItem'])->middleware('auth:sanctum');
Route::post('/lessons/blocks/{lessonBlock}/response', [\App\Http\Controllers\Api\LessonController::class, 'submitResponse'])->middleware('auth:sanctum');
Route::post('/lessons/blocks/{lessonBlock}/translation-check', [\App\Http\Controllers\Api\LessonController::class, 'checkTranslation'])->middleware(['auth:sanctum', 'throttle:6,1']);
Route::get('/dictionaries/{dictionary}', [DictionaryController::class, 'show']);
Route::get('/dictionaries/{dictionary}/categories', [DictionaryController::class, 'categories']);
Route::get('/dictionaries/{dictionary}/words', [DictionaryController::class, 'words']);

Route::get('/products', [ProductController::class, 'index']);
Route::get('/products/{product}', [ProductController::class, 'show']);
Route::get('/posts', [PostController::class, 'index']);
Route::get('/posts/{post}', [PostController::class, 'show'])->name('api.posts.show');

Route::get('/demo/dashboard', [DemoController::class, 'dashboard']);
Route::get('/demo/queue-status', [DemoController::class, 'queueStatus']);

Route::middleware('auth:sanctum')->group(function () {
    Route::get('/exams', [\App\Http\Controllers\Api\ExamController::class, 'index']);
    Route::get('/exams/history', [\App\Http\Controllers\Api\ExamController::class, 'history']);
    Route::get('/exams/{exam}/certificate-preview', [\App\Http\Controllers\Api\ExamController::class, 'certificatePreview']);
    Route::post('/exams/{exam}/start', [\App\Http\Controllers\Api\ExamController::class, 'start'])->middleware('throttle:10,1');
    Route::get('/exam-attempts/{attempt}', [\App\Http\Controllers\Api\ExamController::class, 'show']);
    Route::put('/exam-attempts/{attempt}', [\App\Http\Controllers\Api\ExamController::class, 'save']);
    Route::post('/exam-attempts/{attempt}/audio', [\App\Http\Controllers\Api\ExamController::class, 'audio'])->middleware('throttle:20,1');
    Route::post('/exam-attempts/{attempt}/speech', [\App\Http\Controllers\Api\ExamController::class, 'speech'])->middleware('throttle:12,1');
    Route::post('/exam-attempts/{attempt}/grade', [\App\Http\Controllers\Api\ExamController::class, 'grade'])->middleware('throttle:6,1');
    Route::get('/user', [AuthController::class, 'user']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::patch('/me/preferred-learn-lang', [ProfileController::class, 'updatePreferredLearnLang']);
    Route::get('/me/progress', [ProfileController::class, 'progress']);
    Route::post('/demo/queue-ping', [DemoController::class, 'queuePing']);

    Route::get('/tutor/conversation/current', [TutorConversationController::class, 'current']);
    Route::get('/tutor/conversations', [TutorConversationController::class, 'index']);
    Route::post('/tutor/conversations', [TutorConversationController::class, 'store']);
    Route::get('/tutor/conversations/{conversation}/messages', [TutorConversationController::class, 'messages']);
    Route::post('/tutor/messages', [TutorConversationController::class, 'storeMessage']);
    Route::get('/tutor/memory', [TutorMemoryController::class, 'index']);
    Route::get('/tutor/memory/overview', [TutorMemoryController::class, 'overview']);
    Route::get('/tutor/learning-context', [TutorLearningContextController::class, 'index']);
    Route::get('/tutor/category-vocabulary', [\App\Http\Controllers\Api\TutorCategoryVocabularyController::class, 'index']);
    Route::post('/tutor/references', \App\Http\Controllers\Api\TutorReferenceController::class)->middleware('throttle:20,1');
    Route::post('/tutor/memory/search-history', [TutorMemoryController::class, 'searchHistory']);
    Route::get('/tutor/memory/history-around/{message}', [TutorMemoryController::class, 'historyAroundMessage']);
    Route::post('/tutor/memory/notes/search', [TutorMemoryController::class, 'searchMemoryNotes']);
    Route::post('/tutor/memory/notes', [TutorMemoryController::class, 'storeMemoryNote']);
    Route::post('/tutor/memory/difficult-words', [TutorMemoryController::class, 'storeDifficultWord']);
    Route::post('/tutor/memory/progress-estimates', [TutorMemoryController::class, 'storeProgressEstimate']);
    Route::post('/tutor/lesson-blocks/{lessonBlock}/complete', [\App\Http\Controllers\Api\LessonController::class, 'completeBlock']);

    Route::get('/debugbar/widget', function (Request $request, LaravelDebugbar $debugbar) {
        abort_unless($request->user()?->isFrontendAdmin(), 403);

        $debugbar->enable();
        $debugbar->boot();
        $renderer = $debugbar->getJavascriptRenderer();

        return response()->json([
            'html' => $renderer->renderHead().$renderer->render(),
        ]);
    })->middleware('role:super_admin|admin');

    Route::get('/debugbar/assets', function (Request $request, AssetRequest $assetRequest, AssetHandler $assetHandler, LaravelDebugbar $debugbar) {
        abort_unless($request->user()?->isFrontendAdmin(), 403);

        // Debugbar's stock web route is disabled locally when APP_DEBUG is off. The Next app
        // authenticates with a Sanctum token instead of Laravel's browser session, so serve its
        // static JS/CSS through this authenticated API route.
        $debugbar->enable();
        $debugbar->boot();

        return app(AssetController::class)->getAssets($assetRequest, $assetHandler, $debugbar);
    })->middleware('role:super_admin|admin');

    Route::post('/training/progress', [TrainingController::class, 'updateProgress']);
    // Default: Laravel. Optional Node WS: tools/training-ws (NEXT_PUBLIC_TRAINING_ATTEMPT_TRANSPORT=ws)
    Route::post('/training/attempt', [TrainingController::class, 'attempt']);
    Route::post('/training/reset-category', [TrainingController::class, 'resetCategory']);
    Route::post('/training/reset-word', [TrainingController::class, 'resetWord']);
    Route::post('/training/set-easy-mode', [TrainingController::class, 'setCategoryEasyMode']);
    Route::post('/training/demote-scores', [TrainingController::class, 'demoteCategoryScores']);
    Route::get('/training/dense', [TrainingController::class, 'denseState']);
    Route::post('/training/dense/words', [TrainingController::class, 'denseAddWords']);
    Route::post('/training/dense/remove-word', [TrainingController::class, 'denseRemoveWord']);
    Route::post('/training/dense/answer', [TrainingController::class, 'denseSubmitAnswer']);
    Route::post('/training/dense/tick', [TrainingController::class, 'denseTick']);
    Route::post('/training/dense/clear', [TrainingController::class, 'denseClear']);
    Route::post('/training/dense/match-success', [TrainingController::class, 'denseMatchSuccess']);

    Route::middleware('role:super_admin|admin')->prefix('admin')->group(function () {
        Route::post('/words', [WordAdminController::class, 'store']);
        Route::post('/words/bulk', [WordAdminController::class, 'bulkStore']);
        Route::post('/words/move', [WordAdminController::class, 'move']);
        Route::post('/words/reorder', [WordAdminController::class, 'reorder']);
        Route::post('/words/sort-ai', [WordAdminController::class, 'sortWithAi']);
        Route::post('/words/delete-all-in-category', [WordAdminController::class, 'destroyAllInCategory']);
        Route::post('/dictionaries/shuffle', [WordAdminController::class, 'shuffleDictionary']);
        Route::get('/words/{word}/progress', [WordAdminController::class, 'progressShow']);
        Route::patch('/words/{word}/progress', [WordAdminController::class, 'progressUpdate']);
        Route::patch('/words/{word}', [WordAdminController::class, 'update']);
        Route::delete('/words/{word}', [WordAdminController::class, 'destroy']);

        Route::post('/categories', [CategoryAdminController::class, 'store']);
        Route::get('/categories/{category}/vocabulary-audit', \App\Http\Controllers\Api\Admin\CategoryVocabularyAuditController::class);
        Route::get('/categories/{category}/vocabulary-audit/word', [\App\Http\Controllers\Api\Admin\CategoryVocabularyAuditController::class, 'word']);
        Route::post('/categories/{category}/vocabulary-audit/placement', [\App\Http\Controllers\Api\Admin\CategoryVocabularyAuditController::class, 'place']);
        Route::post('/categories/reorder', [CategoryAdminController::class, 'reorder']);
        Route::post('/categories/{category}/move', [CategoryAdminController::class, 'moveToDictionary']);
        Route::patch('/categories/{category}', [CategoryAdminController::class, 'update']);
        Route::delete('/categories/{category}', [CategoryAdminController::class, 'destroy']);
    });
});
