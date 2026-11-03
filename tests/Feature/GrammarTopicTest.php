<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\GrammarTopicController;
use App\Http\Controllers\Api\LessonController;
use App\Models\LessonBlock;
use App\Models\LessonBlockAttempt;
use App\Models\LessonBlockCompletion;
use App\Models\LessonBlockProgress;
use App\Models\LessonBlockVariant;
use App\Models\LessonPage;
use App\Services\GrammarTask;
use App\Services\GrammarTopicProgress;
use App\Services\LessonProgressService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class GrammarTopicTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('users', fn ($table) => $table->id());
        Schema::create('course_groups', function ($table) { $table->id(); $table->string('seed_key')->nullable(); });
        foreach (['2026_09_11_000002_create_lesson_pages_table', '2026_09_11_000003_create_lesson_blocks_table',
            '2026_09_11_000005_create_lesson_block_completions_table', '2026_09_22_000001_add_course_skill_lesson_framework',
            '2026_09_25_000001_create_app_settings_table', '2026_09_27_000001_create_grammar_topics_table',
            '2026_09_29_000001_create_lesson_block_responses_table',
            '2026_09_29_000002_create_lesson_grammar_item_progress_table',
            '2026_09_29_000003_add_reviews_to_lesson_grammar_item_progress',
            '2026_10_01_000001_add_grammar_stage_references'] as $migration) {
            (require database_path("migrations/$migration.php"))->up();
        }
        DB::table('users')->insert([['id' => 5], ['id' => 9]]);
        DB::table('course_groups')->insert(['id' => 1, 'seed_key' => 'introduction:lv:A1']);
    }

    private function seedPilots(): void { $this->artisan('grammar:prepare-pilots', ['--write' => true])->assertExitCode(0); }
    private function requestAs(int $id, array $data = []): Request
    {
        $request = Request::create('/api/lessons/test', 'POST', $data);
        $request->setUserResolver(fn () => (object) ['id' => $id]);
        return $request;
    }
    private function answers(LessonBlockVariant $variant): array
    {
        return array_map(fn ($q) => $q['accepted_answers'][0], $variant->config['questions']);
    }

    public function test_pilots_validate_all_templates_and_preserve_admin_changes(): void
    {
        $this->artisan('grammar:prepare-pilots')->assertExitCode(0);
        $this->assertSame(0, LessonPage::count());
        $this->seedPilots();
        $this->assertSame(4, LessonPage::count());
        $this->assertSame(17, LessonBlock::count());
        $this->assertSame(57, LessonBlockVariant::count());
        foreach (LessonBlockVariant::all() as $variant) {
            if ($variant->config['task_kind'] === 'grammar_items') {
                $this->assertCount(33, $variant->config['items']);
                continue;
            }
            $graded = GrammarTask::grade($variant->config, $this->answers($variant));
            $this->assertCount($variant->block->page->level === 'A2' ? 10 : ($variant->block->page->slug === 'grammar-a1-alphabet' ? 1 : 5), $graded);
            $this->assertTrue(collect($graded)->every('is_correct'));
        }
        $page = LessonPage::first();
        $page->update(['title' => 'Admin edit']);
        $this->seedPilots();
        $this->assertSame('Admin edit', $page->fresh()->title);
        $this->assertSame(57, LessonBlockVariant::count());
    }

    public function test_adjective_endings_have_two_stages_and_five_variants_each(): void
    {
        $this->seedPilots();
        $page = LessonPage::where('slug', 'grammar-a2-adjective-definite-endings')->firstOrFail();
        $this->assertSame('A2', $page->level);
        $this->assertSame(['adjEndings'], $page->grammarTopic->table_keys);
        $blocks = $page->blocks;
        $this->assertSame(['1. Единственное число', '2. Множественное число'], $blocks->pluck('title')->all());
        $this->assertSame([5, 5], $blocks->map(fn ($block) => $block->variants->count())->all());
        $this->assertSame(
            ['labais', 'labā', 'labā', 'labās', 'labajam', 'labajai', 'labo', 'labo', 'labajā', 'labajā'],
            $this->answers($blocks[0]->variants[0]),
        );
        $this->assertSame(
            ['labie', 'labās', 'labo', 'labo', 'labajiem', 'labajām', 'labos', 'labās', 'labajos', 'labajās'],
            $this->answers($blocks[1]->variants[0]),
        );
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($blocks[0], 5);
        $answers = $this->answers($variant);
        $answers[0] = 'nepareizi';
        $result = $service->submitGrammarAttempt(5, $blocks[0], $variant->id, $answers, 0);
        $this->assertSame(90, $result['score']);
        $this->assertSame('gold', $result['rank']);
        $this->assertSame(1, $service->summariesForPages(5, collect([$page]))[$page->id]['passed']);
    }

    public function test_alphabet_links_intro_and_requires_complete_letter_groups(): void
    {
        $this->seedPilots();
        $page = LessonPage::where('slug', 'grammar-a1-alphabet')->firstOrFail();
        $this->assertSame(1, $page->course_group_id);
        $this->assertSame(['alphabet'], $page->grammarTopic->table_keys);
        $this->assertSame(7, $page->blocks->count());
        $this->assertSame([1, 1, 1, 1, 1, 1, 1], $page->blocks->map(fn ($block) => $block->variants->count())->all());

        $set = $page->blocks->firstWhere('seed_key', 'grammar-a1-alphabet-soft')->variants->first()->config;
        $this->assertTrue(GrammarTask::grade($set, ['ņ, Ļ; ķ ģ'])[0]['is_correct']);
        $this->assertTrue(GrammarTask::grade($set, ['ķģļņ'])[0]['is_correct']);
        $this->assertFalse(GrammarTask::grade($set, ['ģ ķ ļ'])[0]['is_correct']);
        $this->assertFalse(GrammarTask::grade($set, ['ģ ķ ļ ņ ņ'])[0]['is_correct']);
        $this->assertFalse(GrammarTask::grade($set, ['ģ ķ ļ ņ č'])[0]['is_correct']);

        $diphthongs = $page->blocks->firstWhere('seed_key', 'grammar-a1-alphabet-diphthongs')->variants->first()->config;
        $this->assertTrue(GrammarTask::grade($diphthongs, ['uo iu eu au oi ui ei ai ie'])[0]['is_correct']);
        $this->assertFalse(GrammarTask::grade($diphthongs, ['ie ai ei ui oi au eu iu'])[0]['is_correct']);
    }

    public function test_compact_soft_consonants_receive_full_credit_in_canonical_scoring(): void
    {
        $this->seedPilots();
        $block = LessonPage::where('slug', 'grammar-a1-alphabet')->firstOrFail()
            ->blocks->firstWhere('seed_key', 'grammar-a1-alphabet-soft');
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($block, 5);
        $result = $service->submitGrammarAttempt(5, $block, $variant->id, ['ķģļņ'], 0);
        $this->assertSame(100, $result['score']);
        $this->assertTrue($result['feedback'][0]['is_correct']);
        $this->assertSame(100, $result['progress']['best_score']);
        $this->assertTrue($result['completed']);
        $this->assertSame(['ķģļņ'], LessonBlockAttempt::firstOrFail()->answer['answers']);
    }

    public function test_legacy_alphabet_variants_do_not_rotate_or_accept_admin_override(): void
    {
        $this->seedPilots();
        $block = LessonPage::where('slug', 'grammar-a1-alphabet')->firstOrFail()
            ->blocks->firstWhere('seed_key', 'grammar-a1-alphabet-sibilants');
        $service = new LessonProgressService;
        $canonical = $service->selectedVariant($block, 5);
        $legacy = $canonical->replicate();
        $legacy->position = 1;
        $legacy->seed_key = 'grammar-a1-alphabet-sibilants-legacy';
        $legacy->title = 'Вариант 2';
        $legacy->save();

        $service->submitGrammarAttempt(5, $block, $canonical->id, ['Č Š Ž'], 0, false, true);
        $this->assertSame($canonical->id, $service->selectedVariant($block->fresh(), 5)->id);
        try {
            $service->submitGrammarAttempt(5, $block, $legacy->id, ['Č Š Ž'], 0, true, true);
            $this->fail('Legacy variant accepted');
        } catch (ValidationException) {
            $this->assertSame(1, LessonBlockAttempt::count());
        }

        $letterBlock = $block->page->blocks->firstWhere('seed_key', 'grammar-a1-alphabet-letters');
        $letterCanonical = $letterBlock->variants->first();
        $letterLegacy = $letterCanonical->replicate();
        $letterLegacy->position = 1;
        $letterLegacy->seed_key = 'grammar-a1-alphabet-letters-legacy';
        $letterConfig = $letterLegacy->config;
        $letterConfig['items'] = array_reverse($letterConfig['items']);
        $letterLegacy->config = $letterConfig;
        $letterLegacy->save();
        DB::table('lesson_block_attempts')->insert([
            'user_id' => 5, 'lesson_block_id' => $letterBlock->id, 'lesson_block_variant_id' => $letterLegacy->id,
            'answer' => json_encode(['a']), 'score' => 0, 'is_practice' => true,
            'cooldown_tier' => 0, 'scored_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);

        (require database_path('migrations/2026_09_30_000001_consolidate_alphabet_variants.php'))->up();
        $this->assertSame(7, LessonBlockVariant::whereIn('lesson_block_id', $block->page->blocks->pluck('id'))->count());
        $this->assertSame('Задание', $canonical->fresh()->title);
        $this->assertSame($canonical->id, LessonBlockAttempt::where('lesson_block_id', $block->id)->first()->lesson_block_variant_id);
        $this->assertSame($letterCanonical->id, LessonBlockAttempt::where('lesson_block_id', $letterBlock->id)->first()->lesson_block_variant_id);
    }

    public function test_alphabet_duplicate_with_different_attempt_content_is_not_deleted(): void
    {
        $this->seedPilots();
        $page = LessonPage::where('slug', 'grammar-a1-alphabet')->firstOrFail();
        $letterBlock = $page->blocks->firstWhere('seed_key', 'grammar-a1-alphabet-letters');
        $unused = $letterBlock->variants->first()->replicate();
        $unused->position = 1;
        $unused->seed_key = 'grammar-a1-alphabet-letters-unused';
        $unused->save();
        $block = $page->blocks->firstWhere('seed_key', 'grammar-a1-alphabet-sibilants');
        $canonical = $block->variants->first();
        $extra = $canonical->replicate();
        $extra->position = 1;
        $extra->seed_key = 'grammar-a1-alphabet-sibilants-legacy';
        $config = $extra->config;
        $config['questions'][0]['prompt'] = 'Другой вопрос';
        $extra->config = $config;
        $extra->save();
        DB::table('lesson_block_attempts')->insert([
            'user_id' => 5, 'lesson_block_id' => $block->id, 'lesson_block_variant_id' => $extra->id,
            'answer' => json_encode(['Č Š Ž']), 'score' => 100, 'is_practice' => true,
            'cooldown_tier' => 0, 'scored_at' => now(), 'created_at' => now(), 'updated_at' => now(),
        ]);

        try {
            (require database_path('migrations/2026_09_30_000001_consolidate_alphabet_variants.php'))->up();
            $this->fail('Different attempt content was discarded');
        } catch (\RuntimeException) {
            $this->assertDatabaseHas('lesson_block_variants', ['id' => $unused->id]);
            $this->assertDatabaseHas('lesson_block_variants', ['id' => $extra->id]);
            $this->assertSame($extra->id, LessonBlockAttempt::first()->lesson_block_variant_id);
        }
    }

    public function test_alphabet_letters_are_private_and_learned_one_by_one_in_both_directions(): void
    {
        $this->seedPilots();
        $block = LessonPage::where('slug', 'grammar-a1-alphabet')->firstOrFail()->blocks->first();
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($block, 5);
        $this->assertSame('grammar_items', $variant->config['task_kind']);
        $this->assertSame($variant->id, $service->selectedVariant($block, 5)->id);
        $page = (new LessonController($service))->show($this->requestAs(5), 'grammar-a1-alphabet')->getData(true)['data'];
        $this->assertArrayNotHasKey('hint', $page['blocks'][0]['config']['items'][0]);
        $this->assertArrayNotHasKey('letter', $page['blocks'][0]['config']['items'][0]);
        $this->assertSame('direct', $page['blocks'][0]['config']['items'][0]['direction']);

        $first = $variant->config['items'][0];
        $initial = $page['blocks'][0]['config']['items'][0];
        $this->assertSame($first['letter'], $initial['display_letter']);
        $this->assertSame($first['hint'], $initial['display_hint']);
        $this->assertCount(6, $initial['choices']);
        $this->assertSame(1, count(array_filter($initial['choices'], fn ($choice) => $choice === $first['hint'])));
        foreach ($page['blocks'][0]['config']['items'] as $itemState) {
            $this->assertCount(count(array_unique($itemState['choices'])), $itemState['choices']);
            $this->assertContains($itemState['display_hint'], $itemState['choices']);
        }
        $practice = $service->submitGrammarItem(5, $block, $variant->id, $first['key'], 'direct', $first['hint'], 0, false, true);
        $this->assertTrue($practice['is_correct']);
        $this->assertFalse($practice['items'][0]['direct_correct']);
        $wrong = $service->submitGrammarItem(5, $block, $variant->id, $first['key'], 'direct', 'неверно', 0);
        $this->assertFalse($wrong['is_correct']);
        $this->assertTrue($wrong['items'][0]['mode_education']);
        $this->assertFalse($wrong['items'][0]['completed']);
        $this->assertNull($wrong['items'][0]['display_letter']);
        $this->assertSame($first['hint'], $wrong['items'][0]['display_hint']);
        $education = $service->submitGrammarItem(5, $block, $variant->id, $first['key'], 'direct', $first['hint'], 0);
        $this->assertTrue($education['was_education']);
        $this->assertSame(0, $education['items'][0]['steps']);
        $this->assertSame('reverse', $education['items'][0]['direction']);
        $this->assertContains($first['letter'], $education['items'][0]['choices']);
        try {
            $service->submitGrammarItem(5, $block, $variant->id, $first['key'], 'direct', $first['hint'], 0);
            $this->fail('Cooldown bypassed');
        } catch (ValidationException) { $this->assertTrue(true); }
        $service->submitGrammarItem(5, $block, $variant->id, $first['key'], 'reverse', 'неверно', 0);
        $reverseEducation = $service->submitGrammarItem(5, $block, $variant->id, $first['key'], 'reverse', $first['letter'], 0);
        $this->assertFalse($reverseEducation['items'][0]['available']);
        $this->assertNotNull($reverseEducation['items'][0]['next_review_at']);
        $this->travel(31)->minutes();
        $directFirst = $service->submitGrammarItem(5, $block, $variant->id, $first['key'], 'direct', $first['hint'], 0);
        $this->assertSame(1, $directFirst['items'][0]['steps']);
        $service->submitGrammarItem(5, $block, $variant->id, $first['key'], 'reverse', $first['letter'], 2);
        $this->travel(4)->hours();
        try {
            $service->submitGrammarItem(5, $block, $variant->id, $first['key'], 'direct', $first['hint'], 0);
            $this->fail('20-hour cooldown bypassed');
        } catch (ValidationException) { $this->assertTrue(true); }
        $reverseSecond = $service->submitGrammarItem(5, $block, $variant->id, $first['key'], 'reverse', $first['letter'], 2);
        $this->assertSame(3, $reverseSecond['items'][0]['steps']);
        $this->travel(17)->hours();
        $directSecond = $service->submitGrammarItem(5, $block, $variant->id, $first['key'], 'direct', $first['hint'], 0);
        $this->assertTrue($directSecond['items'][0]['completed']);
        $this->assertSame(4, $directSecond['items'][0]['steps']);
        $this->assertSame(3, $directSecond['progress']['best_score']);
        $this->assertFalse($service->grammarItemStateFor(9, $block, $variant->config)[0]['completed']);
        $this->assertSame(0, LessonBlockCompletion::where('user_id', 9)->count());
    }

    public function test_item_directions_have_independent_cooldowns_and_allow_readonly_practice(): void
    {
        $this->freezeTime();
        $this->seedPilots();
        $block = LessonPage::where('slug', 'grammar-a1-alphabet')->firstOrFail()->blocks->first();
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($block, 5);
        $item = $variant->config['items'][0];
        $state = $service->grammarItemStateFor(5, $block, $variant->config)[0];
        $this->assertTrue($state['directions']['direct']['available']);
        $this->assertTrue($state['directions']['reverse']['available']);

        // A queued reverse card can be answered without first answering the direct card.
        $reverse = $service->submitGrammarItem(5, $block, $variant->id, $item['key'], 'reverse', $item['letter'], 2);
        $this->assertSame(1, $reverse['items'][0]['directions']['reverse']['correct_attempts']);
        $this->assertSame(now('UTC')->addHours(3)->toIso8601String(), $reverse['items'][0]['directions']['reverse']['next_review_at']);
        $this->assertTrue($reverse['items'][0]['directions']['direct']['available']);
        $this->assertNull($reverse['items'][0]['next_review_at']);
        $direct = $service->submitGrammarItem(5, $block, $variant->id, $item['key'], 'direct', $item['hint'], 0);
        $this->assertSame(now('UTC')->addHours(20)->toIso8601String(), $direct['items'][0]['directions']['direct']['next_review_at']);
        $before = DB::table('lesson_grammar_item_progress')->where('user_id', 5)->first();
        $practice = $service->submitGrammarItem(5, $block, $variant->id, $item['key'], 'reverse', 'wrong', 2, false, true);
        $this->assertTrue($practice['is_practice']);
        $this->assertEquals($before, DB::table('lesson_grammar_item_progress')->where('user_id', 5)->first());
        $this->assertSame(1, $practice['items'][0]['directions']['reverse']['correct_attempts']);
        try {
            $service->submitGrammarItem(5, $block, $variant->id, $item['key'], 'reverse', $item['letter'], 2);
            $this->fail('Scored attempt bypassed the reverse cooldown');
        } catch (ValidationException) { $this->assertTrue(true); }
        $service->submitGrammarItem(9, $block, $variant->id, $item['key'], 'direct', $item['hint'], 0, false, true);
        $this->assertSame(0, DB::table('lesson_grammar_item_progress')->where('user_id', 9)->count());
        $this->travel(181)->minutes();
        $state = $service->grammarItemStateFor(5, $block, $variant->config)[0];
        $this->assertTrue($state['directions']['reverse']['available']);
        $this->assertFalse($state['directions']['direct']['available']);
        $skip = $service->submitGrammarItem(5, $block, $variant->id, $item['key'], 'reverse', '', 2);
        $this->assertFalse($skip['is_correct']);
        $this->assertTrue($skip['items'][0]['directions']['reverse']['mode_education']);
        $this->assertNull($skip['items'][0]['directions']['reverse']['next_review_at']);
        $education = $service->submitGrammarItem(5, $block, $variant->id, $item['key'], 'reverse', $item['letter'], 2);
        $this->assertTrue($education['was_education']);
        $this->assertSame(1, $education['items'][0]['directions']['reverse']['correct_attempts']);
        $this->assertSame(now('UTC')->addMinutes(30)->toIso8601String(), $education['items'][0]['directions']['reverse']['next_review_at']);
    }

    public function test_single_topic_import_does_not_create_other_pilots(): void
    {
        $this->artisan('grammar:prepare-pilots', [
            '--slug' => 'grammar-a2-adjective-definite-endings', '--write' => true,
        ])->assertExitCode(0);
        $this->assertSame(['grammar-a2-adjective-definite-endings'], LessonPage::pluck('slug')->all());
        $this->assertSame(2, LessonBlock::count());
        $this->assertSame(10, LessonBlockVariant::count());
        $this->artisan('grammar:prepare-pilots', ['--slug' => 'missing-topic', '--write' => true])->assertExitCode(1);
        $this->assertSame(1, LessonPage::count());
    }

    public function test_api_hides_answers_and_keeps_progress_private(): void
    {
        $this->seedPilots();
        $service = new LessonProgressService;
        $controller = new LessonController($service);
        $page = LessonPage::first();
        $block = $page->blocks->first();
        $variant = $service->selectedVariant($block, 5);
        $service->submitGrammarAttempt(5, $block, $variant->id, $this->answers($variant), 0);
        $student = $controller->show($this->requestAs(9), $page->slug)->getData(true)['data'];
        $this->assertNull($student['blocks'][0]['progress']['best_score']);
        $this->assertArrayNotHasKey('accepted_answers', $student['blocks'][0]['config']['questions'][0]);
        $this->assertArrayNotHasKey('explanation', $student['blocks'][0]['config']['questions'][0]);
        $this->assertSame(0, $student['grammar_summary']['passed']);
        $catalog = (new GrammarTopicController)->index($this->requestAs(5));
        $this->assertStringContainsString('private', $catalog->headers->get('Cache-Control'));
        $blocks = $catalog->getData(true)['data'][0]['blocks'];
        $this->assertCount(4, $blocks);
        $this->assertSame($block->id, $blocks[0]['id']);
        $this->assertSame(100, $blocks[0]['best_score']);
        $this->assertSame('diamond', $blocks[0]['rank']);
        $this->assertArrayNotHasKey('config', $blocks[0]);
        $private = (new GrammarTopicController)->index($this->requestAs(9))->getData(true)['data'][0]['blocks'];
        $this->assertNull($private[0]['best_score']);
        $this->assertNull($private[0]['rank']);
        $this->assertSame(1, $controller->show($this->requestAs(5), $page->slug)->getData(true)['data']['grammar_summary']['passed']);
    }

    public function test_practice_cooldown_rotation_and_maximum_score(): void
    {
        $this->seedPilots();
        $service = new LessonProgressService;
        $block = LessonBlock::first();
        $variant = $service->selectedVariant($block, 5);
        $practice = $service->submitGrammarAttempt(5, $block, $variant->id, $this->answers($variant), 0, false, true);
        $this->assertTrue($practice['is_practice']);
        $this->assertNull($practice['progress']['best_score']);
        $this->assertNull($practice['progress']['next_scored_at']);
        $this->assertSame(0, LessonBlockCompletion::count());
        $next = $service->selectedVariant($block, 5);
        $this->assertNotSame($variant->id, $next->id);
        $answers = $this->answers($next); $answers[0] = 'incorrect';
        $scored = $service->submitGrammarAttempt(5, $block, $next->id, $answers, 2);
        $this->assertSame(80, $scored['score']);
        $this->assertSame('silver', $scored['rank']);
        $this->assertEqualsWithDelta(10800, strtotime($scored['progress']['next_scored_at']) - time(), 3);
        $next = $service->selectedVariant($block, 5);
        $during = $service->submitGrammarAttempt(5, $block, $next->id, $this->answers($next), 0);
        $this->assertTrue($during['is_practice']);
        $this->assertSame(80, $during['progress']['best_score']);
        $this->travel(4)->hours();
        $next = $service->selectedVariant($block, 5);
        $later = $service->submitGrammarAttempt(5, $block, $next->id, array_fill(0, 5, 'incorrect'), 0);
        $this->assertFalse($later['is_practice']);
        $this->assertSame(80, $later['progress']['best_score']);
        $this->assertEqualsWithDelta(72000, strtotime($later['progress']['next_scored_at']) - now()->timestamp, 3);
        $this->assertSame(4, LessonBlockAttempt::count());
    }

    public function test_grammar_submit_controller_and_completion_guard(): void
    {
        $this->seedPilots();
        $service = new LessonProgressService;
        $block = LessonBlock::first(); $variant = $service->selectedVariant($block, 5);
        $controller = new LessonController($service);
        $result = $controller->submitAttempt($this->requestAs(5, ['variant_id' => $variant->id, 'answers' => $this->answers($variant), 'practice' => true]), $block)->getData(true)['data'];
        $this->assertSame(100, $result['score']);
        $this->assertTrue($result['is_practice']);
        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);
        $controller->completeBlock($this->requestAs(5), $block);
    }

    public function test_wrong_variant_is_rejected_and_drafts_are_hidden(): void
    {
        $this->seedPilots();
        $service = new LessonProgressService;
        $block = LessonBlock::first(); $assigned = $service->selectedVariant($block, 5);
        $other = $block->variants->firstWhere('id', '!=', $assigned->id);
        try {
            $service->submitGrammarAttempt(5, $block, $other->id, $this->answers($other), 0);
            $this->fail('Wrong variant accepted');
        } catch (ValidationException) { $this->assertSame(0, LessonBlockAttempt::count()); }
        $block->page->update(['status' => 'draft']);
        $this->expectException(\Illuminate\Database\Eloquent\ModelNotFoundException::class);
        (new LessonController($service))->show($this->requestAs(5), $block->page->slug);
    }

    public function test_summary_requires_every_required_block(): void
    {
        $summary = GrammarTopicProgress::summary([
            ['is_required' => true, 'progress' => ['best_score' => 100]],
            ['is_required' => true, 'progress' => ['best_score' => 80]],
            ['is_required' => false, 'progress' => null],
        ]);
        $this->assertSame(60, $summary['score']);
        $this->assertSame('bronze', $summary['rank']);
        $this->assertSame(2, $summary['passed']);
        $partial = GrammarTopicProgress::summary([
            ['is_required' => true, 'progress' => ['best_score' => 100]],
            ['is_required' => true, 'progress' => ['best_score' => 20]],
        ]);
        $this->assertSame(60, $partial['score']);
        $this->assertNull($partial['rank']);
    }

    public function test_grammar_item_backfill_restores_score_without_lowering_older_record(): void
    {
        $this->seedPilots();
        $block = LessonPage::where('slug', 'grammar-a1-alphabet')->firstOrFail()
            ->blocks->firstWhere('seed_key', 'grammar-a1-alphabet-letters');
        $this->assertNotNull($block);
        $keys = array_column($block->variants->first()->config['items'], 'key');
        foreach (array_slice($keys, 0, 3) as $key) {
            DB::table('lesson_grammar_item_progress')->insert([
                'user_id' => 5, 'lesson_block_id' => $block->id, 'item_key' => $key,
                'direct_correct_attempts' => 2, 'reverse_correct_attempts' => 2,
                'direct_correct' => true, 'reverse_correct' => true,
            ]);
        }
        DB::table('lesson_block_progress')->insert([
            'user_id' => 5, 'lesson_block_id' => $block->id, 'best_score' => 5,
        ]);
        (require database_path('migrations/2026_09_29_000004_backfill_grammar_item_block_scores.php'))->up();
        $this->assertSame(9, (int) DB::table('lesson_block_progress')->where('user_id', 5)
            ->where('lesson_block_id', $block->id)->value('best_score'));
        DB::table('lesson_block_progress')->where('user_id', 5)->where('lesson_block_id', $block->id)
            ->update(['best_score' => 80]);
        (require database_path('migrations/2026_09_29_000004_backfill_grammar_item_block_scores.php'))->up();
        $this->assertSame(80, (int) DB::table('lesson_block_progress')->where('user_id', 5)
            ->where('lesson_block_id', $block->id)->value('best_score'));
    }

    public function test_patik_link_migration_preserves_existing_links_content_and_attempts(): void
    {
        $this->seedPilots();
        $page = LessonPage::where('slug', 'grammar-a1-patik-infinitive')->firstOrFail();
        $topic = $page->grammarTopic;
        $topic->update(['table_keys' => ['verbsTablesContainer', 'pron1'], 'rule' => 'Admin rule']);
        $block = $page->blocks->first();
        $service = new LessonProgressService;
        $variant = $service->selectedVariant($block, 5);
        $service->submitGrammarAttempt(5, $block, $variant->id, $this->answers($variant), 0);
        $migration = require database_path('migrations/2026_09_27_000002_link_patik_grammar_table.php');
        $migration->up();
        $migration->up();
        $this->assertSame(['verbsTablesContainer', 'pron1', 'patikInfinitive'], $topic->fresh()->table_keys);
        $this->assertSame('Admin rule', $topic->fresh()->rule);
        $this->assertSame(1, LessonBlockAttempt::count());
        $this->assertSame(57, LessonBlockVariant::count());
    }

    public function test_normalization_preserves_accents_and_accepts_unicode_composition(): void
    {
        $config = ['task_kind' => 'grammar_gap', 'questions' => [['prompt' => 'Man patīk {{blank}}.', 'accepted_answers' => ['runāt']]]];
        $this->assertTrue(GrammarTask::grade($config, ["  RUNA\u{0304}T  "])[0]['is_correct']);
        $this->assertFalse(GrammarTask::grade($config, ['runat'])[0]['is_correct']);
        $this->expectException(ValidationException::class);
        GrammarTask::grade($config, []);
    }

    public function test_invalid_select_and_unbuildable_order_are_rejected(): void
    {
        $config = ['task_kind' => 'grammar_select', 'questions' => [['prompt' => 'Izvēlies', 'options' => ['Man', 'Es'], 'accepted_answers' => ['Man']]]];
        try { GrammarTask::grade($config, ['secret']); $this->fail('Invalid option accepted'); }
        catch (ValidationException) { $this->assertTrue(true); }
        $this->expectException(ValidationException::class);
        GrammarTask::validate(['task_kind' => 'grammar_order', 'questions' => [['prompt' => 'Order', 'tokens' => ['Man', 'patīk', 'lasīt', '.'], 'accepted_answers' => ['Man patīk runāt.']]]]);
    }

    public function test_admin_editor_preserves_imported_variant_positions(): void
    {
        $this->seedPilots();
        $schema = \App\Filament\Resources\GrammarTopics\GrammarTopicResource::form(\Filament\Schemas\Schema::make());
        $blocks = collect($schema->getComponents(withHidden: true))->first(fn ($c) => $c instanceof \Filament\Forms\Components\Repeater && $c->getName() === 'blocks');
        $variants = collect($blocks->getDefaultChildComponents())->first(fn ($c) => $c instanceof \Filament\Forms\Components\Repeater && $c->getName() === 'variants');
        foreach (LessonBlock::first()->variants as $index => $variant) {
            $data = $variants->mutateRelationshipDataBeforeSave(['position' => $index + 1, 'config' => $variant->config], $variant);
            $variant->update($data);
            $this->assertSame($index, $variant->fresh()->position);
        }
    }

    public function test_only_three_grammar_variants_rotate_and_hidden_ids_cannot_be_submitted(): void
    {
        $this->seedPilots();
        $block = LessonBlock::has('variants', '>', 3)->firstOrFail();
        $variants = $block->variants()->orderBy('position')->get();
        $service = new LessonProgressService;
        $available = $variants->take(3)->pluck('id')->all();
        $seen = [];
        for ($i = 0; $i < 6; $i++) {
            $variant = $service->selectedVariant($block, 5);
            $this->assertContains($variant->id, $available);
            $seen[] = $variant->id;
            $service->submitGrammarAttempt(5, $block, $variant->id, $this->answers($variant), 0);
        }
        $this->assertCount(3, array_unique($seen));
        $this->assertSame(100, $service->progressFor(5, $block)['best_score']);
        $this->assertCount(5, $block->fresh('variants')->variants);
        $this->assertNull($service->publishedVariant($block, $variants[3]->id));
        try {
            $service->submitGrammarAttempt(5, $block, $variants[4]->id, $this->answers($variants[4]), 0, false, true);
            $this->fail('Hidden grammar variant was accepted');
        } catch (ValidationException) {
            $this->assertSame(6, LessonBlockAttempt::count());
        }
    }

    public function test_admin_grammar_list_uses_three_public_numbers_and_retains_old_progress(): void
    {
        $this->seedPilots();
        $block = LessonBlock::has('variants', '>', 3)->firstOrFail();
        $variants = $block->variants()->orderBy('position')->get();
        LessonBlockProgress::create(['user_id' => 5, 'lesson_block_id' => $block->id,
            'best_score' => 90, 'best_rank' => 'gold', 'next_scored_at' => now()->addHour()]);
        LessonBlockCompletion::create(['user_id' => 5, 'lesson_block_id' => $block->id, 'completed_at' => now()]);
        $admin = new class extends \App\Models\User {
            public function isFrontendAdmin(): bool { return true; }
        };
        $admin->id = 5;
        $request = $this->requestAs(5, ['variants' => [$block->id => $variants[4]->id]]);
        $request->setUserResolver(fn () => $admin);
        $data = (new LessonController(new LessonProgressService))->show($request, $block->page->slug)->getData(true)['data'];
        $shown = collect($data['blocks'])->firstWhere('id', $block->id);
        $this->assertSame(['Вариант 1', 'Вариант 2', 'Вариант 3'], array_column($shown['variants'], 'title'));
        $this->assertContains($shown['variant_id'], $variants->take(3)->pluck('id')->all());
        $this->assertMatchesRegularExpression('/^Вариант [1-3]$/u', $shown['assigned_variant_title']);
        $this->assertSame(90, $shown['progress']['best_score']);
        $this->assertTrue($shown['completed']);
        $this->assertSame(5, $block->variants()->count());
    }
}
