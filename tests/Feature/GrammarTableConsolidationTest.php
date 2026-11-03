<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\GrammarTopicController;
use App\Models\GrammarTopic;
use App\Models\LessonPage;
use App\Services\GrammarTableBindings;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class GrammarTableConsolidationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('users', fn ($table) => $table->id());
        Schema::create('course_groups', fn ($table) => $table->id());
        foreach (['2026_09_11_000002_create_lesson_pages_table', '2026_09_11_000003_create_lesson_blocks_table',
            '2026_09_11_000005_create_lesson_block_completions_table', '2026_09_22_000001_add_course_skill_lesson_framework',
            '2026_09_27_000001_create_grammar_topics_table', '2026_10_01_000001_add_grammar_stage_references'] as $migration) {
            (require database_path("migrations/$migration.php"))->up();
        }
        DB::table('users')->insert(['id' => 5]);
    }

    private function source(): LessonPage
    {
        $page = LessonPage::create(['slug' => 'grammar-a1-negation-patterns', 'title' => 'Negation', 'level' => 'A1',
            'learn_lang' => 'lv', 'skill' => 'grammar', 'status' => 'published', 'is_published' => true]);
        $page->grammarTopic()->create(['rule' => 'Author rule', 'examples' => [], 'table_keys' => ['negationPatterns']]);
        foreach (['negation-verb', 'negation-but', 'negation-possession'] as $index => $stage) {
            $page->blocks()->create(['type' => 'grammar', 'title' => $stage, 'position' => $index,
                'is_required' => true, 'seed_key' => $page->slug.'-'.$stage]);
        }
        return $page->fresh(['blocks', 'grammarTopic']);
    }

    public function test_catalog_removes_31_cards_and_has_only_valid_replacements(): void
    {
        $bindings = app(GrammarTableBindings::class);
        $catalog = $bindings->catalog();
        $this->assertCount(31, $catalog['retired']);
        $this->assertCount(2, $catalog['kept']);
        $active = array_keys(GrammarTopic::tableOptions());
        $this->assertEmpty(array_intersect(array_keys($catalog['retired']), $active));
        foreach ($catalog['retired'] as $key => $entry) {
            $resolved = $bindings->resolve([$key]);
            $this->assertNotEmpty($resolved);
            $this->assertEmpty(array_diff($resolved, $active));
            $this->assertSame($resolved, $bindings->resolve($resolved));
        }
        $this->assertEmpty(array_diff($catalog['kept'], $active));
    }

    public function test_age_exercises_move_to_questions_without_changing_their_rule(): void
    {
        $page = LessonPage::create(['slug' => 'grammar-a1-age-dative', 'title' => 'Age', 'level' => 'A1',
            'learn_lang' => 'lv', 'skill' => 'grammar', 'status' => 'published', 'is_published' => true]);
        $page->grammarTopic()->create(['rule' => 'Original age rule', 'examples' => [], 'table_keys' => ['ageDative']]);
        $block = $page->blocks()->create(['type' => 'grammar', 'title' => 'Age forms',
            'seed_key' => $page->slug.'-age-forms']);
        $this->assertSame(['questionsChart'], $page->grammarTopic->table_keys);
        $this->artisan('grammar:consolidate-tables', ['--apply' => true])->assertExitCode(0);
        $this->assertSame(['questionsChart'], $block->fresh()->config['grammar_extension']['table_keys']);
        $this->assertTrue(app(GrammarTableBindings::class)->forBlock($block->fresh())['is_extension']);
        $this->assertSame('Original age rule', $page->grammarTopic->fresh()->rule);
    }

    public function test_modal_and_vajag_exercises_share_one_table_and_keep_source_rules(): void
    {
        foreach (['modalInfinitive' => 'grammar-a1-modal-infinitive', 'necessityVajag' => 'grammar-a2-necessity-vajag'] as $key => $slug) {
            $page = LessonPage::create(['slug' => $slug, 'title' => $slug, 'level' => 'A1',
                'learn_lang' => 'lv', 'skill' => 'grammar', 'status' => 'published', 'is_published' => true]);
            $topic = $page->grammarTopic()->create(['rule' => $slug.' original rule', 'examples' => [], 'table_keys' => []]);
            DB::table('grammar_topics')->where('id', $topic->id)->update(['table_keys' => json_encode([$key])]);
            $block = $page->blocks()->create(['type' => 'grammar', 'title' => 'Original stage', 'seed_key' => $slug.'-stage']);
            $this->artisan('grammar:consolidate-tables', ['--apply' => true])->assertExitCode(0);
            $this->assertSame(['patikInfinitive'], $topic->fresh()->table_keys);
            $this->assertSame(['patikInfinitive'], $block->fresh()->config['grammar_extension']['table_keys']);
            $this->assertSame($slug.' original rule', $topic->fresh()->rule);
            $this->assertSame('Original stage', $block->fresh()->title);
        }
    }

    public function test_stage_bindings_and_badges_are_inherited_by_group_placements(): void
    {
        $page = $this->source();
        $bindings = app(GrammarTableBindings::class);
        $this->assertSame(['verbEndingsPresent'], $bindings->forBlock($page->blocks[0])['grammar_table_keys']);
        $this->assertSame(['verbsTablesContainer'], $bindings->forBlock($page->blocks[1])['grammar_table_keys']);
        $this->assertSame(['possessionIrNav'], $bindings->forBlock($page->blocks[2])['grammar_table_keys']);
        $placement = LessonPage::create(['slug' => 'group', 'title' => 'Group', 'level' => 'A1',
            'learn_lang' => 'lv', 'skill' => 'grammar', 'status' => 'published', 'is_published' => true])
            ->blocks()->create(['type' => 'grammar', 'source_block_id' => $page->blocks[2]->id]);
        $this->assertSame($bindings->forBlock($page->blocks[2]), $bindings->forBlock($placement));
        $request = Request::create('/api/grammar-topics');
        $request->setUserResolver(fn () => (object) ['id' => 5]);
        $result = app(GrammarTopicController::class)->index($request)->getData(true)['data'][0];
        $this->assertTrue($result['has_extensions']);
        $this->assertTrue($result['blocks'][0]['is_extension']);
        $this->assertSame(['verbEndingsPresent'], $result['blocks'][0]['grammar_table_keys']);
    }

    public function test_command_is_dry_by_default_idempotent_and_keeps_author_content(): void
    {
        $page = $this->source();
        $before = $page->blocks->pluck('id')->all();
        $this->artisan('grammar:consolidate-tables')->assertExitCode(0);
        $this->assertNull($page->blocks[0]->fresh()->config);
        $this->artisan('grammar:consolidate-tables', ['--apply' => true])->assertExitCode(0);
        $this->assertTrue(app(GrammarTableBindings::class)->forBlock($page->blocks[0]->fresh())['is_extension']);
        $first = DB::table('lesson_blocks')->get()->toJson();
        $this->artisan('grammar:consolidate-tables', ['--apply' => true])->assertExitCode(0);
        $this->assertSame($first, DB::table('lesson_blocks')->get()->toJson());
        $this->assertSame($before, $page->fresh()->blocks->pluck('id')->all());
        $this->assertSame('Author rule', $page->grammarTopic->fresh()->rule);
    }
}
