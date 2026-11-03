<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\GrammarTopicController;
use App\Http\Controllers\Api\LessonController;
use App\Models\LessonBlock;
use App\Models\LessonBlockAttempt;
use App\Models\LessonBlockProgress;
use App\Models\LessonPage;
use App\Services\GrammarTask;
use App\Services\LessonProgressService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class GrammarStageReferenceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('users', fn ($table) => $table->id());
        Schema::create('course_groups', function ($table) {
            $table->id(); $table->string('seed_key'); $table->string('level')->default('A1');
        });
        foreach (['2026_09_11_000002_create_lesson_pages_table', '2026_09_11_000003_create_lesson_blocks_table',
            '2026_09_11_000005_create_lesson_block_completions_table', '2026_09_22_000001_add_course_skill_lesson_framework',
            '2026_09_25_000001_create_app_settings_table', '2026_09_27_000001_create_grammar_topics_table',
            '2026_09_29_000001_create_lesson_block_responses_table', '2026_09_29_000002_create_lesson_grammar_item_progress_table',
            '2026_09_29_000003_add_reviews_to_lesson_grammar_item_progress', '2026_10_01_000001_add_grammar_stage_references'] as $migration) {
            (require database_path("migrations/$migration.php"))->up();
        }
        DB::table('users')->insert([['id' => 5], ['id' => 9]]);
        DB::table('course_groups')->insert([
            ['id' => 2, 'seed_key' => 'category:20:1775', 'level' => 'A2'],
            ['id' => 15, 'seed_key' => 'category:20:1789', 'level' => 'B1'],
            ['id' => 29, 'seed_key' => 'category:20:1793', 'level' => 'B1'],
            ['id' => 35, 'seed_key' => 'category:20:1795', 'level' => 'B1'],
            ['id' => 28, 'seed_key' => 'category:20:1782', 'level' => 'A2'],
            ['id' => 31, 'seed_key' => 'category:20:1783', 'level' => 'A2'],
            ['id' => 34, 'seed_key' => 'category:20:1784', 'level' => 'A2'],
            ['id' => 37, 'seed_key' => 'category:20:1785', 'level' => 'A2'],
            ['id' => 18, 'seed_key' => 'category:20:1779', 'level' => 'A2'],
            ['id' => 25, 'seed_key' => 'category:20:1781', 'level' => 'A2'],
        ]);
        DB::table('course_groups')->insert([
            ['id' => 6, 'seed_key' => 'category:20:1776', 'level' => 'A2'],
            ['id' => 10, 'seed_key' => 'category:20:1777', 'level' => 'A2'],
            ['id' => 14, 'seed_key' => 'category:20:1778', 'level' => 'A2'],
            ['id' => 22, 'seed_key' => 'category:20:1780', 'level' => 'A2'],
        ]);
        DB::table('course_groups')->insert([['id' => 1, 'seed_key' => 'category:20:1763'], ['id' => 21, 'seed_key' => 'category:20:1768'],
            ['id' => 5, 'seed_key' => 'category:20:1764'], ['id' => 9, 'seed_key' => 'category:20:1765'],
            ['id' => 13, 'seed_key' => 'category:20:1766'], ['id' => 33, 'seed_key' => 'category:20:1772'],
            ['id' => 24, 'seed_key' => 'category:20:1769'], ['id' => 27, 'seed_key' => 'category:20:1770'],
            ['id' => 17, 'seed_key' => 'category:20:1767'], ['id' => 30, 'seed_key' => 'category:20:1771'],
            ['id' => 36, 'seed_key' => 'category:20:1773'], ['id' => 38, 'seed_key' => 'category:20:1774']]);
    }

    private function seedGroups(): void { $this->artisan('grammar:prepare-groups', ['--write' => true])->assertExitCode(0); }
    private function request(int $id = 5, array $data = []): Request
    {
        $request = Request::create('/api/lessons/test', 'POST', $data);
        $request->setUserResolver(fn () => (object) ['id' => $id]);
        return $request;
    }
    private function controller(): LessonController { return new LessonController(new LessonProgressService); }

    public function test_import_validates_original_variants_and_preserves_admin_edits(): void
    {
        $this->artisan('grammar:prepare-groups')->assertExitCode(0);
        $this->assertSame(0, LessonPage::count());
        $this->seedGroups();
        $this->assertSame(4, LessonPage::count());
        $this->assertSame(12, LessonBlock::count());
        $this->assertSame(30, \App\Models\LessonBlockVariant::count());
        foreach (\App\Models\LessonBlockVariant::all() as $variant) {
            $answers = array_column($variant->config['questions'], 'accepted_answers');
            $this->assertCount(5, $answers);
            $this->assertTrue(collect(GrammarTask::grade($variant->config, array_column($answers, 0)))->every('is_correct'));
            $this->assertArrayNotHasKey('accepted_answers', GrammarTask::clientConfig($variant->config)['questions'][0]);
        }
        $page = LessonPage::where('slug', 'grammar-course-1765-a1')->firstOrFail();
        $this->assertSame(9, $page->course_group_id);
        $this->assertTrue($page->blocks->every(fn ($block) => $block->source_block_id && $block->variants->isEmpty()));
        $page->update(['title' => 'Admin title']);
        $source = LessonBlock::whereNotNull('source_block_id')->first()->sourceBlock;
        $variant = $source->variants->first();
        $variant->update(['title' => 'Admin variant']);
        $this->seedGroups();
        $this->assertSame('Admin title', $page->fresh()->title);
        $this->assertSame('Admin variant', $variant->fresh()->title);
        $this->assertSame(30, \App\Models\LessonBlockVariant::count());
    }

    public function test_one_stage_is_embedded_without_siblings_and_shares_score_and_cooldown(): void
    {
        $this->seedGroups();
        $sourcePage = LessonPage::where('slug', 'grammar-a1-city-forms')->firstOrFail();
        $source = $sourcePage->blocks->firstWhere('seed_key', 'grammar-a1-city-forms-accusative-singular');
        $subset = LessonPage::create(['slug' => 'one-stage', 'title' => 'One stage', 'skill' => 'grammar', 'learn_lang' => 'lv', 'status' => 'published', 'is_published' => true]);
        $placement = $subset->blocks()->create(['type' => 'grammar', 'source_block_id' => $source->id, 'title' => 'Only singular']);
        $data = $this->controller()->show($this->request(), 'one-stage')->getData(true)['data'];
        $this->assertCount(1, $data['blocks']);
        $this->assertSame($placement->id, $data['blocks'][0]['id']);
        $this->assertCount(5, $data['blocks'][0]['config']['questions']);
        $this->assertSame(1, $data['grammar_summary']['total']);
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($placement, 5);
        $this->assertSame($service->selectedVariant($source, 5)->id, $variant->id);
        $answers = array_map(fn ($q) => $q['accepted_answers'][0], $variant->config['questions']);
        $result = $this->controller()->submitAttempt($this->request(5, ['variant_id' => $variant->id, 'answers' => $answers, 'cooldown_tier' => 2]), $placement)->getData(true)['data'];
        $this->assertSame(100, $result['score']);
        $this->assertSame(100, $service->progressFor(5, $source)['best_score']);
        $this->assertSame($service->progressFor(5, $source), $service->progressFor(5, $placement));
        $this->assertFalse(LessonBlockProgress::where('lesson_block_id', $placement->id)->exists());
        $this->assertSame($source->id, LessonBlockAttempt::first()->lesson_block_id);
        $freshVariant = $service->selectedVariant($placement, 5);
        $retry = $service->submitGrammarAttempt(5, $placement, $freshVariant->id, array_map(fn ($q) => $q['accepted_answers'][0], $freshVariant->config['questions']), 2);
        $this->assertTrue($retry['is_practice']);
        $this->assertSame(100, $this->controller()->show($this->request(), 'one-stage')->getData(true)['data']['grammar_summary']['score']);
        $summary = $service->summariesForPages(5, collect([$subset->fresh(), $sourcePage->fresh()]));
        $this->assertSame(100, $summary[$subset->id]['best_score']);
        $this->assertSame(25, $summary[$sourcePage->id]['best_score']);
        $this->assertNull($service->progressFor(9, $placement)['best_score']);
        $catalog = (new GrammarTopicController)->index($this->request())->getData(true)['data'];
        $group = collect($catalog)->firstWhere('slug', 'grammar-course-1765-a1');
        $this->assertSame(25, $group['summary']['score']);
        $this->assertSame(100, collect($group['blocks'])->firstWhere('source_block_id', $source->id)['best_score']);
    }

    public function test_unpublished_source_is_not_exposed_or_submittable(): void
    {
        $this->seedGroups();
        $page = LessonPage::where('slug', 'grammar-course-1764-a1')->firstOrFail();
        $placement = $page->blocks->first();
        $variant = $placement->sourceBlock->variants->first();
        $placement->sourceBlock->page->update(['status' => 'draft']);
        $placement->refresh();
        $block = $this->controller()->show($this->request(), $page->slug)->getData(true)['data']['blocks'][0];
        $this->assertNull($block['variant_id']);
        $this->assertSame('unavailable', $block['config']['task_kind']);
        $this->assertFalse($block['completed']);
        try {
            $this->controller()->submitAttempt($this->request(5, ['variant_id' => $variant->id, 'answers' => ['Latvijas']]), $placement);
            $this->fail('Draft source accepted');
        } catch (HttpException $error) { $this->assertSame(404, $error->getStatusCode()); }
        $this->assertSame(0, LessonBlockAttempt::count());
    }

    public function test_references_cannot_be_chained_or_own_variants(): void
    {
        $this->seedGroups();
        $placement = LessonBlock::whereNotNull('source_block_id')->first();
        try {
            $placement->variants()->create(['position' => 0, 'is_published' => false]);
            $this->fail('Reference owns a variant');
        } catch (ValidationException $error) { $this->assertArrayHasKey('lesson_block_id', $error->errors()); }
        $anotherPage = LessonPage::where('slug', 'grammar-course-1765-a1')->firstOrFail();
        $this->expectException(ValidationException::class);
        $anotherPage->blocks()->create(['type' => 'grammar', 'source_block_id' => $placement->id]);
    }

    public function test_reference_items_use_the_original_learning_state(): void
    {
        $this->seedGroups();
        $source = LessonPage::where('slug', 'grammar-a1-city-forms')->first()->blocks()->create(['type' => 'grammar', 'title' => 'Letter']);
        $variant = $source->variants()->create(['position' => 0, 'is_published' => true, 'config' => ['task_kind' => 'grammar_items', 'items' => [['key' => 'k', 'letter' => 'K', 'hint' => 'к']]]]);
        $placement = LessonPage::where('slug', 'grammar-course-1765-a1')->first()->blocks()->create(['type' => 'grammar', 'source_block_id' => $source->id]);
        $request = $this->request(5, ['variant_id' => $variant->id, 'item_key' => 'k', 'direction' => 'direct', 'answer' => 'wrong']);
        $result = $this->controller()->submitGrammarItem($request, $placement)->getData(true)['data'];
        $this->assertFalse($result['is_correct']);
        $row = \App\Models\LessonGrammarItemProgress::first();
        $this->assertSame($source->id, $row->lesson_block_id);
        $this->assertTrue($row->direct_mode_education);
        $this->assertNull($row->direct_next_review_at);
        $service = new LessonProgressService;
        $this->assertSame($service->grammarItemStateFor(5, $source, $variant->config), $service->grammarItemStateFor(5, $placement, $variant->config));
    }

    public function test_targeted_import_does_not_create_other_group_pages(): void
    {
        $this->artisan('grammar:prepare-groups', ['--write' => true, '--category' => '1765'])->assertExitCode(0);
        $this->assertSame(2, LessonPage::count());
        $this->assertFalse(LessonPage::where('slug', 'grammar-course-1764-a1')->exists());
        $this->artisan('grammar:prepare-groups', ['--category' => '9999'])->assertExitCode(1);
    }

    public function test_agreement_package_has_five_balanced_variants_per_stage(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'agreement'])->assertExitCode(0);
        $this->assertSame(0, LessonPage::count());
        $this->artisan('grammar:prepare-groups', ['--package' => '../invalid'])->assertExitCode(1);
        $this->seedGroups();
        $this->artisan('grammar:prepare-groups', ['--package' => 'agreement', '--write' => true])->assertExitCode(0);
        $page = LessonPage::where('slug', 'grammar-a1-noun-adjective-agreement')->firstOrFail();
        $this->assertSame(['adjEndings', 'declensions'], $page->grammarTopic->table_keys);
        $this->assertCount(3, $page->blocks);
        $suffixes = ['agreement-nominative' => ['s', 'a', 'i', 'as'],
            'agreement-accusative' => ['u', 'u', 'us', 'as'], 'agreement-locative' => ['ā', 'ā', 'os', 'ās']];
        foreach ($page->blocks as $block) {
            $key = str_replace($page->slug.'-', '', $block->seed_key);
            $this->assertCount(5, $block->variants);
            foreach ($block->variants as $variant) {
                $questions = $variant->config['questions'];
                $this->assertCount(5, $questions);
                foreach (array_slice($questions, 0, 4) as $index => $question) {
                    preg_match('/\((liels|mazs|skaists|vecs)\)$/u', $question['prompt'], $match);
                    $this->assertNotEmpty($match);
                    $stem = mb_substr($match[1], 0, -1);
                    $this->assertSame($stem.$suffixes[$key][$index], $question['accepted_answers'][0]);
                }
                $answers = array_map(fn ($q) => $q['accepted_answers'][0], $questions);
                $this->assertTrue(collect(GrammarTask::grade($variant->config, $answers))->every('is_correct'));
                foreach (GrammarTask::clientConfig($variant->config)['questions'] as $question) {
                    $this->assertArrayNotHasKey('accepted_answers', $question);
                    $this->assertArrayNotHasKey('explanation', $question);
                }
            }
        }
    }

    public function test_a1_pack_imports_all_sources_into_two_groups_and_preserves_edits(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-01'])->assertExitCode(0);
        $this->assertSame(0, LessonPage::count());
        $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-01', '--write' => true])->assertExitCode(0);
        $this->assertSame(6, LessonPage::count());
        $this->assertSame(24, LessonBlock::count());
        $this->assertSame(60, \App\Models\LessonBlockVariant::count());
        $package = json_decode(file_get_contents(resource_path('course/grammar-a1-pack-01.json')), true, 512, JSON_THROW_ON_ERROR);
        $audit = collect(json_decode(file_get_contents(resource_path('course/grammar-a1-pack-01-vocabulary.json')), true, 512, JSON_THROW_ON_ERROR)['topics'])->keyBy('slug');
        foreach ($package['topics'] as $topic) {
            $words = $audit[$topic['slug']]['words'];
            $this->assertSame($topic['provenance']['target_lemmas'], array_column($words, 'word'));
            $this->assertTrue(collect($words)->every(fn ($word) => count($word['word_ids']) > 0
                && (in_array('current_category', $word['sources'], true) || in_array('previous_course', $word['sources'], true))));
        }
        foreach (LessonBlock::whereNull('source_block_id')->with('variants')->get() as $block) {
            $fingerprints = $block->variants->map(function ($variant) {
                $questions = array_map(fn ($q) => $q['prompt'].'|'.json_encode($q['accepted_answers']), $variant->config['questions']);
                sort($questions);
                return implode("\n", $questions);
            });
            $this->assertCount(5, $fingerprints->unique(), 'Variants must differ beyond question order');
        }
        foreach (\App\Models\LessonBlockVariant::all() as $variant) {
            $this->assertCount(5, $variant->config['questions']);
            $answers = array_map(fn ($q) => $q['accepted_answers'][0], $variant->config['questions']);
            $this->assertTrue(collect(GrammarTask::grade($variant->config, $answers))->every('is_correct'));
            foreach (GrammarTask::clientConfig($variant->config)['questions'] as $question) {
                $this->assertArrayNotHasKey('accepted_answers', $question);
                $this->assertArrayNotHasKey('explanation', $question);
            }
        }
        foreach ([1766 => ['genitivs', 'possessionIrNav'], 1772 => ['patikInfinitive', 'prepositions', 'declensions']] as $category => $keys) {
            $page = LessonPage::where('slug', "grammar-course-$category-a1")->firstOrFail();
            $this->assertSame($keys, $page->grammarTopic->table_keys);
            $this->assertCount(6, $page->blocks);
            $this->assertSame(range(0, 5), $page->blocks->pluck('position')->all());
            $this->assertTrue($page->blocks->every(fn ($block) => $block->source_block_id && $block->variants->isEmpty()));
            $this->assertCount(2, $page->blocks->map(fn ($block) => $block->sourceBlock->lesson_page_id)->unique());
            $this->assertSame(6, $this->controller()->show($this->request(), $page->slug)->getData(true)['data']['grammar_summary']['total']);
            $page->update(['title' => 'Admin title '.$category]);
            $page->grammarTopic->update(['rule' => 'Admin rule '.$category]);
        }
        $placement = LessonPage::where('slug', 'grammar-course-1766-a1')->first()->blocks->first();
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($placement, 5);
        $answers = array_map(fn ($q) => $q['accepted_answers'][0], $variant->config['questions']);
        $service->submitGrammarAttempt(5, $placement, $variant->id, $answers, 2);
        $before = $service->progressFor(5, $placement);
        $this->assertSame(17, $this->controller()->show($this->request(), 'grammar-course-1766-a1')->getData(true)['data']['grammar_summary']['score']);
        $variant->update(['title' => 'Admin variant']);
        foreach ([false, true] as $append) {
            $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-01', '--write' => true, '--append-stages' => $append])->assertExitCode(0);
            $this->assertSame(24, LessonBlock::count());
            $this->assertSame(60, \App\Models\LessonBlockVariant::count());
            $this->assertSame($before, $service->progressFor(5, $placement));
            $this->assertSame('Admin variant', $variant->fresh()->title);
            foreach ([1766, 1772] as $category) {
                $page = LessonPage::where('slug', "grammar-course-$category-a1")->first();
                $this->assertSame('Admin title '.$category, $page->title);
                $this->assertSame('Admin rule '.$category, $page->grammarTopic->rule);
            }
        }
        $this->assertSame(1, LessonBlockAttempt::count());
    }

    public function test_a1_pack_targeted_import_includes_both_source_tables_but_not_other_group(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-01', '--category' => '1766', '--write' => true])->assertExitCode(0);
        $this->assertSame(3, LessonPage::count());
        $this->assertSame(30, \App\Models\LessonBlockVariant::count());
        $this->assertSame(6, LessonPage::where('slug', 'grammar-course-1766-a1')->first()->blocks()->count());
        $this->assertFalse(LessonPage::where('slug', 'grammar-course-1772-a1')->exists());
    }

    public function test_agreement_stage_is_appended_only_explicitly_without_replacing_progress(): void
    {
        $this->seedGroups();
        $group = LessonPage::where('slug', 'grammar-course-1765-a1')->firstOrFail();
        $oldIds = $group->blocks()->orderBy('position')->pluck('id')->all();
        $source = $group->blocks->first()->sourceBlock;
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($source, 5);
        $service->submitGrammarAttempt(5, $source, $variant->id, array_map(fn ($q) => $q['accepted_answers'][0], $variant->config['questions']), 2);
        $progress = $service->progressFor(5, $source);
        $group->update(['title' => 'Admin group']);
        $group->grammarTopic->update(['rule' => 'Admin rule']);
        $group->blocks->first()->update(['title' => 'Admin stage']);

        $this->artisan('grammar:prepare-groups', ['--package' => 'agreement', '--append-stages' => true])->assertExitCode(0);
        $this->assertSame(4, LessonPage::count());
        $this->artisan('grammar:prepare-groups', ['--package' => 'agreement', '--write' => true])->assertExitCode(0);
        $this->assertSame(4, $group->blocks()->count());
        $this->artisan('grammar:prepare-groups', ['--package' => 'agreement', '--write' => true, '--append-stages' => true])->assertExitCode(0);
        $group->refresh();
        $this->assertSame('Admin group', $group->title);
        $this->assertSame('Admin rule', $group->grammarTopic->rule);
        $this->assertSame('Admin stage', $group->blocks->first()->title);
        $this->assertSame($oldIds, $group->blocks()->orderBy('position')->limit(4)->pluck('id')->all());
        $this->assertCount(5, $group->blocks);
        $this->assertSame($progress, $service->progressFor(5, $source));
        $this->assertContains('adjEndings', $group->grammarTopic->table_keys);
        $added = $group->blocks()->reorder('position', 'desc')->first();
        $this->assertSame('grammar-a1-noun-adjective-agreement-agreement-nominative', $added->sourceBlock->seed_key);
        $this->assertCount(0, $added->variants);
        $lesson = $this->controller()->show($this->request(), $group->slug)->getData(true)['data'];
        $extended = collect($lesson['blocks'])->firstWhere('id', $added->id);
        $this->assertTrue($extended['is_extension']);
        $this->assertSame(['adjEndings', 'declensions'], $extended['grammar_table_keys']);
        $this->assertSame(20, $this->controller()->show($this->request(), $group->slug)->getData(true)['data']['grammar_summary']['score']);
        $this->artisan('grammar:prepare-groups', ['--package' => 'agreement', '--write' => true, '--append-stages' => true])->assertExitCode(0);
        $this->assertSame(5, $group->blocks()->count());
        $this->assertSame(1, LessonBlockAttempt::count());
    }

    public function test_second_pack_has_original_variants_traced_vocabulary_and_correct_forms(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-02'])->assertExitCode(0);
        $this->assertSame(0, LessonPage::count());
        $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-02', '--write' => true])->assertExitCode(0);
        $this->assertSame(7, LessonPage::count());
        $this->assertSame(24, LessonBlock::count());
        $this->assertSame(60, \App\Models\LessonBlockVariant::count());
        $package = json_decode(file_get_contents(resource_path('course/grammar-a1-pack-02.json')), true, 512, JSON_THROW_ON_ERROR);
        $audit = collect(json_decode(file_get_contents(resource_path('course/grammar-a1-pack-02-vocabulary.json')), true, 512, JSON_THROW_ON_ERROR)['topics'])->keyBy('slug');
        foreach ($package['topics'] as $topic) {
            $words = $audit[$topic['slug']]['words'];
            $this->assertSame($topic['provenance']['target_lemmas'], array_column($words, 'word'));
            $this->assertNotEmpty($topic['provenance']['foundation_lemmas']);
            $this->assertTrue(collect($words)->every(fn ($word) => count($word['word_ids']) > 0
                && (in_array('current_category', $word['sources'], true) || in_array('previous_course', $word['sources'], true))));
        }
        $questions = 0;
        foreach (LessonBlock::whereNull('source_block_id')->with('variants')->get() as $block) {
            $this->assertCount(5, $block->variants);
            $fingerprints = [];
            foreach ($block->variants as $variant) {
                $config = $variant->config;
                $this->assertCount(5, $config['questions']);
                $parts = [];
                foreach ($config['questions'] as $q) {
                    $questions++;
                    $parts[] = $q['prompt'].'|'.json_encode($q['accepted_answers']);
                    foreach ($q['accepted_answers'] as $answer) {
                        $this->assertTrue(GrammarTask::grade(['task_kind' => $config['task_kind'], 'questions' => [$q]], [$answer])[0]['is_correct']);
                    }
                    if ($config['task_kind'] === 'grammar_correct') $this->assertFalse(GrammarTask::grade(
                        ['task_kind' => $config['task_kind'], 'questions' => [$q]], [$q['prompt']])[0]['is_correct']);
                }
                sort($parts);
                $fingerprints[] = implode("\n", $parts);
                foreach (GrammarTask::clientConfig($config)['questions'] as $q) {
                    $this->assertArrayNotHasKey('accepted_answers', $q);
                    $this->assertArrayNotHasKey('explanation', $q);
                }
                if (str_ends_with($block->seed_key, '-but-negative')) {
                    foreach ($config['questions'] as $q) $this->assertContains($q['accepted_answers'][0], ['neesmu', 'neesi', 'nav', 'neesam', 'neesat']);
                }
                if (str_ends_with($block->seed_key, '-determiner-accusative')) {
                    foreach ($config['questions'] as $q) {
                        $this->assertContains($q['accepted_answers'][0], ['to', 'tos', 'tās']);
                        if (str_contains($q['prompt'], 'mājas')) $this->assertSame(['tās'], $q['accepted_answers']);
                    }
                }
            }
            $this->assertCount(5, array_unique($fingerprints));
        }
        $this->assertSame(300, $questions);
        foreach ([1763 => [1, 6], 1765 => [9, 3], 1768 => [21, 3]] as $category => [$id, $count]) {
            $page = LessonPage::where('slug', "grammar-course-$category-a1")->firstOrFail();
            $this->assertSame($id, $page->course_group_id);
            $this->assertSame($count, $page->blocks->count());
            $this->assertTrue($page->blocks->every(fn ($b) => $b->source_block_id && $b->variants->isEmpty()));
            $this->assertSame($count, $this->controller()->show($this->request(), $page->slug)->getData(true)['data']['grammar_summary']['total']);
        }
    }

    public function test_third_pack_has_original_variants_traced_vocabulary_and_correct_forms(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-03'])->assertExitCode(0);
        $this->assertSame(0, LessonPage::count());
        $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-03', '--write' => true])->assertExitCode(0);
        $this->assertSame(7, LessonPage::count());
        $this->assertSame(24, LessonBlock::count());
        $this->assertSame(60, \App\Models\LessonBlockVariant::count());
        $package = json_decode(file_get_contents(resource_path('course/grammar-a1-pack-03.json')), true, 512, JSON_THROW_ON_ERROR);
        $audit = collect(json_decode(file_get_contents(resource_path('course/grammar-a1-pack-03-vocabulary.json')), true, 512, JSON_THROW_ON_ERROR)['topics'])->keyBy('slug');
        foreach ($package['topics'] as $topic) {
            $words = $audit[$topic['slug']]['words'];
            $this->assertSame($topic['provenance']['target_lemmas'], array_column($words, 'word'));
            $this->assertNotEmpty($topic['provenance']['foundation_lemmas']);
            $this->assertTrue(collect($words)->every(fn ($word) => count($word['word_ids']) > 0
                && (in_array('current_category', $word['sources'], true) || in_array('previous_course', $word['sources'], true))));
        }
        $questions = 0;
        foreach (LessonBlock::whereNull('source_block_id')->with('variants')->get() as $block) {
            $this->assertCount(5, $block->variants);
            $fingerprints = [];
            foreach ($block->variants as $variant) {
                $config = $variant->config;
                $this->assertCount(5, $config['questions']);
                $parts = [];
                foreach ($config['questions'] as $q) {
                    $questions++;
                    $parts[] = $q['prompt'].'|'.json_encode($q['accepted_answers']);
                    foreach ($q['accepted_answers'] as $answer) {
                        $this->assertTrue(GrammarTask::grade(['task_kind' => $config['task_kind'], 'questions' => [$q]], [$answer])[0]['is_correct']);
                    }
                    if ($config['task_kind'] === 'grammar_correct') $this->assertFalse(GrammarTask::grade(
                        ['task_kind' => $config['task_kind'], 'questions' => [$q]], [$q['prompt']])[0]['is_correct']);
                }
                sort($parts);
                $fingerprints[] = implode("\n", $parts);
                foreach (GrammarTask::clientConfig($config)['questions'] as $q) {
                    $this->assertArrayNotHasKey('accepted_answers', $q);
                    $this->assertArrayNotHasKey('explanation', $q);
                }
                if (str_ends_with($block->seed_key, '-age-years')) {
                    foreach ($config['questions'] as $q) {
                        preg_match('/\\b(\\d+)\\b/u', $q['prompt'], $match);
                        $n = (int) $match[1];
                        $both = ($n >= 10 && $n <= 19) || $n % 10 === 0;
                        $expected = $both ? ['gadu', 'gadi'] : ($n % 10 === 1 ? ['gads'] : ['gadi']);
                        $this->assertSame($expected, $q['accepted_answers']);
                        foreach (array_diff(['gads', 'gadi', 'gadu'], $expected) as $wrong) {
                            $this->assertFalse(GrammarTask::grade(['task_kind' => 'grammar_select', 'questions' => [$q]], [$wrong])[0]['is_correct']);
                        }
                    }
                }
                if (str_ends_with($block->seed_key, '-object-adjective')) {
                    foreach ($config['questions'] as $q) {
                        if (preg_match('/plūmes|vīnogas|zemenes/u', $q['prompt'])) {
                            $this->assertContains($q['accepted_answers'][0], ['lētas', 'dārgas']);
                        }
                    }
                }
            }
            $this->assertCount(5, array_unique($fingerprints));
        }
        $this->assertSame(300, $questions);
        foreach ([1766 => [13, 3], 1769 => [24, 3], 1770 => [27, 6]] as $category => [$id, $count]) {
            $page = LessonPage::where('slug', "grammar-course-$category-a1")->firstOrFail();
            $this->assertSame($id, $page->course_group_id);
            $this->assertSame($count, $page->blocks->count());
            $this->assertTrue($page->blocks->every(fn ($b) => $b->source_block_id && $b->variants->isEmpty()));
            $this->assertSame($count, $this->controller()->show($this->request(), $page->slug)->getData(true)['data']['grammar_summary']['total']);
        }
    }

    public function test_first_b1_pack_has_original_variants_traced_vocabulary_and_private_answers(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'b1-pack-01'])->assertExitCode(0);
        $this->assertSame(0, LessonPage::count());
        $this->artisan('grammar:prepare-groups', ['--package' => 'b1-pack-01', '--write' => true])->assertExitCode(0);
        $this->assertSame(6, LessonPage::count());
        $this->assertSame(18, LessonBlock::count());
        $this->assertSame(45, \App\Models\LessonBlockVariant::count());
        $package = json_decode(file_get_contents(resource_path('course/grammar-b1-pack-01.json')), true, 512, JSON_THROW_ON_ERROR);
        $audit = collect(json_decode(file_get_contents(resource_path('course/grammar-b1-pack-01-vocabulary.json')), true, 512, JSON_THROW_ON_ERROR)['topics'])->keyBy('slug');
        foreach ($package['topics'] as $topic) {
            $this->assertSame('B1', $topic['level']);
            $words = $audit[$topic['slug']]['words'];
            $this->assertSame($topic['provenance']['target_lemmas'], array_column($words, 'word'));
            $this->assertNotEmpty($topic['provenance']['foundation_lemmas']);
            $this->assertTrue(collect($words)->every(fn ($word) => count($word['word_ids']) > 0
                && (in_array('current_category', $word['sources'], true) || in_array('previous_course', $word['sources'], true))));
            $frequency = $audit[$topic['slug']]['frequency_source'];
            $this->assertSame(hash_file('sha256', base_path($frequency['path'])), $frequency['sha256']);
            $this->assertStringNotContainsString('.tmp/', $topic['provenance']['vocabulary_source']);
        }
        $questions = 0;
        foreach (LessonBlock::whereNull('source_block_id')->with('variants')->get() as $block) {
            $this->assertCount(5, $block->variants);
            $fingerprints = [];
            foreach ($block->variants as $variant) {
                $config = $variant->config;
                $this->assertCount(5, $config['questions']);
                $parts = [];
                foreach ($config['questions'] as $question) {
                    $questions++;
                    $parts[] = $question['prompt'].'|'.json_encode($question['accepted_answers']);
                    foreach ($question['accepted_answers'] as $answer) {
                        $this->assertTrue(GrammarTask::grade(['task_kind' => $config['task_kind'], 'questions' => [$question]], [$answer])[0]['is_correct']);
                    }
                    if ($config['task_kind'] === 'grammar_select') foreach ($question['options'] as $answer) {
                        $this->assertSame(in_array($answer, $question['accepted_answers'], true),
                            GrammarTask::grade(['task_kind' => 'grammar_select', 'questions' => [$question]], [$answer])[0]['is_correct']);
                    }
                }
                sort($parts);
                $fingerprints[] = implode("\n", $parts);
                foreach (GrammarTask::clientConfig($config)['questions'] as $question) {
                    $this->assertArrayNotHasKey('accepted_answers', $question);
                    $this->assertArrayNotHasKey('explanation', $question);
                }
            }
            $this->assertCount(5, array_unique($fingerprints));
        }
        $this->assertSame(225, $questions);
        foreach ([1789 => 15, 1793 => 29, 1795 => 35] as $category => $id) {
            $page = LessonPage::where('slug', "grammar-course-$category-b1")->firstOrFail();
            $this->assertSame($id, $page->course_group_id);
            $this->assertCount(3, $page->blocks);
            $this->assertTrue($page->blocks->every(fn ($block) => $block->source_block_id && $block->variants->isEmpty()));
            $this->assertSame(3, $this->controller()->show($this->request(), $page->slug)->getData(true)['data']['grammar_summary']['total']);
        }
    }

    public function test_first_b1_pack_relative_form_depends_on_role_not_antecedent_case(): void
    {
        $topics = collect(json_decode(file_get_contents(resource_path('course/grammar-b1-pack-01.json')), true, 512, JSON_THROW_ON_ERROR)['topics'])->keyBy('slug');
        $blocks = collect($topics['grammar-b1-relative-clause']['blocks'])->keyBy('key');
        $variants = $blocks['relative-form']['variants'];
        $this->assertStringContainsString('autoru,', $variants[0]['config']['questions'][0]['prompt']);
        $this->assertSame(['kurš'], $variants[0]['config']['questions'][0]['accepted_answers']);
        $this->assertStringContainsString('rakstnieci,', $variants[0]['config']['questions'][1]['prompt']);
        $this->assertSame(['kura'], $variants[0]['config']['questions'][1]['accepted_answers']);
        $this->assertSame(['kuru'], $variants[1]['config']['questions'][0]['accepted_answers']);
        $this->assertSame(['kuram'], $variants[1]['config']['questions'][3]['accepted_answers']);
        $this->assertSame(['kurai'], $variants[1]['config']['questions'][4]['accepted_answers']);
        $this->assertSame(['kuriem'], $variants[2]['config']['questions'][0]['accepted_answers']);
        $this->assertSame(['kurām'], $variants[2]['config']['questions'][1]['accepted_answers']);
        $this->assertSame(['kurās'], $variants[2]['config']['questions'][3]['accepted_answers']);
        $this->assertSame(['kuros'], $variants[2]['config']['questions'][4]['accepted_answers']);
        foreach ($blocks['relative-join']['variants'] as $variant) foreach ($variant['config']['questions'] as $question) {
            $this->assertSame(1, substr_count($question['accepted_answers'][0], ','));
            $wrong = str_replace(',', '', $question['accepted_answers'][0]);
            $this->assertFalse(GrammarTask::grade(['task_kind' => 'grammar_order', 'questions' => [$question]], [$wrong])[0]['is_correct']);
        }
        $this->assertStringContainsString('Kas тоже', $topics['grammar-b1-relative-clause']['rule']);
    }

    public function test_first_b1_pack_passive_and_participial_models_have_explicit_limits(): void
    {
        $topics = collect(json_decode(file_get_contents(resource_path('course/grammar-b1-pack-01.json')), true, 512, JSON_THROW_ON_ERROR)['topics'])->keyBy('slug');
        $passive = collect($topics['grammar-b1-passive-agreement']['blocks'])->keyBy('key');
        $forms = $passive['passive-form']['variants'][0]['config']['questions'];
        $this->assertSame(['atjaunots', 'atjaunota', 'atvērti', 'atvērtas', 'celts'], array_map(fn ($q) => $q['accepted_answers'][0], $forms));
        $time = $passive['passive-time']['variants'][0]['config'];
        $this->assertSame(['ir', 'bija', 'būs', 'bija', 'ir'], array_map(fn ($q) => $q['accepted_answers'][0], $time['questions']));
        $this->assertStringContainsString('составного времени', $time['instruction']);
        foreach ($time['questions'] as $q) {
            $this->assertStringContainsString('būt', $q['prompt']);
            $this->assertFalse(GrammarTask::grade(['task_kind' => 'grammar_gap', 'questions' => [$q]], ['tiek'])[0]['is_correct']);
        }
        $models = $passive['passive-model']['variants'][0]['config'];
        $this->assertSame(['tiek', 'ir', 'tiek', 'ir', 'tiek'], array_map(fn ($q) => $q['accepted_answers'][0], $models['questions']));
        $this->assertStringContainsString('явно заданной', $models['instruction']);
        $participial = collect($topics['grammar-b1-participial-subject']['blocks'])->keyBy('key');
        $actors = $participial['participial-actor']['variants'][0]['config']['questions'];
        $this->assertSame(['Anna'], $actors[1]['accepted_answers']);
        $this->assertSame(['Нет, исполнители разные'], $actors[3]['accepted_answers']);
        $forms = $participial['participial-form']['variants'][0]['config']['questions'];
        $this->assertSame(['adīdama', 'darinādams', 'strādādami', 'izmantodamas', 'lasīdams'], array_map(fn ($q) => $q['accepted_answers'][0], $forms));
        $this->assertStringContainsString('не переносится на все конструкции с -ot', $topics['grammar-b1-participial-subject']['rule']);
        foreach ($participial['participial-repair']['variants'] as $variant) foreach ($variant['config']['questions'] as $q) {
            $this->assertSame(1, substr_count($q['accepted_answers'][0], ','));
            $this->assertFalse(GrammarTask::grade(['task_kind' => 'grammar_order', 'questions' => [$q]], [str_replace(',', '', $q['accepted_answers'][0])])[0]['is_correct']);
        }
    }

    public function test_first_b1_pack_reimport_preserves_admin_edits_history_and_cooldown(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'b1-pack-01', '--write' => true])->assertExitCode(0);
        $page = LessonPage::where('slug', 'grammar-course-1793-b1')->firstOrFail();
        $ids = $page->blocks()->orderBy('position')->pluck('id')->all();
        $placement = $page->blocks->first();
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($placement, 5);
        $service->submitGrammarAttempt(5, $placement, $variant->id, array_map(fn ($q) => $q['accepted_answers'][0], $variant->config['questions']), 2);
        $before = $service->progressFor(5, $placement);
        $this->assertSame($before, $service->progressFor(5, $placement->sourceBlock));
        $page->update(['title' => 'Reviewed craft']);
        $page->grammarTopic->update(['rule' => 'Reviewed B1 rule']);
        $variant->update(['title' => 'Reviewed B1 variant']);
        foreach ([false, true] as $append) {
            $this->artisan('grammar:prepare-groups', ['--package' => 'b1-pack-01', '--write' => true, '--append-stages' => $append])->assertExitCode(0);
            $page->refresh();
            $this->assertSame($ids, $page->blocks()->orderBy('position')->pluck('id')->all());
            $this->assertSame('Reviewed craft', $page->title);
            $this->assertSame('Reviewed B1 rule', $page->grammarTopic->rule);
            $this->assertSame('Reviewed B1 variant', $variant->fresh()->title);
            $this->assertSame($before, $service->progressFor(5, $placement));
            $this->assertSame(33, $this->controller()->show($this->request(), $page->slug)->getData(true)['data']['grammar_summary']['score']);
            $this->assertSame(45, \App\Models\LessonBlockVariant::count());
            $this->assertSame(1, LessonBlockAttempt::count());
        }
    }

    public function test_first_b1_pack_targeted_leisure_import_creates_only_selected_stages(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'b1-pack-01', '--category' => '1789', '--write' => true])->assertExitCode(0);
        $this->assertSame(2, LessonPage::count());
        $this->assertSame(15, \App\Models\LessonBlockVariant::count());
        $page = LessonPage::where('slug', 'grammar-course-1789-b1')->firstOrFail();
        $this->assertSame(15, $page->course_group_id);
        $this->assertSame(3, $page->blocks()->count());
        foreach ([1793, 1795] as $category) $this->assertFalse(LessonPage::where('slug', "grammar-course-$category-b1")->exists());
    }

    public function test_third_a2_pack_has_original_variants_traced_vocabulary_and_private_answers(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-03'])->assertExitCode(0);
        $this->assertSame(0, LessonPage::count());
        $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-03', '--write' => true])->assertExitCode(0);
        $this->assertSame(8, LessonPage::count());
        $this->assertSame(24, LessonBlock::count());
        $this->assertSame(60, \App\Models\LessonBlockVariant::count());
        $package = json_decode(file_get_contents(resource_path('course/grammar-a2-pack-03.json')), true, 512, JSON_THROW_ON_ERROR);
        $audit = collect(json_decode(file_get_contents(resource_path('course/grammar-a2-pack-03-vocabulary.json')), true, 512, JSON_THROW_ON_ERROR)['topics'])->keyBy('slug');
        foreach ($package['topics'] as $topic) {
            $words = $audit[$topic['slug']]['words'];
            $this->assertSame($topic['provenance']['target_lemmas'], array_column($words, 'word'));
            $this->assertNotEmpty($topic['provenance']['foundation_lemmas']);
            $this->assertTrue(collect($words)->every(fn ($word) => count($word['word_ids']) > 0
                && (in_array('current_category', $word['sources'], true) || in_array('previous_course', $word['sources'], true))));
            $frequency = $audit[$topic['slug']]['frequency_source'];
            $this->assertSame(hash_file('sha256', base_path($frequency['path'])), $frequency['sha256']);
            $this->assertStringNotContainsString('.tmp/', $topic['provenance']['vocabulary_source']);
        }
        $questions = 0;
        foreach (LessonBlock::whereNull('source_block_id')->with('variants')->get() as $block) {
            $this->assertCount(5, $block->variants);
            $fingerprints = [];
            foreach ($block->variants as $variant) {
                $config = $variant->config;
                $this->assertCount(5, $config['questions']);
                $parts = [];
                foreach ($config['questions'] as $question) {
                    $questions++;
                    $parts[] = $question['prompt'].'|'.json_encode($question['accepted_answers']);
                    foreach ($question['accepted_answers'] as $answer) {
                        $this->assertTrue(GrammarTask::grade(['task_kind' => $config['task_kind'], 'questions' => [$question]], [$answer])[0]['is_correct']);
                    }
                }
                sort($parts);
                $fingerprints[] = implode("\n", $parts);
                foreach (GrammarTask::clientConfig($config)['questions'] as $question) {
                    $this->assertArrayNotHasKey('accepted_answers', $question);
                    $this->assertArrayNotHasKey('explanation', $question);
                }
            }
            $this->assertCount(5, array_unique($fingerprints));
        }
        $this->assertSame(300, $questions);
        foreach ([1782 => 28, 1783 => 31, 1784 => 34, 1785 => 37] as $category => $id) {
            $page = LessonPage::where('slug', "grammar-course-$category-a2")->firstOrFail();
            $this->assertSame($id, $page->course_group_id);
            $this->assertCount(3, $page->blocks);
            $this->assertTrue($page->blocks->every(fn ($block) => $block->source_block_id && $block->variants->isEmpty()));
            $this->assertSame(3, $this->controller()->show($this->request(), $page->slug)->getData(true)['data']['grammar_summary']['total']);
        }
    }

    public function test_third_a2_pack_has_explicit_normative_forms_and_logical_direction(): void
    {
        $topics = collect(json_decode(file_get_contents(resource_path('course/grammar-a2-pack-03.json')), true, 512, JSON_THROW_ON_ERROR)['topics'])->keyBy('slug');
        $blocks = collect($topics['grammar-a2-debitive']['blocks'])->keyBy('key');
        $forms = collect($blocks['debitive-form']['variants'])->flatMap(fn ($variant) => $variant['config']['questions']);
        foreach (['rakstīt' => 'jāraksta', 'mācīties' => 'jāmācās', 'atbildēt' => 'jāatbild',
            'pieteikties' => 'jāpiesakās', 'būt' => 'jābūt', 'ņemt' => 'jāņem', 'griezt' => 'jāgriež'] as $verb => $answer) {
            $question = $forms->first(fn ($q) => str_ends_with($q['prompt'], "($verb)"));
            $this->assertNotNull($question, $verb);
            $this->assertSame([$answer], $question['accepted_answers']);
        }
        $question = $blocks['debitive-roles']['variants'][0]['config']['questions'][0];
        $this->assertSame(['Man ir jālasa grāmata', 'Man jālasa grāmata'], $question['accepted_answers']);
        $config = ['task_kind' => 'grammar_gap', 'questions' => [$question]];
        foreach ($question['accepted_answers'] as $answer) $this->assertTrue(GrammarTask::grade($config, [$answer])[0]['is_correct']);
        foreach (['Es ir jālasa grāmata', 'Man ir jālasa grāmatu'] as $answer) $this->assertFalse(GrammarTask::grade($config, [$answer])[0]['is_correct']);
        $times = collect($blocks['debitive-time']['variants'])->flatMap(fn ($v) => $v['config']['questions'])->pluck('accepted_answers')->flatten()->unique()->sort()->values()->all();
        $this->assertSame(['bija', 'būs', 'ir', 'nav', 'nebija', 'nebūs'], $times);
        $blocks = collect($topics['grammar-a2-definite-context']['blocks'])->keyBy('key');
        foreach ($blocks['definite-nominative']['variants'] as $variant) foreach ($variant['config']['questions'] as $question) {
            $known = str_contains($question['prompt'], '; noteiktā galotne;');
            $this->assertStringContainsString($known ? 'jau minētais' : 'vēl nenoteikts', $question['prompt']);
            $answer = $question['accepted_answers'][0];
            $this->assertTrue(str_ends_with($answer, $known ? 'ais' : 's') || str_ends_with($answer, $known ? 'ā' : 'a'));
        }
        foreach ($blocks['definite-accusative']['variants'] as $variant) foreach ($variant['config']['questions'] as $question) {
            $known = str_contains($question['prompt'], '; noteiktā galotne)');
            $adjective = explode(' ', $question['accepted_answers'][0])[0];
            $this->assertStringEndsWith($known ? 'o' : 'u', $adjective);
            $wrong = substr($adjective, 0, -1).($known ? 'u' : 'o').' '.explode(' ', $question['accepted_answers'][0])[1];
            $this->assertFalse(GrammarTask::grade(['task_kind' => 'grammar_gap', 'questions' => [$question]], [$wrong])[0]['is_correct']);
        }
    }

    public function test_third_a2_pack_condition_and_reason_distractors_are_rejected(): void
    {
        $topics = collect(json_decode(file_get_contents(resource_path('course/grammar-a2-pack-03.json')), true, 512, JSON_THROW_ON_ERROR)['topics'])->keyBy('slug');
        foreach (['grammar-a2-condition', 'grammar-a2-reason-result'] as $slug) {
            foreach ($topics[$slug]['blocks'] as $block) foreach ($block['variants'] as $variant) {
                $config = $variant['config'];
                if ($config['task_kind'] !== 'grammar_select') continue;
                foreach ($config['questions'] as $question) foreach ($question['options'] as $answer) {
                    $this->assertSame(in_array($answer, $question['accepted_answers'], true),
                        GrammarTask::grade(['task_kind' => 'grammar_select', 'questions' => [$question]], [$answer])[0]['is_correct']);
                }
            }
        }
        $blocks = collect($topics['grammar-a2-condition']['blocks'])->keyBy('key');
        $links = collect($blocks['condition-ja']['variants'])->flatMap(fn ($v) => $v['config']['questions']);
        $this->assertCount(11, $links->filter(fn ($q) => $q['accepted_answers'] === ['tad']));
        $this->assertCount(14, $links->filter(fn ($q) => $q['accepted_answers'] === ['ja']));
        $blocks = collect($topics['grammar-a2-reason-result']['blocks'])->keyBy('key');
        $direction = $blocks['reason-result-direction']['variants'][0]['config']['questions'];
        $this->assertSame(['tev vajag adresi'], $direction[0]['accepted_answers']);
        $this->assertSame(['es to pērku'], $direction[1]['accepted_answers']);
        $this->assertSame(['Rīt ir eksāmens'], $direction[2]['accepted_answers']);
        $links = $blocks['reason-result-link']['variants'][0]['config']['questions'];
        $this->assertSame(['tāpēc'], $links[0]['accepted_answers']);
        $this->assertSame(['jo'], $links[1]['accepted_answers']);
    }

    public function test_third_a2_pack_reimport_preserves_admin_edits_history_and_cooldown(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-03', '--write' => true])->assertExitCode(0);
        $page = LessonPage::where('slug', 'grammar-course-1784-a2')->firstOrFail();
        $ids = $page->blocks()->orderBy('position')->pluck('id')->all();
        $placement = $page->blocks->first();
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($placement, 5);
        $service->submitGrammarAttempt(5, $placement, $variant->id, array_map(fn ($q) => $q['accepted_answers'][0], $variant->config['questions']), 2);
        $before = $service->progressFor(5, $placement);
        $this->assertSame($before, $service->progressFor(5, $placement->sourceBlock));
        $page->update(['title' => 'Reviewed career']);
        $page->grammarTopic->update(['rule' => 'Reviewed rule']);
        $variant->update(['title' => 'Reviewed variant']);
        foreach ([false, true] as $append) {
            $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-03', '--write' => true, '--append-stages' => $append])->assertExitCode(0);
            $page->refresh();
            $this->assertSame($ids, $page->blocks()->orderBy('position')->pluck('id')->all());
            $this->assertSame('Reviewed career', $page->title);
            $this->assertSame('Reviewed rule', $page->grammarTopic->rule);
            $this->assertSame('Reviewed variant', $variant->fresh()->title);
            $this->assertSame($before, $service->progressFor(5, $placement));
            $this->assertSame(33, $this->controller()->show($this->request(), $page->slug)->getData(true)['data']['grammar_summary']['score']);
            $this->assertSame(60, \App\Models\LessonBlockVariant::count());
            $this->assertSame(1, LessonBlockAttempt::count());
        }
    }

    public function test_third_a2_pack_targeted_career_import_creates_only_selected_stages(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-03', '--category' => '1784', '--write' => true])->assertExitCode(0);
        $this->assertSame(2, LessonPage::count());
        $this->assertSame(15, \App\Models\LessonBlockVariant::count());
        $page = LessonPage::where('slug', 'grammar-course-1784-a2')->firstOrFail();
        $this->assertSame(34, $page->course_group_id);
        $this->assertSame(3, $page->blocks()->count());
        foreach ([1782, 1783, 1785] as $category) $this->assertFalse(LessonPage::where('slug', "grammar-course-$category-a2")->exists());
    }

    public function test_second_a2_pack_has_original_variants_traced_vocabulary_and_correct_forms(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-02'])->assertExitCode(0);
        $this->assertSame(0, LessonPage::count());
        $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-02', '--write' => true])->assertExitCode(0);
        $this->assertSame(8, LessonPage::count());
        $this->assertSame(24, LessonBlock::count());
        $this->assertSame(60, \App\Models\LessonBlockVariant::count());
        $package = json_decode(file_get_contents(resource_path('course/grammar-a2-pack-02.json')), true, 512, JSON_THROW_ON_ERROR);
        $audit = collect(json_decode(file_get_contents(resource_path('course/grammar-a2-pack-02-vocabulary.json')), true, 512, JSON_THROW_ON_ERROR)['topics'])->keyBy('slug');
        foreach ($package['topics'] as $topic) {
            $words = $audit[$topic['slug']]['words'];
            $this->assertSame($topic['provenance']['target_lemmas'], array_column($words, 'word'));
            $this->assertNotEmpty($topic['provenance']['foundation_lemmas']);
            $this->assertTrue(collect($words)->every(fn ($word) => count($word['word_ids']) > 0
                && (in_array('current_category', $word['sources'], true) || in_array('previous_course', $word['sources'], true))));
        }
        $questions = 0;
        foreach (LessonBlock::whereNull('source_block_id')->with('variants')->get() as $block) {
            $this->assertCount(5, $block->variants);
            $fingerprints = [];
            foreach ($block->variants as $variant) {
                $config = $variant->config;
                $this->assertCount(5, $config['questions']);
                $parts = [];
                foreach ($config['questions'] as $q) {
                    $questions++;
                    $parts[] = $q['prompt'].'|'.json_encode($q['accepted_answers']);
                    foreach ($q['accepted_answers'] as $answer) {
                        $this->assertTrue(GrammarTask::grade(['task_kind' => $config['task_kind'], 'questions' => [$q]], [$answer])[0]['is_correct']);
                    }
                    if ($config['task_kind'] === 'grammar_correct') $this->assertFalse(GrammarTask::grade(
                        ['task_kind' => $config['task_kind'], 'questions' => [$q]], [$q['prompt']])[0]['is_correct']);
                }
                sort($parts);
                $fingerprints[] = implode("\n", $parts);
                foreach (GrammarTask::clientConfig($config)['questions'] as $q) {
                    $this->assertArrayNotHasKey('accepted_answers', $q);
                    $this->assertArrayNotHasKey('explanation', $q);
                }
                if (str_ends_with($block->seed_key, '-chain-genitives')) {
                    foreach ($config['questions'] as $q) $this->assertContains($q['accepted_answers'][0], [
                        'tēva brāļa', 'mātes māsas', 'brāļa dēla', 'māsas meitas', 'vecmāmiņas kaimiņa']);
                }
                if (str_ends_with($block->seed_key, '-attachment-locative')) {
                    foreach ($config['questions'] as $q) {
                        if (str_starts_with($q['prompt'], 'brāļa jaunā māja →')) $this->assertSame(['brāļa jaunajā mājā'], $q['accepted_answers']);
                        if (str_starts_with($q['prompt'], 'vecās māsas māja →')) $this->assertSame(['vecās māsas mājā'], $q['accepted_answers']);
                    }
                }
                if (str_ends_with($block->seed_key, '-vajag-time-negative')) {
                    foreach ($config['questions'] as $q) $this->assertContains($q['accepted_answers'][0], [
                        'vajag', 'nevajag', 'vajadzēja', 'nevajadzēja', 'vajadzēs', 'nevajadzēs']);
                }
                if (str_ends_with($block->seed_key, '-government-like-contrast')) {
                    foreach ($config['questions'] as $q) if (str_contains($q['prompt'], 'patīk')) {
                        preg_match('/\\((.+), vienskaitlis\\)$/u', $q['prompt'], $match);
                        $this->assertSame([$match[1]], $q['accepted_answers']);
                    }
                }
            }
            $this->assertCount(5, array_unique($fingerprints));
        }
        $this->assertSame(300, $questions);
        foreach ([1775 => [2, 3], 1777 => [10, 3], 1779 => [18, 3], 1781 => [25, 3]] as $category => [$id, $count]) {
            $page = LessonPage::where('slug', "grammar-course-$category-a2")->firstOrFail();
            $this->assertSame($id, $page->course_group_id);
            $this->assertSame($count, $page->blocks->count());
            $this->assertTrue($page->blocks->every(fn ($b) => $b->source_block_id && $b->variants->isEmpty()));
            $this->assertSame($count, $this->controller()->show($this->request(), $page->slug)->getData(true)['data']['grammar_summary']['total']);
        }
    }

    public function test_second_a2_pack_reimport_preserves_variants_admin_edits_and_shared_history(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-02', '--write' => true])->assertExitCode(0);
        $page = LessonPage::where('slug', 'grammar-course-1777-a2')->firstOrFail();
        $ids = $page->blocks()->orderBy('position')->pluck('id')->all();
        $placement = $page->blocks->first();
        $source = $placement->sourceBlock;
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($placement, 5);
        $service->submitGrammarAttempt(5, $placement, $variant->id, array_column(array_column($variant->config['questions'], 'accepted_answers'), 0), 2);
        $before = $service->progressFor(5, $placement);
        $this->assertSame($before, $service->progressFor(5, $source));
        $page->update(['title' => 'Keep hobby title']);
        $page->grammarTopic->update(['rule' => 'Keep hobby rule']);
        $variant->update(['title' => 'Keep reviewed variant']);
        foreach ([false, true] as $append) {
            $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-02', '--write' => true, '--append-stages' => $append])->assertExitCode(0);
            $page->refresh();
            $this->assertSame($ids, $page->blocks()->orderBy('position')->pluck('id')->all());
            $this->assertSame('Keep hobby title', $page->title);
            $this->assertSame('Keep hobby rule', $page->grammarTopic->rule);
            $this->assertSame('Keep reviewed variant', $variant->fresh()->title);
            $this->assertSame($before, $service->progressFor(5, $placement));
            $this->assertSame(33, $this->controller()->show($this->request(), $page->slug)->getData(true)['data']['grammar_summary']['score']);
            $this->assertSame(60, \App\Models\LessonBlockVariant::count());
            $this->assertSame(1, LessonBlockAttempt::count());
        }
    }

    public function test_second_a2_pack_targeted_family_import_creates_only_selected_stages(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-02', '--category' => '1775', '--write' => true])->assertExitCode(0);
        $this->assertSame(2, LessonPage::count());
        $this->assertSame(15, \App\Models\LessonBlockVariant::count());
        $page = LessonPage::where('slug', 'grammar-course-1775-a2')->firstOrFail();
        $this->assertSame(3, $page->blocks()->count());
        $this->assertSame(2, $page->course_group_id);
        $this->assertFalse(LessonPage::where('slug', 'grammar-course-1777-a2')->exists());
        $this->assertFalse(LessonPage::where('slug', 'grammar-course-1779-a2')->exists());
        $this->assertFalse(LessonPage::where('slug', 'grammar-course-1781-a2')->exists());
    }

    public function test_second_a2_pack_appends_attachment_and_preserves_previous_home_progress(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-01', '--category' => '1777', '--write' => true])->assertExitCode(0);
        $page = LessonPage::where('slug', 'grammar-course-1777-a2')->firstOrFail();
        $oldIds = $page->blocks()->orderBy('position')->pluck('id')->all();
        $placement = $page->blocks->first();
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($placement, 5);
        $oldConfig = $variant->config;
        $service->submitGrammarAttempt(5, $placement, $variant->id, array_column(array_column($oldConfig['questions'], 'accepted_answers'), 0), 2);
        $before = $service->progressFor(5, $placement);
        $page->update(['title' => 'Keep home page']);
        $page->grammarTopic->update(['rule' => 'Keep reviewed rule']);
        $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-02', '--category' => '1777', '--write' => true])->assertExitCode(0);
        $this->assertCount(3, $page->fresh()->blocks);
        $this->assertSame($before, $service->progressFor(5, $placement));
        foreach ([1, 2] as $run) {
            $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-02', '--category' => '1777', '--write' => true, '--append-stages' => true])->assertExitCode(0);
            $page->refresh();
            $this->assertCount(6, $page->blocks);
            $this->assertSame($oldIds, $page->blocks()->orderBy('position')->limit(3)->pluck('id')->all());
            $this->assertSame('Keep home page', $page->title);
            $this->assertSame('Keep reviewed rule', $page->grammarTopic->rule);
            $this->assertSame(['verbEndingsPresent', 'verbEndingsPast', 'genitivs', 'adjEndings'], $page->grammarTopic->table_keys);
            $this->assertSame($oldConfig, $variant->fresh()->config);
            $this->assertSame($before, $service->progressFor(5, $placement));
            $this->assertSame(100, $before['best_score']);
            $data = $this->controller()->show($this->request(), $page->slug)->getData(true)['data'];
            $this->assertSame(6, $data['grammar_summary']['total']);
            $this->assertSame(17, $data['grammar_summary']['score']);
            $this->assertSame(1, LessonBlockAttempt::count());
            $this->assertSame(30, \App\Models\LessonBlockVariant::count());
        }
    }

    public function test_first_a2_pack_has_original_variants_traced_vocabulary_and_correct_forms(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-01'])->assertExitCode(0);
        $this->assertSame(0, LessonPage::count());
        $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-01', '--write' => true])->assertExitCode(0);
        $this->assertSame(8, LessonPage::count());
        $this->assertSame(24, LessonBlock::count());
        $this->assertSame(60, \App\Models\LessonBlockVariant::count());
        $package = json_decode(file_get_contents(resource_path('course/grammar-a2-pack-01.json')), true, 512, JSON_THROW_ON_ERROR);
        $audit = collect(json_decode(file_get_contents(resource_path('course/grammar-a2-pack-01-vocabulary.json')), true, 512, JSON_THROW_ON_ERROR)['topics'])->keyBy('slug');
        foreach ($package['topics'] as $topic) {
            $words = $audit[$topic['slug']]['words'];
            $this->assertSame($topic['provenance']['target_lemmas'], array_column($words, 'word'));
            $this->assertNotEmpty($topic['provenance']['foundation_lemmas']);
            $this->assertTrue(collect($words)->every(fn ($word) => count($word['word_ids']) > 0
                && (in_array('current_category', $word['sources'], true) || in_array('previous_course', $word['sources'], true))));
        }
        $questions = 0;
        foreach (LessonBlock::whereNull('source_block_id')->with('variants')->get() as $block) {
            $this->assertCount(5, $block->variants);
            $fingerprints = [];
            foreach ($block->variants as $variant) {
                $config = $variant->config;
                $this->assertCount(5, $config['questions']);
                $parts = [];
                foreach ($config['questions'] as $q) {
                    $questions++;
                    $parts[] = $q['prompt'].'|'.json_encode($q['accepted_answers']);
                    foreach ($q['accepted_answers'] as $answer) {
                        $this->assertTrue(GrammarTask::grade(['task_kind' => $config['task_kind'], 'questions' => [$q]], [$answer])[0]['is_correct']);
                    }
                    if ($config['task_kind'] === 'grammar_correct') $this->assertFalse(GrammarTask::grade(
                        ['task_kind' => $config['task_kind'], 'questions' => [$q]], [$q['prompt']])[0]['is_correct']);
                }
                sort($parts);
                $fingerprints[] = implode("\n", $parts);
                foreach (GrammarTask::clientConfig($config)['questions'] as $q) {
                    $this->assertArrayNotHasKey('accepted_answers', $q);
                    $this->assertArrayNotHasKey('explanation', $q);
                }
                if (str_ends_with($block->seed_key, '-reflexive-future')) {
                    foreach ($config['questions'] as $q) if (str_contains($q['prompt'], 'Jūs ')) {
                        $this->assertSame(['vēlēsieties', 'vēlēsities'], $q['accepted_answers']);
                    }
                }
                if (str_ends_with($block->seed_key, '-comparison-par-singular')) {
                    foreach ($config['questions'] as $q) foreach (['upe' => 'upi', 'taka' => 'taku',
                        'egle' => 'egli', 'liepa' => 'liepu', 'ozols' => 'ozolu', 'mežs' => 'mežu',
                        'ezers' => 'ezeru', 'koks' => 'koku'] as $noun => $accusative) {
                        if (str_contains($q['prompt'], "($noun,")) $this->assertSame([$accusative], $q['accepted_answers']);
                    }
                }
                if (str_ends_with($block->seed_key, '-adverb-price')) {
                    foreach ($config['questions'] as $q) $this->assertContains($q['accepted_answers'][0], ['lēti', 'dārgi']);
                }
                if (str_ends_with($block->seed_key, '-genitive-adjective-locative')) {
                    foreach ($config['questions'] as $q) if (str_contains($q['prompt'], 'cimdos')) {
                        $this->assertMatchesRegularExpression('/os (vilnas|ziemas)$/u', $q['accepted_answers'][0]);
                        $this->assertStringNotContainsString('ajos', $q['accepted_answers'][0]);
                    }
                }
            }
            $this->assertCount(5, array_unique($fingerprints));
        }
        $this->assertSame(300, $questions);
        foreach ([1776 => [6, 3], 1777 => [10, 3], 1778 => [14, 3], 1780 => [22, 3]] as $category => [$id, $count]) {
            $page = LessonPage::where('slug', "grammar-course-$category-a2")->firstOrFail();
            $this->assertSame($id, $page->course_group_id);
            $this->assertSame($count, $page->blocks->count());
            $this->assertTrue($page->blocks->every(fn ($b) => $b->source_block_id && $b->variants->isEmpty()));
            $this->assertSame($count, $this->controller()->show($this->request(), $page->slug)->getData(true)['data']['grammar_summary']['total']);
        }
    }

    public function test_first_a2_pack_reimport_preserves_variants_admin_edits_and_shared_history(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-01', '--write' => true])->assertExitCode(0);
        $page = LessonPage::where('slug', 'grammar-course-1777-a2')->firstOrFail();
        $ids = $page->blocks()->orderBy('position')->pluck('id')->all();
        $placement = $page->blocks->first();
        $source = $placement->sourceBlock;
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($placement, 5);
        $service->submitGrammarAttempt(5, $placement, $variant->id, array_column(array_column($variant->config['questions'], 'accepted_answers'), 0), 2);
        $before = $service->progressFor(5, $placement);
        $this->assertSame($before, $service->progressFor(5, $source));
        $page->update(['title' => 'Keep hobby title']);
        $page->grammarTopic->update(['rule' => 'Keep hobby rule']);
        $variant->update(['title' => 'Keep reviewed variant']);
        foreach ([false, true] as $append) {
            $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-01', '--write' => true, '--append-stages' => $append])->assertExitCode(0);
            $page->refresh();
            $this->assertSame($ids, $page->blocks()->orderBy('position')->pluck('id')->all());
            $this->assertSame('Keep hobby title', $page->title);
            $this->assertSame('Keep hobby rule', $page->grammarTopic->rule);
            $this->assertSame('Keep reviewed variant', $variant->fresh()->title);
            $this->assertSame($before, $service->progressFor(5, $placement));
            $this->assertSame(33, $this->controller()->show($this->request(), $page->slug)->getData(true)['data']['grammar_summary']['score']);
            $this->assertSame(60, \App\Models\LessonBlockVariant::count());
            $this->assertSame(1, LessonBlockAttempt::count());
        }
    }

    public function test_first_a2_pack_targeted_appearance_import_creates_only_selected_stages(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a2-pack-01', '--category' => '1776', '--write' => true])->assertExitCode(0);
        $this->assertSame(2, LessonPage::count());
        $this->assertSame(15, \App\Models\LessonBlockVariant::count());
        $page = LessonPage::where('slug', 'grammar-course-1776-a2')->firstOrFail();
        $this->assertSame(3, $page->blocks()->count());
        $this->assertSame(6, $page->course_group_id);
        $this->assertFalse(LessonPage::where('slug', 'grammar-course-1777-a2')->exists());
        $this->assertFalse(LessonPage::where('slug', 'grammar-course-1778-a2')->exists());
        $this->assertFalse(LessonPage::where('slug', 'grammar-course-1780-a2')->exists());
    }

    public function test_fourth_pack_has_original_variants_traced_vocabulary_and_correct_forms(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-04'])->assertExitCode(0);
        $this->assertSame(0, LessonPage::count());
        $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-04', '--write' => true])->assertExitCode(0);
        $this->assertSame(8, LessonPage::count());
        $this->assertSame(24, LessonBlock::count());
        $this->assertSame(60, \App\Models\LessonBlockVariant::count());
        $package = json_decode(file_get_contents(resource_path('course/grammar-a1-pack-04.json')), true, 512, JSON_THROW_ON_ERROR);
        $audit = collect(json_decode(file_get_contents(resource_path('course/grammar-a1-pack-04-vocabulary.json')), true, 512, JSON_THROW_ON_ERROR)['topics'])->keyBy('slug');
        foreach ($package['topics'] as $topic) {
            $words = $audit[$topic['slug']]['words'];
            $this->assertSame($topic['provenance']['target_lemmas'], array_column($words, 'word'));
            $this->assertNotEmpty($topic['provenance']['foundation_lemmas']);
            $this->assertTrue(collect($words)->every(fn ($word) => count($word['word_ids']) > 0
                && (in_array('current_category', $word['sources'], true) || in_array('previous_course', $word['sources'], true))));
        }
        $questions = 0;
        foreach (LessonBlock::whereNull('source_block_id')->with('variants')->get() as $block) {
            $this->assertCount(5, $block->variants);
            $fingerprints = [];
            foreach ($block->variants as $variant) {
                $config = $variant->config;
                $this->assertCount(5, $config['questions']);
                $parts = [];
                foreach ($config['questions'] as $q) {
                    $questions++;
                    $parts[] = $q['prompt'].'|'.json_encode($q['accepted_answers']);
                    foreach ($q['accepted_answers'] as $answer) {
                        $this->assertTrue(GrammarTask::grade(['task_kind' => $config['task_kind'], 'questions' => [$q]], [$answer])[0]['is_correct']);
                    }
                    if ($config['task_kind'] === 'grammar_correct') $this->assertFalse(GrammarTask::grade(
                        ['task_kind' => $config['task_kind'], 'questions' => [$q]], [$q['prompt']])[0]['is_correct']);
                }
                sort($parts);
                $fingerprints[] = implode("\n", $parts);
                foreach (GrammarTask::clientConfig($config)['questions'] as $q) {
                    $this->assertArrayNotHasKey('accepted_answers', $q);
                    $this->assertArrayNotHasKey('explanation', $q);
                }
                if (str_ends_with($block->seed_key, '-ar-plural')) {
                    foreach ($config['questions'] as $q) {
                        foreach (['prāmis' => 'prāmjiem', 'brālis' => 'brāļiem', 'suns' => 'suņiem'] as $base => $form) {
                            if (str_contains($q['prompt'], $base)) $this->assertSame([$form], $q['accepted_answers']);
                        }
                    }
                }
                if (str_ends_with($block->seed_key, '-time-future')) {
                    foreach ($config['questions'] as $q) {
                        if (str_contains($q['prompt'], 'jūs ')) {
                            $this->assertCount(2, $q['accepted_answers']);
                            $this->assertStringEndsWith('siet', $q['accepted_answers'][0]);
                            $this->assertSame(substr($q['accepted_answers'][0], 0, -4).'sit', $q['accepted_answers'][1]);
                        }
                    }
                }
                if (str_ends_with($block->seed_key, '-negation-but')) {
                    foreach ($config['questions'] as $q) $this->assertContains($q['accepted_answers'][0], ['neesmu', 'neesi', 'nav', 'neesam', 'neesat']);
                }
            }
            $this->assertCount(5, array_unique($fingerprints));
        }
        $this->assertSame(300, $questions);
        foreach ([1767 => [17, 3], 1771 => [30, 3], 1773 => [36, 3], 1774 => [38, 3]] as $category => [$id, $count]) {
            $page = LessonPage::where('slug', "grammar-course-$category-a1")->firstOrFail();
            $this->assertSame($id, $page->course_group_id);
            $this->assertSame($count, $page->blocks->count());
            $this->assertTrue($page->blocks->every(fn ($b) => $b->source_block_id && $b->variants->isEmpty()));
            $this->assertSame($count, $this->controller()->show($this->request(), $page->slug)->getData(true)['data']['grammar_summary']['total']);
        }
    }

    public function test_fourth_pack_reimport_preserves_variants_admin_edits_and_shared_history(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-04', '--write' => true])->assertExitCode(0);
        $page = LessonPage::where('slug', 'grammar-course-1771-a1')->firstOrFail();
        $ids = $page->blocks()->orderBy('position')->pluck('id')->all();
        $placement = $page->blocks->first();
        $source = $placement->sourceBlock;
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($placement, 5);
        $service->submitGrammarAttempt(5, $placement, $variant->id, array_column(array_column($variant->config['questions'], 'accepted_answers'), 0), 2);
        $before = $service->progressFor(5, $placement);
        $this->assertSame($before, $service->progressFor(5, $source));
        $page->update(['title' => 'Keep hobby title']);
        $page->grammarTopic->update(['rule' => 'Keep hobby rule']);
        $variant->update(['title' => 'Keep reviewed variant']);
        foreach ([false, true] as $append) {
            $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-04', '--write' => true, '--append-stages' => $append])->assertExitCode(0);
            $page->refresh();
            $this->assertSame($ids, $page->blocks()->orderBy('position')->pluck('id')->all());
            $this->assertSame('Keep hobby title', $page->title);
            $this->assertSame('Keep hobby rule', $page->grammarTopic->rule);
            $this->assertSame('Keep reviewed variant', $variant->fresh()->title);
            $this->assertSame($before, $service->progressFor(5, $placement));
            $this->assertSame(33, $this->controller()->show($this->request(), $page->slug)->getData(true)['data']['grammar_summary']['score']);
            $this->assertSame(60, \App\Models\LessonBlockVariant::count());
            $this->assertSame(1, LessonBlockAttempt::count());
        }
    }

    public function test_fourth_pack_targeted_transport_import_creates_only_selected_stages(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-04', '--category' => '1767', '--write' => true])->assertExitCode(0);
        $this->assertSame(2, LessonPage::count());
        $this->assertSame(15, \App\Models\LessonBlockVariant::count());
        $page = LessonPage::where('slug', 'grammar-course-1767-a1')->firstOrFail();
        $this->assertSame(3, $page->blocks()->count());
        $this->assertSame(17, $page->course_group_id);
        $this->assertFalse(LessonPage::where('slug', 'grammar-course-1771-a1')->exists());
        $this->assertFalse(LessonPage::where('slug', 'grammar-course-1773-a1')->exists());
        $this->assertFalse(LessonPage::where('slug', 'grammar-course-1774-a1')->exists());
    }

    public function test_third_pack_appends_age_without_replacing_admin_edits_or_history(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-01', '--category' => '1766', '--write' => true])->assertExitCode(0);
        $page = LessonPage::where('slug', 'grammar-course-1766-a1')->firstOrFail();
        $ids = $page->blocks()->orderBy('position')->pluck('id')->all();
        $placement = $page->blocks->first();
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($placement, 5);
        $service->submitGrammarAttempt(5, $placement, $variant->id, array_map(fn ($q) => $q['accepted_answers'][0], $variant->config['questions']), 2);
        $before = $service->progressFor(5, $placement);
        $page->update(['title' => 'Preserve home title']);
        $page->grammarTopic->update(['rule' => 'Preserve home rule']);
        $variant->update(['title' => 'Preserve source variant']);
        $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-03', '--category' => '1766', '--write' => true])->assertExitCode(0);
        $this->assertSame(6, $page->blocks()->count());
        $this->assertFalse(LessonPage::where('slug', 'grammar-course-1769-a1')->exists());
        foreach ([1, 2] as $run) {
            $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-03', '--category' => '1766', '--write' => true, '--append-stages' => true])->assertExitCode(0);
            $page->refresh();
            $this->assertCount(9, $page->blocks);
            $this->assertSame(range(0, 8), $page->blocks->pluck('position')->all());
            $this->assertSame($ids, $page->blocks()->orderBy('position')->limit(6)->pluck('id')->all());
            $this->assertSame('Preserve home title', $page->title);
            $this->assertSame('Preserve home rule', $page->grammarTopic->rule);
            $this->assertSame('Preserve source variant', $variant->fresh()->title);
            $this->assertSame($before, $service->progressFor(5, $placement));
            $this->assertContains('questionsChart', $page->grammarTopic->table_keys);
            $this->assertSame(11, $this->controller()->show($this->request(), $page->slug)->getData(true)['data']['grammar_summary']['score']);
            $this->assertSame(1, LessonBlockAttempt::count());
            $this->assertSame(45, \App\Models\LessonBlockVariant::count());
        }
    }

    public function test_third_pack_targeted_food_import_excludes_other_groups(): void
    {
        $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-03', '--category' => '1770', '--write' => true])->assertExitCode(0);
        $this->assertSame(3, LessonPage::count());
        $this->assertSame(30, \App\Models\LessonBlockVariant::count());
        $this->assertSame(6, LessonPage::where('slug', 'grammar-course-1770-a1')->firstOrFail()->blocks()->count());
        $this->assertFalse(LessonPage::where('slug', 'grammar-course-1766-a1')->exists());
        $this->assertFalse(LessonPage::where('slug', 'grammar-course-1769-a1')->exists());
    }

    public function test_second_pack_appends_only_on_request_and_keeps_old_progress(): void
    {
        $this->seedGroups();
        $this->artisan('grammar:prepare-groups', ['--package' => 'agreement', '--write' => true, '--append-stages' => true])->assertExitCode(0);
        $page = LessonPage::where('slug', 'grammar-course-1765-a1')->firstOrFail();
        $ids = $page->blocks()->orderBy('position')->pluck('id')->all();
        $this->assertCount(5, $ids);
        $placement = $page->blocks->first();
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($placement, 5);
        $service->submitGrammarAttempt(5, $placement, $variant->id, array_map(fn ($q) => $q['accepted_answers'][0], $variant->config['questions']), 2);
        $before = $service->progressFor(5, $placement);
        $page->update(['title' => 'Keep admin title']);
        $page->grammarTopic->update(['rule' => 'Keep admin rule']);
        $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-02', '--category' => '1765', '--write' => true])->assertExitCode(0);
        $this->assertSame(5, $page->blocks()->count());
        $this->assertFalse(LessonPage::where('slug', 'grammar-course-1763-a1')->exists());
        foreach ([1, 2] as $run) {
            $this->artisan('grammar:prepare-groups', ['--package' => 'a1-pack-02', '--category' => '1765', '--write' => true, '--append-stages' => true])->assertExitCode(0);
            $page->refresh();
            $this->assertCount(8, $page->blocks);
            $this->assertSame(range(0, 7), $page->blocks->pluck('position')->all());
            $this->assertSame($ids, $page->blocks()->orderBy('position')->limit(5)->pluck('id')->all());
            $this->assertSame('Keep admin title', $page->title);
            $this->assertSame('Keep admin rule', $page->grammarTopic->rule);
            $this->assertSame($before, $service->progressFor(5, $placement));
            $this->assertSame(13, $this->controller()->show($this->request(), $page->slug)->getData(true)['data']['grammar_summary']['score']);
            $this->assertSame(1, LessonBlockAttempt::count());
        }
    }
}
