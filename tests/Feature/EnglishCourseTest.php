<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\CourseController;
use App\Models\CourseGroup;
use App\Models\CourseStep;
use App\Models\LessonPage;
use App\Models\LessonBlock;
use App\Models\LessonBlockVariant;
use App\Models\LessonBlockProgress;
use App\Services\GrammarTask;
use App\Services\LessonProgressService;
use App\Http\Controllers\Api\GrammarTopicController;
use App\Services\CourseCatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class EnglishCourseTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('users', fn ($t) => $t->id());
        Schema::create('dictionaries', function ($t) { $t->id(); $t->string('learn_lang'); });
        Schema::create('dictionary_categories', function ($t) { $t->id(); $t->integer('dictionary_id'); $t->integer('parent_id')->nullable(); $t->string('name'); $t->integer('order')->default(0); });
        Schema::create('dictionary_words', function ($t) { $t->id(); $t->integer('dictionary_id'); });
        Schema::create('dictionary_word_category', function ($t) { $t->integer('word_id'); $t->integer('category_id'); });
        Schema::create('user_dictionary_words', function ($t) { $t->integer('user_id'); $t->integer('dict_word_id'); $t->integer('correct_attempts'); $t->integer('correct_attempts_revert'); });
        foreach (['2026_09_09_000002_create_course_steps.php', '2026_09_11_000001_create_course_groups.php',
            '2026_09_11_000004_add_custom_component_to_course_steps.php', '2026_09_11_000002_create_lesson_pages_table.php',
            '2026_09_11_000003_create_lesson_blocks_table.php', '2026_09_11_000005_create_lesson_block_completions_table.php',
            '2026_09_22_000001_add_course_skill_lesson_framework.php', '2026_09_29_000001_create_lesson_block_responses_table.php',
            '2026_10_01_000001_add_grammar_stage_references.php', '2026_09_27_000001_create_grammar_topics_table.php',
            '2026_09_29_000002_create_lesson_grammar_item_progress_table.php', '2026_09_29_000003_add_reviews_to_lesson_grammar_item_progress.php',
            '2026_09_25_000001_create_app_settings_table.php'] as $migration) (require database_path('migrations/'.$migration))->up();
        DB::table('dictionaries')->insert([['id' => 31, 'learn_lang' => 'EN'], ['id' => 20, 'learn_lang' => 'lv']]);
        $plan = json_decode(file_get_contents(resource_path('course/english-path.json')), true);
        $id = 100;
        foreach ($plan['levels'] as $level => $topics) {
            $root = $id++;
            DB::table('dictionary_categories')->insert(['id' => $root, 'dictionary_id' => 31, 'parent_id' => null, 'name' => $level]);
            foreach ($topics as $topic) {
                $category = $id++;
                DB::table('dictionary_categories')->insert(['id' => $category, 'dictionary_id' => 31, 'parent_id' => $root, 'name' => $topic['category']]);
                DB::table('dictionary_words')->insert(['id' => $category, 'dictionary_id' => 31]);
                DB::table('dictionary_word_category')->insert(['word_id' => $category, 'category_id' => $category]);
            }
        }
    }

    public function test_seed_is_additive_repeatable_and_preserves_progress_and_admin_edits(): void
    {
        DB::table('user_dictionary_words')->insert(['user_id' => 5, 'dict_word_id' => 101, 'correct_attempts' => 2, 'correct_attempts_revert' => 2]);
        $before = DB::table('user_dictionary_words')->get()->toArray();
        $this->assertSame(0, Artisan::call('course:seed-english'));
        $this->assertSame(0, CourseGroup::count(), 'Preview must not write');
        $this->assertSame(0, Artisan::call('course:seed-english', ['--apply' => true]));
        $this->assertSame(88, CourseGroup::where('learn_lang', 'en')->count());
        $this->assertSame(130, CourseStep::where('learn_lang', 'en')->count());
        $grammar = CourseStep::where('kind', 'grammar')->first();
        $grammar->update(['title' => 'Administrator title', 'is_published' => false]);
        $group = CourseGroup::first();
        $group->update(['position' => 777, 'is_published' => false]);
        $this->assertSame(0, Artisan::call('course:seed-english', ['--apply' => true]));
        $this->assertSame(130, CourseStep::count());
        $this->assertSame('Administrator title', $grammar->fresh()->title);
        $this->assertFalse($grammar->fresh()->is_published);
        $this->assertSame(777, $group->fresh()->position);
        $this->assertFalse($group->fresh()->is_published);
        $this->assertEquals($before, DB::table('user_dictionary_words')->get()->toArray());
        $this->assertSame(88, DB::table('dictionary_words')->count());
    }

    public function test_english_api_links_to_real_tables_and_filters_languages(): void
    {
        Artisan::call('course:seed-english', ['--apply' => true]);
        $step = CourseStep::where('kind', 'category')->first();
        DB::table('user_dictionary_words')->insert(['user_id' => 5, 'dict_word_id' => $step->category_id, 'correct_attempts' => 2, 'correct_attempts_revert' => 2]);
        $request = Request::create('/api/course?learn_lang=en');
        $request->setUserResolver(fn () => (object) ['id' => 5]);
        $response = (new CourseController)->index($request);
        $levels = $response->getData(true)['data'];
        $this->assertSame(['A1', 'A2', 'B1', 'B2'], array_column($levels, 'id'));
        $all = collect($levels)->flatMap(fn ($level) => $level['steps']);
        $grammar = $all->where('kind', 'grammar');
        $this->assertCount(42, $grammar);
        foreach ($grammar as $table) {
            $this->assertTrue($table['available']);
            $this->assertStringStartsWith('/grammar/english?level=', $table['grammar_href']);
            $this->assertStringEndsWith('#'.$table['grammar_table_id'], $table['grammar_href']);
            $this->assertNotSame('completed', $table['status'], 'Reading a reference never awards completion');
        }
        $this->assertSame(100, $all->firstWhere('id', $step->id)['percent']);
        $request->setUserResolver(fn () => (object) ['id' => 6]);
        $other = collect((new CourseController)->index($request)->getData(true)['data'])->flatMap(fn ($level) => $level['steps']);
        $this->assertSame(0, $other->firstWhere('id', $step->id)['percent']);
        $latvian = (new CourseController)->index(Request::create('/api/course?learn_lang=lv'))->getData(true)['data'];
        $this->assertSame(0, collect($latvian)->sum(fn ($level) => count($level['steps'])));
        $this->assertStringContainsString('private', $response->headers->get('Cache-Control'));
    }

    public function test_grammar_language_is_derived_from_its_catalog_and_cross_language_assignment_is_rejected(): void
    {
        $english = CourseStep::create(['title' => 'Be', 'kind' => 'grammar', 'level' => 'A1', 'grammar_table_id' => 'en-be']);
        $this->assertSame('en', $english->learn_lang);
        $this->assertCount(42, CourseCatalog::englishGrammar());
        $group = CourseGroup::create(['title' => 'Latvian only', 'level' => 'A1', 'learn_lang' => 'lv']);
        $this->expectException(ValidationException::class);
        $english->update(['group_id' => $group->id]);
    }

    public function test_every_table_has_valid_exercises_and_repeat_import_preserves_admin_content(): void
    {
        Artisan::call('course:seed-english', ['--apply' => true]);
        $this->assertSame(0, Artisan::call('grammar:prepare-english'));
        $this->assertSame(0, LessonPage::count());
        $this->assertSame(0, Artisan::call('grammar:prepare-english', ['--apply' => true]));
        $this->assertSame(42, LessonPage::whereNull('course_group_id')->count());
        $this->assertSame(42, LessonBlock::whereNull('source_block_id')->count());
        $this->assertSame(42, LessonBlock::whereNotNull('source_block_id')->count());
        $this->assertSame(126, LessonBlockVariant::count());
        foreach (LessonBlockVariant::all() as $variant) {
            $this->assertCount(6, $variant->config['questions']);
            $this->assertTrue(collect(GrammarTask::grade($variant->config, array_column(array_column($variant->config['questions'], 'accepted_answers'), 0)))->every('is_correct'));
            foreach (GrammarTask::clientConfig($variant->config)['questions'] as $question) {
                $this->assertArrayNotHasKey('accepted_answers', $question);
                $this->assertArrayNotHasKey('explanation', $question);
            }
        }
        $page = LessonPage::whereNull('course_group_id')->first();
        $page->update(['title' => 'Admin edit', 'is_published' => false]);
        $variant = LessonBlockVariant::first();
        $variant->update(['title' => 'Admin variant']);
        $this->assertSame(0, Artisan::call('grammar:prepare-english', ['--apply' => true]));
        $this->assertSame('Admin edit', $page->fresh()->title);
        $this->assertFalse($page->fresh()->is_published);
        $this->assertSame('Admin variant', $variant->fresh()->title);
        $this->assertSame(126, LessonBlockVariant::count());
    }

    public function test_english_table_and_course_share_private_progress_and_cooldown(): void
    {
        DB::table('users')->insert([['id' => 5], ['id' => 6]]);
        Artisan::call('course:seed-english', ['--apply' => true]);
        Artisan::call('grammar:prepare-english', ['--apply' => true]);
        $placement = LessonBlock::whereNotNull('source_block_id')->first();
        $source = $placement->trainingBlock();
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($source, 5);
        $answers = array_column(array_column($variant->config['questions'], 'accepted_answers'), 0);
        $score = $service->submitGrammarAttempt(5, $placement, $variant->id, $answers, 2);
        $this->assertSame(100, $score['score']);
        $this->assertSame($service->progressFor(5, $source), $service->progressFor(5, $placement));
        $this->assertFalse(LessonBlockProgress::where('lesson_block_id', $placement->id)->exists());
        $this->assertNull($service->progressFor(6, $placement)['best_score']);
        $nextVariant = $service->selectedVariant($source, 5);
        $retry = $service->submitGrammarAttempt(5, $source, $nextVariant->id,
            array_column(array_column($nextVariant->config['questions'], 'accepted_answers'), 0), 2);
        $this->assertTrue($retry['is_practice']);
        $request = Request::create('/api/grammar-topics?learn_lang=en');
        $request->setUserResolver(fn () => (object) ['id' => 5]);
        $result = (new GrammarTopicController)->index($request)->getData(true)['data'];
        $this->assertCount(42, collect($result)->whereNull('course_group_id'));
        $this->assertSame(100, collect($result)->firstWhere('slug', $source->page->slug)['summary']['score']);
        $this->assertTrue(collect($result)->every(fn ($topic) => $topic['learn_lang'] === 'en'));
        $lvRequest = Request::create('/api/grammar-topics');
        $lvRequest->setUserResolver(fn () => (object) ['id' => 5]);
        $this->assertSame([], (new GrammarTopicController)->index($lvRequest)->getData(true)['data']);
        $request->setUserResolver(fn () => (object) ['id' => 6]);
        $other = (new GrammarTopicController)->index($request)->getData(true)['data'];
        $this->assertSame(0, collect($other)->firstWhere('slug', $source->page->slug)['summary']['score']);
    }
}
