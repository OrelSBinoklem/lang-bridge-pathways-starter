<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\CourseController;
use App\Http\Controllers\Api\CourseLearningController;
use App\Models\CourseGroup;
use App\Models\CourseStep;
use App\Models\LessonBlock;
use App\Models\LessonBlockCompletion;
use App\Models\LessonBlockProgress;
use App\Models\LessonBlockVariant;
use App\Models\LessonGrammarItemProgress;
use App\Models\LessonPage;
use App\Models\User;
use App\Services\CourseLearningGuide;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;

class CourseLearningGuideTest extends CoursePathTest
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::table('users', fn ($t) => $t->timestamps());
        (require database_path('migrations/2026_10_17_000001_add_course_target_score_to_users.php'))->up();
        (require database_path('migrations/2026_09_25_000001_create_app_settings_table.php'))->up();
        Schema::table('user_dictionary_words', function ($t) {
            foreach (['last_shown', 'last_shown_revert'] as $key) {
                $t->timestamp($key)->nullable();
            }
            foreach (['mode_education', 'mode_education_revert'] as $key) {
                $t->boolean($key)->default(false);
            }
            foreach (['cooldown_tier', 'cooldown_tier_revert'] as $key) {
                $t->integer($key)->default(0);
            }
        });
        DB::table('users')->insert(['id' => 100]);
    }

    private function request(array $data = [], string $method = 'GET'): Request
    {
        $r = Request::create('/api/course', $method, $data);
        $r->setUserResolver(fn () => User::findOrFail(100));

        return $r;
    }

    private function task(CourseGroup $group, string $skill = 'grammar', int $position = 0): LessonBlock
    {
        $page = LessonPage::firstOrCreate(['slug' => 'guide-'.$group->id.'-'.$skill], ['title' => 'Guide',
            'course_group_id' => $group->id, 'skill' => $skill, 'status' => 'published', 'level' => $group->level, 'is_published' => true]);
        $block = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => $skill, 'is_required' => true, 'position' => $position]);
        LessonBlockVariant::create(['lesson_block_id' => $block->id, 'position' => 1, 'is_published' => true,
            'config' => ['task_kind' => $skill === 'grammar' ? 'grammar_gap' : 'binary', 'questions' => [['prompt' => 'Es {{blank}}.', 'accepted_answers' => ['esmu']]]]]);

        return $block;
    }

    private function next(): array
    {
        return app(CourseLearningController::class)->show($this->request(), new CourseLearningGuide)->getData(true)['data'];
    }

    public function test_course_response_averages_practice_without_changing_saved_scores(): void
    {
        $group = CourseGroup::create(['title' => 'Practice average', 'level' => 'A1']);
        foreach (['grammar' => 90, 'listening' => 20, 'reading' => 20, 'writing' => 20, 'speaking' => 20] as $skill => $score) {
            $block = $this->task($group, $skill);
            LessonBlockProgress::create(['user_id' => 100, 'lesson_block_id' => $block->id, 'best_score' => $score]);
        }
        $before = LessonBlockProgress::orderBy('id')->get()->toJson();
        $levels = (new CourseController)->index($this->request())->getData(true)['data'];
        $learning = collect($levels)->flatMap(fn ($level) => $level['groups'])->firstWhere('id', $group->id)['learning'];
        $this->assertSame(20, $learning['parts']['practice']);
        $this->assertSame(20, $learning['percent']);
        $this->assertSame('listening', $this->next()['next']['skill']);
        $this->assertSame($before, LessonBlockProgress::orderBy('id')->get()->toJson());
    }

    public function test_each_click_rechecks_scores_and_cooldowns_and_searches_all_types_in_oldest_group(): void
    {
        $group = CourseGroup::create(['title' => 'First', 'level' => 'A1']);
        $grammar = $this->task($group);
        $reading = $this->task($group, 'reading');
        $other = CourseGroup::create(['title' => 'Second', 'level' => 'A1', 'position' => 20]);
        $this->task($other);
        $this->assertSame($grammar->id, $this->next()['next']['block_id']);
        LessonBlockProgress::create(['user_id' => 100, 'lesson_block_id' => $grammar->id, 'best_score' => 60, 'next_scored_at' => now()->addHour()]);
        $this->assertSame($reading->id, $this->next()['next']['block_id']);
        LessonBlockProgress::where('lesson_block_id', $grammar->id)->update(['best_score' => 80, 'next_scored_at' => null]);
        $this->assertSame($reading->id, $this->next()['next']['block_id']);
        LessonBlockProgress::create(['user_id' => 100, 'lesson_block_id' => $reading->id, 'best_score' => 80]);
        $this->assertSame($other->id, $this->next()['next']['group_id']);
        $this->assertSame(0, DB::table('lesson_block_attempts')->count());
    }

    public function test_available_queue_matches_continue_order_and_omits_passed_or_waiting_tasks(): void
    {
        $this->travelTo(now()->startOfSecond());
        $first = CourseGroup::create(['title' => 'First', 'level' => 'A1', 'position' => 1]);
        CourseStep::create(['title' => 'First words', 'kind' => 'category', 'level' => 'A1', 'group_id' => $first->id, 'dictionary_id' => 1, 'category_id' => 2]);
        DB::table('dictionary_words')->insert(['id' => 1, 'dictionary_id' => 1]);
        DB::table('dictionary_word_category')->insert(['word_id' => 1, 'category_id' => 3]);
        $grammar = $this->task($first, 'grammar', 1); $grammar->update(['title' => 'Grammar one']);
        $grammarTwo = $this->task($first, 'grammar', 2);
        $listening = $this->task($first, 'listening');
        $reading = $this->task($first, 'reading');
        $writing = $this->task($first, 'writing');
        LessonBlockProgress::create(['user_id' => 100, 'lesson_block_id' => $listening->id, 'best_score' => 80]);
        LessonBlockProgress::create(['user_id' => 100, 'lesson_block_id' => $reading->id, 'best_score' => 20, 'next_scored_at' => now()->addHour()]);
        $second = CourseGroup::create(['title' => 'Second', 'level' => 'A1', 'position' => 2]);
        $later = $this->task($second);
        $state = $this->next();
        $this->assertSame($state['next'], $state['available'][0]);
        $this->assertSame(['words', 'grammar', 'grammar', 'writing', 'grammar'], array_column($state['available'], 'skill'));
        $this->assertSame([$grammar->id, $grammarTwo->id, $writing->id, $later->id], array_column($state['available'], 'block_id'));
        $this->assertSame('First words', $state['available'][0]['title']);
        $this->assertSame('Grammar one', $state['available'][1]['title']);
        $this->assertSame(0, $state['available'][1]['percent']);
        $this->assertSame($second->id, $state['available'][4]['group_id']);
        $this->assertSame(0, DB::table('lesson_block_attempts')->count());
        $this->travel(61)->minutes();
        $this->assertContains($reading->id, array_column($this->next()['available'], 'block_id'));
    }

    public function test_queue_respects_active_groups_and_returns_empty_with_rest(): void
    {
        for ($i = 0; $i < 4; $i++) {
            $group = CourseGroup::create(['title' => 'Group '.$i, 'level' => 'A1', 'position' => $i]);
            $blocks[] = $this->task($group);
        }
        $state = $this->next();
        $this->assertSame(array_map(fn ($b) => $b->id, array_slice($blocks, 0, 3)), array_column($state['available'], 'block_id'));
        foreach (array_slice($blocks, 0, 3) as $block) {
            LessonBlockProgress::create(['user_id' => 100, 'lesson_block_id' => $block->id, 'best_score' => 0, 'next_scored_at' => now()->addHour()]);
        }
        $waiting = $this->next();
        $this->assertSame('rest', $waiting['status']); $this->assertSame([], $waiting['available']);
        $this->assertNull($waiting['next']); $this->assertNotNull($waiting['next_available_at']);
    }

    public function test_rest_does_not_expand_past_the_debt_limit_and_becomes_ready_when_time_passes(): void
    {
        $this->travelTo(now()->startOfSecond());
        for ($i = 0; $i < 4; $i++) {
            $group = CourseGroup::create(['title' => 'Group '.$i, 'level' => 'A1', 'position' => $i]);
            $block = $this->task($group);
            if ($i < 3) {
                LessonBlockProgress::create(['user_id' => 100, 'lesson_block_id' => $block->id, 'best_score' => 0, 'next_scored_at' => now()->addHours($i + 1)]);
            }
        }
        $state = $this->next();
        $this->assertSame('rest', $state['status']);
        $this->assertNull($state['next']);
        $this->assertSame(now()->addHour()->toIso8601String(), $state['next_available_at']);
        $this->travel(61)->minutes();
        $this->assertSame('ready', $this->next()['status']);
    }

    public function test_words_are_first_but_ready_grammar_is_used_when_both_word_directions_are_waiting(): void
    {
        $group = CourseGroup::create(['title' => 'Words', 'level' => 'A1']);
        CourseStep::create(['title' => 'Words', 'kind' => 'category', 'level' => 'A1', 'group_id' => $group->id, 'dictionary_id' => 1, 'category_id' => 2]);
        DB::table('dictionary_words')->insert(['id' => 1, 'dictionary_id' => 1]);
        DB::table('dictionary_word_category')->insert(['word_id' => 1, 'category_id' => 3]);
        $grammar = $this->task($group);
        $this->assertSame('words', $this->next()['next']['skill']);
        DB::table('user_dictionary_words')->insert(['user_id' => 100, 'dict_word_id' => 1, 'correct_attempts' => 1, 'correct_attempts_revert' => 1,
            'last_shown' => now(), 'last_shown_revert' => now()]);
        $this->assertSame($grammar->id, $this->next()['next']['block_id']);
        DB::table('user_dictionary_words')->where('user_id', 100)->update(['last_shown_revert' => now()->subHours(21)]);
        $this->assertSame('words', $this->next()['next']['skill']);
    }

    public function test_target_is_private_persistent_validated_and_defaults_to_eighty(): void
    {
        $this->assertSame(80, $this->next()['target']);
        app(CourseLearningController::class)->update($this->request(['target' => 90], 'PATCH'));
        $this->assertSame(90, $this->next()['target']);
        DB::table('users')->insert(['id' => 101]);
        $this->assertSame(80, (int) User::findOrFail(101)->course_target_score);
        $this->expectException(ValidationException::class);
        app(CourseLearningController::class)->update($this->request(['target' => 75], 'PATCH'));
    }

    public function test_recommendations_do_not_read_another_learners_completion(): void
    {
        $group = CourseGroup::create(['title' => 'First', 'level' => 'A1']);
        $block = $this->task($group);
        DB::table('users')->insert(['id' => 101]);
        LessonBlockProgress::create(['user_id' => 101, 'lesson_block_id' => $block->id, 'best_score' => 100, 'next_scored_at' => now()->addDay()]);
        $this->assertSame($block->id, $this->next()['next']['block_id']);
        LessonBlockProgress::create(['user_id' => 100, 'lesson_block_id' => $block->id, 'best_score' => 80]);
        $this->assertSame('complete', $this->next()['status']);
        $response = (new CourseController)->index($this->request());
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
    }

    public function test_retired_productive_tasks_do_not_keep_recommending_an_otherwise_finished_group(): void
    {
        $group = CourseGroup::create(['title' => 'Practice', 'level' => 'A1']);
        $kept = $this->task($group, 'writing');
        $retired = $this->task($group, 'writing', 1);
        $retired->variants()->first()->update(['config' => ['task_kind' => 'image_description']]);
        LessonBlockCompletion::create(['user_id' => 100, 'lesson_block_id' => $kept->id, 'completed_at' => now()]);
        $this->assertSame('complete', $this->next()['status']);
        $levels = (new CourseController)->index($this->request())->getData(true)['data'];
        $progress = collect($levels)->flatMap(fn ($level) => $level['groups'])->firstWhere('id', $group->id)['skills']['writing']['progress'];
        $this->assertSame(1, $progress['total']);
        $this->assertSame(1, $progress['passed']);
        $this->assertDatabaseHas('lesson_blocks', ['id' => $retired->id]);
    }

    public function test_anonymous_users_cannot_read_or_change_recommendations(): void
    {
        $this->getJson('/api/course/continue')->assertUnauthorized();
        $this->patchJson('/api/me/course-target', ['target' => 60])->assertUnauthorized();
    }

    public function test_authenticated_http_endpoints_use_the_current_account_and_private_headers(): void
    {
        $this->actingAs(User::findOrFail(100), 'sanctum');
        $this->patchJson('/api/me/course-target', ['target' => 60])->assertOk()->assertJsonPath('data.target', 60);
        $this->getJson('/api/course/continue')->assertOk()->assertJsonPath('data.target', 60)
            ->assertJsonPath('data.available', [])
            ->assertHeader('Cache-Control', 'no-store, private');
        $this->patchJson('/api/me/course-target', ['target' => 200])->assertUnprocessable();
        $this->assertSame(60, User::findOrFail(100)->course_target_score);
    }

    public function test_source_placements_use_original_progress_and_link_to_the_placed_block(): void
    {
        $group = CourseGroup::create(['title' => 'First', 'level' => 'A1']);
        $sourcePage = LessonPage::create(['slug' => 'guide-source', 'title' => 'Source', 'skill' => 'grammar', 'status' => 'published', 'is_published' => true]);
        $source = LessonBlock::create(['lesson_page_id' => $sourcePage->id, 'type' => 'grammar']);
        LessonBlockVariant::create(['lesson_block_id' => $source->id, 'is_published' => true, 'config' => ['task_kind' => 'grammar_gap',
            'questions' => [['prompt' => 'Es {{blank}}.', 'accepted_answers' => ['esmu']]]]]);
        $ordinary = $this->task($group, 'grammar', 10);
        $placed = LessonBlock::create(['lesson_page_id' => $ordinary->lesson_page_id, 'type' => 'grammar', 'source_block_id' => $source->id, 'is_required' => true, 'position' => 1]);
        $this->assertSame($placed->id, $this->next()['next']['block_id']);
        $this->assertStringEndsWith('#lesson-block-'.$placed->id, $this->next()['next']['href']);
        LessonBlockProgress::create(['user_id' => 100, 'lesson_block_id' => $source->id, 'best_score' => 80]);
        $this->assertSame($ordinary->id, $this->next()['next']['block_id']);
    }

    public function test_alphabet_uses_per_item_direction_cooldowns(): void
    {
        foreach (['2026_09_29_000002_create_lesson_grammar_item_progress_table', '2026_09_29_000003_add_reviews_to_lesson_grammar_item_progress'] as $migration) {
            (require database_path('migrations/'.$migration.'.php'))->up();
        }
        $group = CourseGroup::create(['title' => 'Intro', 'level' => 'A1']);
        $block = $this->task($group);
        $block->variants()->first()->update(['config' => ['task_kind' => 'grammar_items', 'items' => [['key' => 'a', 'letter' => 'A', 'hint' => 'a']]]]);
        $this->assertSame('ready', $this->next()['status']);
        LessonGrammarItemProgress::create(['user_id' => 100, 'lesson_block_id' => $block->id, 'item_key' => 'a',
            'direct_correct_attempts' => 1, 'reverse_correct_attempts' => 1,
            'direct_next_review_at' => now()->addHour(), 'reverse_next_review_at' => now()->addHours(2)]);
        $this->assertSame('rest', $this->next()['status']);
        $this->travel(61)->minutes();
        $this->assertSame('ready', $this->next()['status']);
    }

    public function test_an_old_completion_without_a_grade_does_not_invent_eighty_percent_for_reading(): void
    {
        $group = CourseGroup::create(['title' => 'First', 'level' => 'A1']);
        $block = $this->task($group, 'reading');
        LessonBlockCompletion::create(['user_id' => 100, 'lesson_block_id' => $block->id, 'completed_at' => now()]);
        $this->assertSame($block->id, $this->next()['next']['block_id']);
    }
}
