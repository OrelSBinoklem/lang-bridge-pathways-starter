<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\LessonController;
use App\Models\LessonBlock;
use App\Models\LessonPage;
use App\Services\ContentAudit\LatvianLemmaResolver;
use App\Services\LessonProgressService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CoursePracticeSelectionTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('users', fn ($t) => $t->id());
        Schema::create('course_groups', fn ($t) => $t->id());
        foreach (['2026_09_11_000002_create_lesson_pages_table', '2026_09_11_000003_create_lesson_blocks_table',
            '2026_09_11_000005_create_lesson_block_completions_table', '2026_09_22_000001_add_course_skill_lesson_framework',
            '2026_09_25_000001_create_app_settings_table', '2026_09_27_000001_create_grammar_topics_table',
            '2026_09_29_000001_create_lesson_block_responses_table',
            '2026_10_01_000001_add_grammar_stage_references', '2026_10_13_000001_add_pending_assistance_to_lesson_block_progress',
            '2026_10_13_000002_add_practice_variant_archive'] as $migration) {
            (require database_path('migrations/'.$migration.'.php'))->up();
        }
        DB::table('users')->insert(['id' => 5]); DB::table('course_groups')->insert(['id' => 9]);
        $this->app->instance(LatvianLemmaResolver::class, new LatvianLemmaResolver(['words' => []]));
    }

    private function page(string $skill, ?int $group = 9): LessonPage
    {
        return LessonPage::create(['title' => $skill, 'slug' => $skill.'-'.($group ?? 'free'), 'skill' => $skill,
            'course_group_id' => $group, 'learn_lang' => 'lv', 'level' => 'A1', 'status' => 'published', 'is_published' => true]);
    }

    private function variants(LessonPage $page): LessonBlock
    {
        $block = $page->blocks()->create(['type' => $page->skill, 'position' => 0]);
        foreach (['māja dārzs', 'māja dārzs', 'upe laiva', 'ārsts slimnīca', 'ārsts slimnīca'] as $i => $text) {
            $block->variants()->create(['position' => $i, 'title' => 'Original '.($i + 1), 'is_published' => true,
                'config' => $page->skill === 'grammar'
                    ? ['task_kind' => 'grammar_gap', 'questions' => [['prompt' => $text.' {{blank}}.', 'accepted_answers' => ['test']]]]
                    : ['text' => $text, 'audio_url' => '/keep-'.$i.'.mp3']]);
        }
        return $block;
    }

    public function test_dry_run_and_apply_preserve_content_ids_and_non_course_lessons(): void
    {
        $block = $this->variants($this->page('reading'));
        $free = $this->variants($this->page('reading', null));
        $grammar = $this->page('grammar')->blocks()->create(['type' => 'grammar', 'position' => 0]);
        for ($i = 0; $i < 5; $i++) DB::table('lesson_block_variants')->insert(['lesson_block_id' => $grammar->id,
            'position' => $i, 'is_published' => true, 'config' => '{}']);
        $before = DB::table('lesson_block_variants')->orderBy('id')->get(['id', 'lesson_block_id', 'position', 'title', 'config', 'is_published'])->toJson();
        $this->artisan('course:select-practice-variants')->assertSuccessful();
        $this->assertSame(0, DB::table('lesson_block_variants')->whereNotNull('practice_archived_at')->count());
        $this->artisan('course:select-practice-variants', ['--apply' => true])->assertSuccessful();
        $this->assertSame(2, $block->variants()->whereNotNull('practice_archived_at')->count());
        $this->assertSame(0, $free->variants()->whereNotNull('practice_archived_at')->count());
        $this->assertSame(5, $grammar->variants()->whereNull('practice_archived_at')->count());
        $this->assertSame($before, DB::table('lesson_block_variants')->orderBy('id')->get(['id', 'lesson_block_id', 'position', 'title', 'config', 'is_published'])->toJson());
        $archived = DB::table('lesson_block_variants')->pluck('practice_archived_at', 'id')->all();
        $this->artisan('course:select-practice-variants', ['--apply' => true])->assertSuccessful();
        $this->assertSame($archived, DB::table('lesson_block_variants')->pluck('practice_archived_at', 'id')->all());
        $this->assertDatabaseCount('lesson_block_attempts', 0);
    }

    public function test_students_get_three_choices_and_four_navigation_links_without_archived_content(): void
    {
        $page = $this->page('reading'); $block = $this->variants($page);
        $this->page('listening'); $hidden = $this->page('speaking'); $hidden->update(['status' => 'draft']);
        $this->artisan('course:select-practice-variants', ['--apply' => true])->assertSuccessful();
        $available = $block->variants()->whereNull('practice_archived_at')->get();
        $request = Request::create('/api/lessons/'.$page->slug, 'GET', ['variants' => [$block->id => $available[2]->id]]);
        $request->setUserResolver(fn () => (object) ['id' => 5]);
        $data = (new LessonController(new LessonProgressService))->show($request, $page->slug)->getData(true)['data'];
        $this->assertCount(3, $data['blocks'][0]['variants']);
        $this->assertTrue($data['blocks'][0]['practice_variants']);
        $this->assertSame($available[2]->id, $data['blocks'][0]['variant_id']);
        $this->assertCount(4, $data['practice_navigation']);
        $this->assertNull($data['practice_navigation'][3]['slug']);
        $this->assertSame('listening-9', $data['practice_navigation'][0]['slug']);
    }

    public function test_completion_is_scoped_to_the_selected_variant_and_user(): void
    {
        $page = $this->page('writing');
        $block = $this->variants($page);
        $variants = $block->variants()->orderBy('position')->get();
        DB::table('users')->insert(['id' => 6]);
        DB::table('lesson_block_responses')->insert([
            ['user_id' => 5, 'lesson_block_id' => $block->id, 'lesson_block_variant_id' => $variants[0]->id,
                'answer_text' => 'Mana atbilde.', 'status' => 'accepted'],
            ['user_id' => 6, 'lesson_block_id' => $block->id, 'lesson_block_variant_id' => $variants[2]->id,
                'answer_text' => 'Cita atbilde.', 'status' => 'accepted'],
        ]);
        $request = Request::create('/api/lessons/'.$page->slug, 'GET', ['variants' => [$block->id => $variants[2]->id]]);
        $request->setUserResolver(fn () => (object) ['id' => 5]);
        $data = (new LessonController(new LessonProgressService))->show($request, $page->slug)->getData(true)['data'];
        $this->assertFalse($data['blocks'][0]['variant_completed']);
        $this->assertTrue($data['blocks'][0]['variants'][0]['completed']);
        $this->assertFalse($data['blocks'][0]['variants'][2]['completed']);
        $this->assertNull($data['blocks'][0]['last_response']);
    }

    public function test_combined_practice_keeps_original_blocks_and_all_three_variant_choices(): void
    {
        $blocks = [];
        foreach (['listening', 'reading', 'writing', 'speaking'] as $skill) {
            $blocks[] = $this->variants($this->page($skill));
        }
        $foreign = $this->variants($this->page('reading', null));
        $request = Request::create('/api/lessons/speaking-9', 'GET', ['combined' => 1]);
        $request->setUserResolver(fn () => (object) ['id' => 5]);
        $data = (new LessonController(new LessonProgressService))->show($request, 'speaking-9')->getData(true)['data'];
        $this->assertTrue($data['combined_practice']);
        $this->assertSame(array_map(fn ($b) => $b->id, $blocks), array_column($data['blocks'], 'id'));
        $this->assertSame(['listening','reading','writing','speaking'], array_column($data['blocks'], 'type'));
        foreach ($data['blocks'] as $block) $this->assertCount(3, $block['variants']);
        $this->assertNotContains($foreign->id, array_column($data['blocks'], 'id'));
        $this->assertDatabaseCount('lesson_block_attempts', 0);
    }

    public function test_retired_tasks_stay_in_storage_but_do_not_count_towards_completion_or_rank(): void
    {
        $page = $this->page('writing');
        $kept = $this->variants($page);
        foreach (['image_description','question_formation'] as $index => $kind) {
            $block = $page->blocks()->create(['type' => 'writing', 'position' => $index + 1, 'is_required' => true]);
            $block->variants()->create(['position' => 0, 'is_published' => true, 'config' => ['task_kind' => $kind]]);
            $this->assertNull($block->trainingBlock());
        }
        $request = Request::create('/api/lessons/writing-9');
        $request->setUserResolver(fn () => (object) ['id' => 5]);
        $data = (new LessonController(new LessonProgressService))->show($request, 'writing-9')->getData(true)['data'];
        $this->assertSame([$kept->id], array_column($data['blocks'], 'id'));
        $this->assertSame(1, $data['skill_progress']['total']);
        $this->assertSame(1, $data['practice_variant_ranks'][0]['total']);
        $this->assertDatabaseCount('lesson_blocks', 3);
        $free = $this->page('speaking', null)->blocks()->create(['type' => 'speaking', 'position' => 0, 'config' => ['task_kind' => 'question_formation']]);
        $this->assertFalse($free->isRetiredCoursePractice());
    }

    public function test_grammar_selection_is_opt_in_diverse_idempotent_and_preserves_all_content(): void
    {
        $reading = $this->variants($this->page('reading'));
        $grammar = $this->variants($this->page('grammar', null));
        $alphabetPage = LessonPage::create(['title' => 'Alphabet', 'slug' => 'grammar-a1-alphabet',
            'skill' => 'grammar', 'learn_lang' => 'lv', 'status' => 'published', 'is_published' => true]);
        $alphabet = $this->variants($alphabetPage);
        $items = $grammar->page->blocks()->create(['type' => 'grammar', 'position' => 1]);
        $items->variants()->create(['position' => 0, 'is_published' => true, 'config' => [
            'task_kind' => 'grammar_items', 'items' => [['key' => 'a', 'letter' => 'A', 'hint' => 'a']],
        ]]);
        $before = DB::table('lesson_block_variants')->orderBy('id')->get(['id', 'lesson_block_id', 'position', 'title', 'config', 'is_published'])->toJson();
        $this->artisan('course:select-practice-variants', ['--grammar' => true])->assertSuccessful();
        $this->assertSame(0, DB::table('lesson_block_variants')->whereNotNull('practice_archived_at')->count());
        $this->artisan('course:select-practice-variants', ['--grammar' => true, '--apply' => true])->assertSuccessful();
        $ids = $grammar->variants()->orderBy('position')->pluck('id')->all();
        $this->assertSame([$ids[0], $ids[2], $ids[3]], $grammar->variants()->whereNull('practice_archived_at')->orderBy('position')->pluck('id')->all());
        $this->assertSame(0, $reading->variants()->whereNotNull('practice_archived_at')->count());
        $this->assertSame(0, $alphabet->variants()->whereNotNull('practice_archived_at')->count());
        $this->assertSame(0, $items->variants()->whereNotNull('practice_archived_at')->count());
        $this->assertSame($before, DB::table('lesson_block_variants')->orderBy('id')->get(['id', 'lesson_block_id', 'position', 'title', 'config', 'is_published'])->toJson());
        $archive = DB::table('lesson_block_variants')->pluck('practice_archived_at', 'id')->all();
        $this->artisan('course:select-practice-variants', ['--grammar' => true, '--apply' => true])->assertSuccessful();
        $this->assertSame($archive, DB::table('lesson_block_variants')->pluck('practice_archived_at', 'id')->all());
        $this->assertDatabaseCount('lesson_block_attempts', 0);
    }
}
