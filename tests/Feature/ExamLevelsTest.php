<?php

namespace Tests\Feature;

use App\Models\{CourseExam, ExamVariant, ExamAttempt};
use App\Services\Exams\{ExamDefinition, ExamAi, ExamGrader};
use Illuminate\Support\Facades\{Http, Schema, Storage};
use Tests\TestCase;

class ExamLevelsTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        Storage::fake('local');
        Schema::create('users', function ($t) { $t->id(); });
        (require database_path('migrations/2026_09_26_000001_create_course_exams.php'))->up();
        (require database_path('migrations/2026_09_26_000002_limit_exam_grading_retries.php'))->up();
        (require database_path('migrations/2026_10_03_000001_create_exam_variant_archives.php'))->up();
    }

    public function test_authored_levels_have_five_valid_variants_with_level_specific_scoring(): void
    {
        foreach (['A2'=>[15,[1500,1800,2100,900]], 'B1'=>[20,[2400,2400,2400,900]], 'B2'=>[25,[2400,2400,2400,1200]]] as $level=>[$points,$seconds]) {
            $variants = require resource_path('course/exams/'.strtolower($level).'.php');
            $this->assertCount(5, $variants);
            $this->assertCount(5, array_unique(array_column($variants, 'title')));
            foreach ($variants as $variant) {
                app(ExamDefinition::class)->validate($variant);
                $this->assertSame($level, $variant['level']);
                $this->assertSame($seconds, array_column($variant['sections'], 'seconds'));
                foreach ($variant['sections'] as $section) {
                    $questions = app(ExamDefinition::class)->questions($section);
                    $this->assertEquals($points, array_sum(array_column($questions, 'points')));
                    foreach ($questions as $q) {
                        if ($q['type'] === 'choice') $this->assertCount(count($q['options']), array_unique(array_column($q['options'], 'id')));
                        if (!empty($q['image'])) $this->assertFileExists(base_path('frontend/public'.$q['image']));
                    }
                    foreach ($section['tasks'] as $task) if (!empty($task['image'])) $this->assertFileExists(base_path('frontend/public'.$task['image']));
                }
                $this->assertCount(3, $variant['sections'][0]['tasks']);
                foreach ($variant['sections'][0]['tasks'] as $task) {
                    $characters = 0;
                    foreach ($task['segments'] as $segment) {
                        $this->assertContains($segment['speaker'], ['male','female']);
                        $this->assertNotEmpty($segment['text']);
                        $characters += mb_strlen($segment['text']);
                    }
                    $this->assertGreaterThan(100, $characters);
                    $this->assertLessThanOrEqual(5000, $characters);
                    $this->assertNotEmpty($task['transcript']);
                }
            }
        }
        Http::assertNothingSent();
    }

    public function test_dry_run_does_not_write_or_contact_audio_provider(): void
    {
        foreach (['A2','B1','B2'] as $level) $this->artisan('exams:prepare', ['level'=>$level])->assertSuccessful();
        $this->assertSame(0, CourseExam::count());
        $this->assertSame(0, ExamVariant::count());
        Http::assertNothingSent();
    }

    public function test_import_is_idempotent_and_preserves_admin_edits(): void
    {
        $this->artisan('exams:prepare', ['level'=>'A2','--write'=>true])->assertSuccessful();
        $variant = ExamVariant::firstOrFail();
        $content = $variant->content;
        $content['title'] = 'Administrator version';
        $variant->update(['title'=>'Administrator version','content'=>$content]);
        $this->artisan('exams:prepare', ['level'=>'A2','--write'=>true])->assertSuccessful();
        $this->assertSame(5, ExamVariant::count());
        $this->assertSame($content, $variant->fresh()->content);
        $this->assertSame('Administrator version', $variant->fresh()->title);
        $this->assertSame(0, CourseExam::where('is_published',true)->count());
        Http::assertNothingSent();
    }

    public function test_invalid_level_is_rejected_without_writes(): void
    {
        $this->artisan('exams:prepare', ['level'=>'C2','--write'=>true])->assertFailed();
        $this->assertSame(0, CourseExam::count());
        Http::assertNothingSent();
    }

    public function test_draft_import_does_not_require_a_paid_generation_budget(): void
    {
        $this->artisan('exams:prepare', ['level'=>'B2','--write'=>true,'--max-characters'=>0])->assertSuccessful();
        $this->assertSame(5, ExamVariant::count());
        $this->assertSame(0, ExamVariant::where('is_published',true)->count());
        Http::assertNothingSent();
    }

    public function test_generation_budget_stops_before_any_provider_call(): void
    {
        $this->artisan('exams:prepare', ['level'=>'B2','--generate'=>true,'--max-characters'=>0])->assertFailed();
        $this->assertSame(0, ExamVariant::where('is_published',true)->count());
        Http::assertNothingSent();
    }

    public function test_reading_revision_packs_preserve_timers_points_and_translate_every_key(): void
    {
        foreach (['A2' => [15, 1800], 'B1' => [20, 2400], 'B2' => [25, 2400]] as $level => [$points, $seconds]) {
            $pack = json_decode(file_get_contents(resource_path('course/exams/revisions/2026-10-03-'.strtolower($level).'-reading.json')), true, flags: JSON_THROW_ON_ERROR);
            $source = (static fn ($level) => require resource_path('course/exams/'.strtolower($level).'.php'))($level);
            $this->assertCount(5, $pack['variants']);
            $this->assertSame([1, 2, 3, 4, 5], array_column($pack['variants'], 'position'));
            foreach ($pack['variants'] as $entry) {
                $this->assertSame($level, $entry['level']);
                $this->assertSame(['reading'], array_keys($entry['replace_sections']));
                $this->assertEmpty($entry['question_changes'] ?? []);
                $section = $entry['replace_sections']['reading'];
                $this->assertSame($seconds, $section['seconds']);
                $content = $source[$entry['position'] - 1];
                $content['sections'][1] = $section;
                app(ExamDefinition::class)->validate($content);
                $questions = app(ExamDefinition::class)->questions($section);
                $this->assertEquals($points, array_sum(array_column($questions, 'points')));
                foreach ($questions as $question) {
                    $this->assertContains($question['type'], ['choice', 'short']);
                    $this->assertNotEmpty($question['explanation']);
                    $this->assertNotEmpty($question['explanation_translations']['ru']);
                    $this->assertNotEmpty($question['explanation_translations']['uk']);
                }
            }
        }
        Http::assertNothingSent();
    }

    public function test_all_revised_reading_keys_receive_full_credit_in_canonical_grading(): void
    {
        \Illuminate\Support\Facades\DB::table('users')->insert(['id' => 1]);
        $ai = \Mockery::mock(ExamAi::class);
        $ai->shouldReceive('assess')->with([], \Mockery::any())->andReturn([]);
        $definition = app(ExamDefinition::class);
        $grader = new ExamGrader($definition, $ai);
        foreach (['A2' => 15, 'B1' => 20, 'B2' => 25] as $level => $points) {
            $exam = CourseExam::create(['level' => $level, 'learn_lang' => 'lv', 'title' => $level]);
            $pack = json_decode(file_get_contents(resource_path('course/exams/revisions/2026-10-03-'.strtolower($level).'-reading.json')), true, flags: JSON_THROW_ON_ERROR);
            $source = (static fn ($level) => require resource_path('course/exams/'.strtolower($level).'.php'))($level);
            foreach ($pack['variants'] as $entry) {
                $snapshot = $source[$entry['position'] - 1];
                $snapshot['sections'][1] = $entry['replace_sections']['reading'];
                $variant = ExamVariant::create(['course_exam_id' => $exam->id, 'position' => $entry['position'],
                    'title' => $snapshot['title'], 'content' => $snapshot]);
                $answers = [];
                foreach ($definition->questions($snapshot['sections'][1]) as $id => $question) {
                    $answers[$id] = ['text' => $question['type'] === 'choice' ? $question['correct'] : $question['accepted'][0]];
                }
                $attempt = ExamAttempt::create(['user_id' => 1, 'course_exam_id' => $exam->id, 'exam_variant_id' => $variant->id,
                    'student_name' => 'Synthetic', 'snapshot' => $snapshot, 'answers' => $answers, 'playbacks' => [],
                    'status' => 'pending', 'started_at' => now(), 'deadline_at' => now(), 'submitted_at' => now()]);
                $grader->grade($attempt->id);
                $this->assertSame('completed', $attempt->fresh()->status);
                $result = collect($attempt->fresh()->results)->firstWhere('skill', 'reading');
                $this->assertEquals($points, $result['points']);
                $this->assertEquals(100, $result['percent']);
                $this->assertTrue($result['passed']);
            }
        }
        Http::assertNothingSent();
    }
}
