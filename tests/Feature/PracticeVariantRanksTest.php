<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\LessonController;
use App\Models\LessonBlock;
use App\Models\LessonBlockAttempt;
use App\Models\LessonBlockCompletion;
use App\Models\LessonBlockProgress;
use App\Models\LessonBlockResponse;
use App\Models\LessonBlockVariant;
use App\Models\LessonPage;
use App\Services\LessonProgressService;
use App\Services\PracticeVariantRanks;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PracticeVariantRanksTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('users', fn ($table) => $table->id());
        Schema::create('course_groups', fn ($table) => $table->id());
        foreach ([
            '2026_09_11_000002_create_lesson_pages_table',
            '2026_09_11_000003_create_lesson_blocks_table',
            '2026_09_11_000005_create_lesson_block_completions_table',
            '2026_09_22_000001_add_course_skill_lesson_framework',
            '2026_09_25_000001_create_app_settings_table',
            '2026_09_29_000001_create_lesson_block_responses_table',
            '2026_10_01_000001_add_grammar_stage_references',
            '2026_09_27_000001_create_grammar_topics_table',
            '2026_10_13_000001_add_pending_assistance_to_lesson_block_progress',
            '2026_10_13_000002_add_practice_variant_archive',
        ] as $migration) {
            (require database_path("migrations/$migration.php"))->up();
        }
        DB::table('users')->insert([['id' => 5], ['id' => 9]]);
        DB::table('course_groups')->insert([['id' => 1], ['id' => 2]]);
    }

    public function test_legacy_optional_course_translation_becomes_required_without_changing_other_blocks(): void
    {
        $page = $this->page('reading');
        $this->variant($this->block($page));
        $translation = $this->block($page, false);
        $this->variant($translation, 0, 'lv_to_ru');
        $optional = $this->block($page, false);
        $this->variant($optional);
        $standalone = $this->block($this->page('reading', ['course_group_id' => null]), false);
        $this->variant($standalone, 0, 'lv_to_ru');
        $migration = require database_path('migrations/2026_10_15_000001_require_course_reading_translations.php');
        $migration->up();
        $migration->up();
        $this->assertTrue($translation->fresh()->is_required);
        $this->assertFalse($optional->fresh()->is_required);
        $this->assertFalse($standalone->fresh()->is_required);
        $summary = app(PracticeVariantRanks::class)->summariesForPages(5, $page, collect([$page]));
        $this->assertSame(2, $summary['pages'][$page->id][0]['total']);
        $this->assertFalse($summary['pages'][$page->id][0]['completed']);
    }

    private function page(string $skill, array $attributes = []): LessonPage
    {
        return LessonPage::create([
            'title' => 'Variant ranks', 'slug' => 'ranks-'.LessonPage::count(), 'learn_lang' => 'lv',
            'skill' => $skill, 'course_group_id' => 1, 'is_published' => true, 'status' => 'published', ...$attributes,
        ]);
    }

    private function block(LessonPage $page, bool $required = true, ?string $type = null): LessonBlock
    {
        return $page->blocks()->create([
            'type' => $type ?? $page->skill, 'position' => $page->blocks()->count(), 'is_required' => $required,
        ]);
    }

    private function variant(LessonBlock $block, int $position = 0, ?string $kind = null): LessonBlockVariant
    {
        return $block->variants()->create([
            'position' => $position, 'is_published' => true,
            'config' => ['task_kind' => $kind ?? ($block->type === 'reading' ? 'reading_binary' : $block->type)],
        ]);
    }

    private function attempt(LessonBlockVariant $variant, int $score, bool $practice = false, int $userId = 5): void
    {
        LessonBlockAttempt::create([
            'user_id' => $userId, 'lesson_block_id' => $variant->lesson_block_id, 'lesson_block_variant_id' => $variant->id,
            'answer' => [], 'score' => $score, 'is_practice' => $practice, 'scored_at' => now('UTC'),
        ]);
    }

    private function response(LessonBlockVariant $variant, string $status = 'accepted', int $userId = 5): void
    {
        LessonBlockResponse::create([
            'user_id' => $userId, 'lesson_block_id' => $variant->lesson_block_id, 'lesson_block_variant_id' => $variant->id,
            'answer_text' => 'An answer', 'status' => $status,
        ]);
    }

    private function ranks(LessonPage $context, ?int $userId = 5): array
    {
        return app(PracticeVariantRanks::class)->summariesForPages($userId, $context, LessonPage::all());
    }

    private function show(LessonPage $page, int $userId = 5): array
    {
        $request = Request::create('/api/lessons/'.$page->slug);
        $request->setUserResolver(fn () => (object) ['id' => $userId]);
        return (new LessonController(new LessonProgressService))->show($request, $page->slug)->getData(true)['data'];
    }

    public function test_number_maps_to_available_ids_and_uses_only_user_scored_maxima(): void
    {
        $page = $this->page('reading');
        $first = $this->block($page);
        $second = $this->block($page);
        $archived = $this->variant($first, 0);
        $archived->forceFill(['practice_archived_at' => now()])->save();
        $unpublished = $this->variant($first, 1);
        $unpublished->update(['is_published' => false]);
        $a3 = $this->variant($first, 40);
        $b1 = $this->variant($second, 10);
        $a1 = $this->variant($first, 10);
        $a2 = $this->variant($first, 30);
        $b2 = $this->variant($second, 30);
        $this->variant($second, 40);
        $this->attempt($archived, 100);
        $this->attempt($unpublished, 100);
        $this->attempt($a1, 100);
        $this->attempt($a1, 20);
        $this->attempt($b1, 99);
        $this->attempt($a2, 80);
        $this->attempt($a2, 100, true);
        $this->attempt($b2, 100, true);
        $this->attempt($a2, 100, false, 9);
        $this->attempt($b2, 100, false, 9);
        $this->attempt($a3, 0);
        $rows = $this->ranks($page)['pages'][$page->id];
        $this->assertSame([
            ['number' => 1, 'rank' => 'gold', 'score' => 99, 'passed' => 2, 'total' => 2, 'ungraded_total' => 0, 'completed' => true],
            ['number' => 2, 'rank' => null, 'score' => 40, 'passed' => 1, 'total' => 2, 'ungraded_total' => 0, 'completed' => false],
            ['number' => 3, 'rank' => null, 'score' => 0, 'passed' => 0, 'total' => 2, 'ungraded_total' => 0, 'completed' => false],
        ], $rows);
        $this->assertSame('diamond', $this->ranks($page, 9)['pages'][$page->id][1]['rank']);
        $this->assertNull($this->ranks($page, null)['pages'][$page->id][0]['score']);
    }

    public static function thresholds(): iterable
    {
        foreach ([59 => null, 60 => 'bronze', 79 => 'bronze', 80 => 'silver', 89 => 'silver', 90 => 'gold', 99 => 'gold', 100 => 'diamond'] as $score => $rank) {
            yield (string) $score => [$score, $rank];
        }
    }

    #[DataProvider('thresholds')]
    public function test_rank_uses_stored_discounted_score_at_exact_thresholds(int $score, ?string $rank): void
    {
        $page = $this->page('listening');
        $variant = $this->variant($this->block($page));
        $this->attempt($variant, $score);
        LessonBlockAttempt::query()->update(['answer' => json_encode(['raw_score' => 100, 'score_multiplier' => 0.8])]);
        $summary = $this->ranks($page)['pages'][$page->id][0];
        $this->assertSame($score, $summary['score']);
        $this->assertSame($rank, $summary['rank']);
        $this->assertSame($score >= 60, $summary['completed']);
    }

    public function test_high_average_does_not_cover_a_required_block_below_sixty(): void
    {
        $page = $this->page('listening');
        foreach ([100, 59] as $score) $this->attempt($this->variant($this->block($page)), $score);
        $summary = $this->ranks($page)['pages'][$page->id][0];
        $this->assertSame(79, $summary['score']);
        $this->assertSame(1, $summary['passed']);
        $this->assertFalse($summary['completed']);
        $this->assertNull($summary['rank']);
    }

    public function test_missing_variants_and_legacy_progress_cannot_produce_a_rank(): void
    {
        $page = $this->page('reading');
        $first = $this->block($page);
        $second = $this->block($page);
        $this->attempt($this->variant($first), 100);
        LessonBlockProgress::create(['user_id' => 5, 'lesson_block_id' => $second->id, 'best_score' => 100, 'best_rank' => 'diamond']);
        LessonBlockCompletion::create(['user_id' => 5, 'lesson_block_id' => $second->id, 'completed_at' => now()]);
        $rows = $this->ranks($page)['pages'][$page->id];
        $this->assertSame(50, $rows[0]['score']);
        $this->assertSame(2, $rows[0]['total']);
        $this->assertSame(1, $rows[0]['passed']);
        $this->assertNull($rows[0]['rank']);
        $this->assertNull($rows[1]['score']);
        $this->assertFalse($rows[1]['completed']);
    }

    public function test_reading_translation_counts_towards_rank_and_missing_slots_still_block(): void
    {
        $page = $this->page('reading');
        $translation = $this->variant($this->block($page), 0, 'lv_to_ru');
        $this->attempt($translation, 100);
        $this->response($translation);
        $this->attempt($this->variant($this->block($page)), 80);
        $rows = $this->ranks($page)['pages'][$page->id];
        $this->assertSame(90, $rows[0]['score']);
        $this->assertSame('gold', $rows[0]['rank']);
        $this->assertSame(2, $rows[0]['total']);
        $this->assertSame(0, $rows[0]['ungraded_total']);
        $this->assertSame(2, $rows[1]['total']);
        $this->assertSame(0, $rows[1]['ungraded_total']);
        $this->assertFalse($rows[1]['completed']);
    }

    public function test_pass_fail_requires_exact_accepted_variant_without_numeric_scores(): void
    {
        foreach (['writing', 'speaking'] as $skill) {
            $page = $this->page($skill);
            $block = $this->block($page);
            $first = $this->variant($block, 0);
            $second = $this->variant($block, 1);
            $third = $this->variant($block, 2);
            $this->response($first);
            $this->response($first);
            $this->response($second, 'submitted');
            $this->response($third, 'accepted', 9);
            $this->attempt($second, 100);
            $rows = $this->ranks($page)['pages'][$page->id];
            $this->assertSame([1, 1, 0], array_column($rows, 'passed'));
            $this->assertSame([true, true, false], array_column($rows, 'completed'));
            $this->assertSame([null, 100, null], array_column($rows, 'score'));
            $this->assertSame([null, 'diamond', null], array_column($rows, 'rank'));
        }
    }

    public function test_aggregate_requires_four_skills_and_all_pass_fail_blocks_then_averages_numeric_blocks(): void
    {
        $reading = $this->page('reading');
        $this->attempt($this->variant($this->block($reading)), 99);
        $listening = $this->page('listening');
        $this->attempt($this->variant($this->block($listening)), 100);
        $ranks = $this->ranks($reading);
        $this->assertSame(2, $ranks['aggregate'][0]['passed']);
        $this->assertSame(2, $ranks['aggregate'][0]['total']);
        $this->assertSame([2, 0, 0], array_column($ranks['aggregate'], 'skills_passed'));
        $this->assertSame([4, 4, 4], array_column($ranks['aggregate'], 'skills_total'));
        $this->assertFalse($ranks['aggregate'][0]['completed']);
        $this->assertNull($ranks['aggregate'][0]['rank']);
        $this->assertArrayNotHasKey('skills_passed', $ranks['pages'][$reading->id][0]);
        $this->assertArrayNotHasKey('skills_total', $ranks['pages'][$reading->id][0]);
        $writing = $this->page('writing');
        $this->response($this->variant($this->block($writing)));
        $summary = $this->ranks($reading)['aggregate'][0];
        $this->assertSame(3, $summary['passed']);
        $this->assertSame(3, $summary['total']);
        $this->assertSame(99, $summary['score']);
        $this->assertFalse($summary['completed']);
        $this->assertNull($summary['rank']);

        $speaking = $this->page('speaking');
        $this->assertFalse($this->ranks($reading)['aggregate'][0]['completed']);
        $speech = $this->variant($this->block($speaking));
        $this->assertNull($this->ranks($reading)['aggregate'][0]['rank']);
        $this->response($speech);
        $summary = $this->ranks($reading)['aggregate'][0];
        $this->assertNull($summary['rank'], 'Legacy ungraded passes do not fabricate an overall rank.');
        $this->assertSame(99, $summary['score']);
        $this->assertSame(4, $summary['total']);
        $this->assertSame(4, $summary['skills_passed']);
        $this->assertSame(4, $summary['skills_total']);
        $this->assertTrue($summary['completed']);

        $this->attempt($this->variant($this->block($reading)), 60);
        $summary = $this->ranks($reading)['aggregate'][0];
        $this->assertSame(86, $summary['score']);
        $this->assertNull($summary['rank']);
        $this->assertSame(5, $summary['passed']);
        $this->assertSame(5, $summary['total']);
        $this->attempt($this->variant($this->block($reading, false)), 0);
        $this->block($speaking, false);
        $this->assertSame($summary, $this->ranks($reading)['aggregate'][0]);
    }

    public function test_controller_limits_navigation_and_aggregate_to_the_same_four_published_pages(): void
    {
        $pages = [];
        foreach (['listening', 'reading', 'writing', 'speaking'] as $skill) {
            $page = $pages[$skill] = $this->page($skill);
            $block = $this->block($page);
            foreach ([0, 1, 2] as $position) {
                $variant = $this->variant($block, $position);
                $this->attempt($variant, [60, 80, 100][$position]);
                if (in_array($skill, ['writing', 'speaking'], true)) $this->response($variant);
            }
            LessonBlockCompletion::create(['user_id' => 5, 'lesson_block_id' => $block->id, 'completed_at' => now()]);
        }
        foreach ([['course_group_id' => 2], ['learn_lang' => 'en'], ['status' => 'draft'], ['is_published' => false], []] as $attributes) {
            $foreign = $this->page('reading', $attributes);
            $this->attempt($this->variant($this->block($foreign)), 0);
        }
        $data = $this->show($pages['reading']);
        $this->assertSame(['bronze', 'silver', 'diamond'], array_column($data['practice_variant_ranks'], 'rank'));
        $this->assertSame([4, 4, 4], array_column($data['practice_variant_ranks'], 'total'));
        foreach ($data['practice_navigation'] as $item) {
            $this->assertSame($pages[$item['skill']]->slug, $item['slug']);
            $this->assertTrue($item['completed']);
            $this->assertSame([true, true, true], array_column($item['variant_ranks'], 'completed'));
        }
        $otherUser = $this->show($pages['reading'], 9);
        $this->assertSame([null, null, null], array_column($otherUser['practice_variant_ranks'], 'score'));
        $this->assertSame([0, 0, 0], array_column($otherUser['practice_variant_ranks'], 'passed'));
        $this->assertSame([false, false, false], array_column($otherUser['practice_variant_ranks'], 'completed'));
        $this->assertCount(4, $this->ranks($pages['reading'])['pages']);

        $pages['speaking']->update(['status' => 'draft']);
        $data = $this->show($pages['reading']);
        $this->assertNull($data['practice_navigation'][3]['slug']);
        $this->assertSame([0, 0, 0], array_column($data['practice_navigation'][3]['variant_ranks'], 'total'));
        $this->assertSame([false, false, false], array_column($data['practice_variant_ranks'], 'completed'));
        $this->assertSame([null, null, null], array_column($data['practice_variant_ranks'], 'rank'));
    }

    public function test_empty_and_unassessed_translation_pages_never_claim_completion_or_rank(): void
    {
        $page = $this->page('reading');
        $this->assertSame(app(PracticeVariantRanks::class)->emptySummaries(), $this->ranks($page)['pages'][$page->id]);
        $variant = $this->variant($this->block($page), 0, 'lv_to_ru');
        $this->response($variant);
        $summary = $this->ranks($page)['pages'][$page->id][0];
        $this->assertSame(1, $summary['total']);
        $this->assertSame(0, $summary['ungraded_total']);
        $this->assertNull($summary['score']);
        $this->assertNull($summary['rank']);
        $this->assertFalse($summary['completed']);
    }

    public function test_service_only_reads_and_batches_history_once_for_all_variants_and_pages(): void
    {
        $reading = $this->page('reading');
        $writing = $this->page('writing');
        $this->attempt($this->variant($this->block($reading)), 80);
        $this->response($this->variant($this->block($writing)));
        DB::enableQueryLog();
        try {
            $this->ranks($reading);
            $queries = collect(DB::getQueryLog())->pluck('query');
        } finally {
            DB::disableQueryLog();
            DB::flushQueryLog();
        }
        $this->assertTrue($queries->every(fn ($query) => str_starts_with(strtolower($query), 'select')));
        foreach (['lesson_block_attempts', 'lesson_block_responses'] as $table) {
            $this->assertCount(1, $queries->filter(fn ($query) => str_contains($query, $table)));
        }
    }

    public function test_standalone_controller_response_does_not_gain_practice_ranks(): void
    {
        $page = $this->page('reading', ['course_group_id' => null]);
        $this->assertSame([], $this->show($page)['practice_navigation']);
        $this->assertArrayNotHasKey('practice_variant_ranks', $this->show($page));
    }
}
