<?php

namespace Tests\Feature;

use App\Models\{CourseExam, ExamAttempt, ExamVariant};
use App\Services\Exams\{ExamAi, ExamAudioRecipe, ExamDefinition, ExamGrader};
use Illuminate\Support\Facades\{DB, Http, Schema};
use Tests\TestCase;

class ExamListeningContentTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        Schema::create('users', fn ($t) => $t->id());
        DB::table('users')->insert(['id' => 1]);
        (require database_path('migrations/2026_09_26_000001_create_course_exams.php'))->up();
        (require database_path('migrations/2026_09_26_000002_limit_exam_grading_retries.php'))->up();
        (require database_path('migrations/2026_10_03_000001_create_exam_variant_archives.php'))->up();
    }

    private function pack(string $level): array
    {
        return json_decode(file_get_contents(resource_path('course/exams/revisions/2026-10-03-'.strtolower($level).'-listening.json')), true, flags: JSON_THROW_ON_ERROR);
    }

    public function test_all_fifteen_listening_forms_preserve_identity_and_scoring_with_clean_voice_recipes(): void
    {
        foreach (['A2' => [15, 1500], 'B1' => [20, 2400], 'B2' => [25, 2400]] as $level => [$points, $seconds]) {
            $pack = $this->pack($level);
            $source = (static fn ($l) => require resource_path('course/exams/'.strtolower($l).'.php'))($level);
            $this->assertCount(5, $pack['variants']);
            $this->assertSame([1, 2, 3, 4, 5], array_column($pack['variants'], 'position'));
            $transcripts = [];
            foreach ($pack['variants'] as $entry) {
                $this->assertSame($level, $entry['level']);
                $this->assertSame(['listening'], array_keys($entry['replace_sections']));
                $this->assertEmpty($entry['question_changes'] ?? []);
                $section = $entry['replace_sections']['listening'];
                $snapshot = $source[$entry['position'] - 1];
                $original = $snapshot['sections'][0];
                $snapshot['sections'][0] = $section;
                app(ExamDefinition::class)->validate($snapshot);
                $this->assertSame($seconds, $section['seconds']);
                $this->assertSame(array_column($original['tasks'], 'id'), array_column($section['tasks'], 'id'));
                $this->assertSame(array_keys(app(ExamDefinition::class)->questions($original)), array_keys(app(ExamDefinition::class)->questions($section)));
                $this->assertEquals($points, array_sum(array_column(app(ExamDefinition::class)->questions($section), 'points')));
                foreach ($section['tasks'] as $task) {
                    $this->assertArrayNotHasKey('audio_path', $task);
                    $recipe = app(ExamAudioRecipe::class)->build($level, $task);
                    $this->assertLessThanOrEqual(5000, $recipe['characters']);
                    $this->assertNotContains($task['transcript'], $transcripts);
                    $transcripts[] = $task['transcript'];
                    foreach ($task['questions'] as $q) {
                        $this->assertContains($q['type'], ['choice', 'short']);
                        $this->assertNotEmpty($q['explanation']);
                        $this->assertNotEmpty($q['explanation_translations']['ru']);
                        $this->assertNotEmpty($q['explanation_translations']['uk']);
                    }
                }
            }
        }
        Http::assertNothingSent();
    }

    public function test_all_revised_listening_keys_receive_full_canonical_credit_without_providers(): void
    {
        $definition = app(ExamDefinition::class);
        $ai = \Mockery::mock(ExamAi::class);
        $ai->shouldReceive('assess')->with([], \Mockery::any())->andReturn([]);
        $grader = new ExamGrader($definition, $ai);
        foreach (['A2' => 15, 'B1' => 20, 'B2' => 25] as $level => $points) {
            $source = (static fn ($l) => require resource_path('course/exams/'.strtolower($l).'.php'))($level);
            $exam = CourseExam::create(['level' => $level, 'learn_lang' => 'lv', 'title' => $level]);
            foreach ($this->pack($level)['variants'] as $entry) {
                $snapshot = $source[$entry['position'] - 1];
                $snapshot['sections'][0] = $entry['replace_sections']['listening'];
                $variant = ExamVariant::create(['course_exam_id' => $exam->id, 'position' => $entry['position'], 'title' => $snapshot['title'], 'content' => $snapshot]);
                $answers = [];
                foreach ($definition->questions($snapshot['sections'][0]) as $id => $q) $answers[$id] = ['text' => $q['type'] === 'choice' ? $q['correct'] : $q['accepted'][0]];
                $attempt = ExamAttempt::create(['user_id' => 1, 'course_exam_id' => $exam->id, 'exam_variant_id' => $variant->id,
                    'student_name' => 'Synthetic', 'snapshot' => $snapshot, 'answers' => $answers, 'playbacks' => [], 'status' => 'pending',
                    'started_at' => now(), 'deadline_at' => now(), 'submitted_at' => now()]);
                $grader->grade($attempt->id);
                $this->assertSame('completed', $attempt->fresh()->status);
                $result = collect($attempt->fresh()->results)->firstWhere('skill', 'listening');
                $this->assertEquals($points, $result['points']);
                $this->assertEquals(100, $result['percent']);
                $this->assertTrue($result['passed']);
            }
        }
        Http::assertNothingSent();
    }
}
