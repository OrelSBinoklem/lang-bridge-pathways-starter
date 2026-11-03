<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\LessonController;
use App\Models\LessonBlock;
use App\Models\LessonBlockAttempt;
use App\Models\LessonBlockVariant;
use App\Models\LessonPage;
use App\Services\GrammarTask;
use App\Services\LessonProgressService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class GrammarRemainingGroupsTest extends TestCase
{
    private const PACKAGES = ['b1-pack-02' => 3, 'b1-pack-03' => 4, 'b2-pack-01' => 2, 'b2-pack-02' => 3];

    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('users', fn ($table) => $table->id());
        Schema::create('course_groups', function ($table) {
            $table->id(); $table->string('seed_key'); $table->string('level');
        });
        foreach (['2026_09_11_000002_create_lesson_pages_table', '2026_09_11_000003_create_lesson_blocks_table',
            '2026_09_11_000005_create_lesson_block_completions_table', '2026_09_22_000001_add_course_skill_lesson_framework',
            '2026_09_25_000001_create_app_settings_table', '2026_09_27_000001_create_grammar_topics_table',
            '2026_09_29_000001_create_lesson_block_responses_table', '2026_09_29_000002_create_lesson_grammar_item_progress_table',
            '2026_09_29_000003_add_reviews_to_lesson_grammar_item_progress', '2026_10_01_000001_add_grammar_stage_references'] as $migration) {
            (require database_path("migrations/$migration.php"))->up();
        }
        DB::table('users')->insert([['id' => 5], ['id' => 9]]);
        foreach (self::PACKAGES as $package => $count) {
            foreach ($this->package($package)['group_pages'] as $group) {
                DB::table('course_groups')->insert(['id' => $group['category_id'],
                    'seed_key' => $group['course_group_seed_key'],
                    'level' => str_contains($package, 'b1') ? 'B1' : 'B2']);
            }
        }
    }

    private function package(string $name): array
    {
        return json_decode(file_get_contents(resource_path("course/grammar-$name.json")), true, 512, JSON_THROW_ON_ERROR);
    }

    private function seedAll(): void
    {
        foreach (self::PACKAGES as $name => $count) {
            $this->artisan('grammar:prepare-groups', ['--package' => $name, '--write' => true])->assertExitCode(0);
        }
    }

    public function test_remaining_packages_have_balanced_original_variants_and_known_tables(): void
    {
        $index = json_decode(file_get_contents(base_path('tools/tutor-gateway/src/commands/grammarTablesIndex.json')), true, 512, JSON_THROW_ON_ERROR);
        $questions = 0;
        foreach (self::PACKAGES as $name => $count) {
            $package = $this->package($name);
            $this->assertCount($count, $package['topics']);
            $this->assertCount($count, $package['group_pages']);
            $keys = [];
            foreach ($package['topics'] as $topic) {
                $this->assertNotEmpty($topic['table_keys']);
                foreach ($topic['table_keys'] as $key) {
                    $this->assertContains($key, array_column($index, 'tableKey'));
                }
                $this->assertCount(3, $topic['blocks']);
                foreach ($topic['blocks'] as $block) {
                    $this->assertNotContains($block['key'], $keys);
                    $keys[] = $block['key'];
                    $this->assertCount(5, $block['variants']);
                    $this->assertCount(5, array_unique(array_map(fn ($v) => json_encode($v['config']), $block['variants'])));
                    foreach ($block['variants'] as $variant) {
                        $config = $variant['config'];
                        GrammarTask::validate($config);
                        $this->assertCount(5, $config['questions']);
                        $answers = array_column(array_column($config['questions'], 'accepted_answers'), 0);
                        $this->assertTrue(collect(GrammarTask::grade($config, $answers))->every('is_correct'));
                        foreach ($config['questions'] as $position => $question) {
                            foreach ([$question['prompt'], ...$question['accepted_answers'], ...($question['options'] ?? [])] as $text) {
                                $this->assertDoesNotMatchRegularExpression('/(?=[\p{L}\p{M}]*\p{Latin})(?=[\p{L}\p{M}]*\p{Cyrillic})[\p{L}\p{M}]+/u', $text);
                            }
                            foreach ($question['accepted_answers'] as $accepted) {
                                $alternative = $answers;
                                $alternative[$position] = $accepted;
                                $this->assertTrue(GrammarTask::grade($config, $alternative)[$position]['is_correct']);
                            }
                            if ($config['task_kind'] === 'grammar_select') {
                                foreach (array_diff($question['options'], $question['accepted_answers']) as $wrong) {
                                    $alternative = $answers;
                                    $alternative[$position] = $wrong;
                                    $this->assertFalse(GrammarTask::grade($config, $alternative)[$position]['is_correct']);
                                }
                            }
                            $this->assertNotEmpty($question['explanation']);
                            $questions++;
                        }
                        foreach (GrammarTask::clientConfig($config)['questions'] as $question) {
                            $this->assertArrayNotHasKey('accepted_answers', $question);
                            $this->assertArrayNotHasKey('explanation', $question);
                        }
                    }
                }
            }
            $this->artisan('grammar:prepare-groups', ['--package' => $name])->assertExitCode(0);
        }
        $this->assertSame(900, $questions);
        $this->assertSame(0, LessonPage::count());
    }

    public function test_import_preserves_edits_and_embeds_only_canonical_stages(): void
    {
        $this->seedAll();
        $this->assertSame(24, LessonPage::count());
        $this->assertSame(72, LessonBlock::count());
        $this->assertSame(180, LessonBlockVariant::count());
        $this->assertSame(0, LessonBlockAttempt::count());
        $page = LessonPage::whereNotNull('course_group_id')->firstOrFail();
        $page->update(['title' => 'Owner title']);
        $source = $page->blocks->first()->sourceBlock;
        $variant = $source->variants->first();
        $variant->update(['title' => 'Owner variant']);
        $this->seedAll();
        $this->assertSame('Owner title', $page->fresh()->title);
        $this->assertSame('Owner variant', $variant->fresh()->title);
        $this->assertSame(180, LessonBlockVariant::count());
        foreach (LessonPage::whereNotNull('course_group_id')->get() as $group) {
            $this->assertCount(3, $group->blocks);
            foreach ($group->blocks as $block) {
                $this->assertNotNull($block->source_block_id);
                $this->assertCount(0, $block->variants);
                $this->assertCount(5, $block->sourceBlock->variants);
            }
        }
    }

    public function test_group_average_and_private_source_progress_agree(): void
    {
        $this->seedAll();
        $service = new LessonProgressService;
        $controller = new LessonController($service);
        foreach (LessonPage::whereNotNull('course_group_id')->get() as $page) {
            foreach ($page->blocks as $block) {
                $variant = $service->selectedVariant($block, 5);
                $answers = array_column(array_column($variant->config['questions'], 'accepted_answers'), 0);
                $result = $service->submitGrammarAttempt(5, $block, $variant->id, $answers, 2);
                $this->assertSame(100, $result['score']);
                $this->assertSame($service->progressFor(5, $block), $service->progressFor(5, $block->sourceBlock));
                $this->assertNull($service->progressFor(9, $block)['best_score']);
                $nextVariant = $service->selectedVariant($block, 5);
                $nextAnswers = array_column(array_column($nextVariant->config['questions'], 'accepted_answers'), 0);
                $retry = $service->submitGrammarAttempt(5, $block, $nextVariant->id, $nextAnswers, 2);
                $this->assertTrue($retry['is_practice']);
            }
            $request = Request::create('/api/lessons/'.$page->slug);
            $request->setUserResolver(fn () => (object) ['id' => 5]);
            $data = $controller->show($request, $page->slug)->getData(true)['data'];
            $this->assertSame(100, $data['grammar_summary']['score']);
            $this->assertSame(3, $data['grammar_summary']['total']);
        }
    }

    public function test_targeted_import_does_not_create_other_groups(): void
    {
        foreach (self::PACKAGES as $name => $count) {
            $category = $this->package($name)['group_pages'][0]['category_id'];
            $this->artisan('grammar:prepare-groups', ['--package' => $name, '--category' => $category, '--write' => true])->assertExitCode(0);
        }
        $this->assertSame(8, LessonPage::count());
        $this->assertSame(60, LessonBlockVariant::count());
    }

    public function test_vocabulary_audits_match_content_and_do_not_claim_personal_knowledge(): void
    {
        foreach (self::PACKAGES as $name => $count) {
            $file = resource_path("course/grammar-$name.json");
            $package = $this->package($name);
            $audit = json_decode(file_get_contents(resource_path("course/grammar-$name-vocabulary.json")), true, 512, JSON_THROW_ON_ERROR);
            $this->assertSame('shared_course', $audit['mode']);
            $this->assertSame(20, $audit['dictionary_id']);
            $this->assertSame(hash_file('sha256', $file), $audit['source_sha256']);
            $this->assertCount($count, $audit['topics']);
            foreach ($package['topics'] as $index => $topic) {
                $evidence = $audit['topics'][$index];
                $this->assertSame($topic['slug'], $evidence['slug']);
                $this->assertSame($topic['provenance']['category_id'], $evidence['category_id']);
                $this->assertSame($topic['provenance']['target_lemmas'], array_column($evidence['words'], 'word'));
                $this->assertSame($topic['provenance']['foundation_lemmas'], $evidence['foundation_lemmas']);
                foreach ($evidence['words'] as $word) {
                    $this->assertNotEmpty($word['word_ids']);
                    $this->assertNotEmpty(array_intersect(['current_category', 'previous_course'], $word['sources']));
                    $this->assertNotContains('personal_progress', $word['sources']);
                    $this->assertTrue($word['corpus_count'] === null || is_int($word['corpus_count']));
                }
            }
        }
    }
}
