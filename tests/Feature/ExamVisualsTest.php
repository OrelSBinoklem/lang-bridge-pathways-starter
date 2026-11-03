<?php

namespace Tests\Feature;

use App\Models\{CourseExam, ExamAttempt, ExamVariant};
use App\Services\Exams\{ExamAi, ExamDefinition, ExamGrader, ExamSession};
use Illuminate\Support\Facades\{DB, Http, Schema};
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class ExamVisualsTest extends TestCase
{
    private function definition(): array
    {
        $content = (require resource_path('course/exams/a1.php'))[0];
        $content['level'] = 'A1';
        $pack = json_decode(file_get_contents(resource_path('course/exams/visuals/revision-draft.json')), true, flags: JSON_THROW_ON_ERROR);
        $entry = collect($pack['variants'])->first(fn ($v) => $v['level'] === 'A1' && $v['position'] === 1);
        foreach ($content['sections'] as &$section) if (isset($entry['replace_sections'][$section['skill']])) $section = $entry['replace_sections'][$section['skill']];
        return $content;
    }

    public function test_all_twenty_visual_packs_validate_and_preserve_section_scores_and_timers(): void
    {
        $pack = json_decode(file_get_contents(resource_path('course/exams/visuals/revision-draft.json')), true, flags: JSON_THROW_ON_ERROR);
        $this->assertCount(20, $pack['variants']);
        foreach ($pack['variants'] as $entry) {
            $content = (require resource_path('course/exams/'.strtolower($entry['level']).'.php'))[$entry['position'] - 1];
            foreach ($content['sections'] as &$section) {
                if (!isset($entry['replace_sections'][$section['skill']])) continue;
                $replacement = $entry['replace_sections'][$section['skill']];
                $this->assertSame($section['seconds'], $replacement['seconds']);
                $points = fn ($s) => array_sum(array_column(app(ExamDefinition::class)->questions($s), 'points'));
                $this->assertEquals($points($section), $points($replacement));
                $section = $replacement;
            }
            unset($section);
            app(ExamDefinition::class)->validate($content);
            $tasks = $content['sections'][3]['tasks'];
            $visualTask = $tasks[$entry['level'] === 'B1' ? 2 : 1];
            $this->assertCount(match ($entry['level']) { 'A1' => 1, 'B2' => 6, default => 2 }, $visualTask['visuals']);
            $this->assertStringContainsString('Reviewed visual evidence', $visualTask['questions'][0]['rubric']);
            foreach ($visualTask['visuals'] as $visual) if (isset($visual['image'])) $this->assertFileExists(base_path('frontend/public'.$visual['image']));
            if ($entry['level'] === 'B2') $this->assertEquals(100, array_sum(array_column($visualTask['visuals'][1]['bars'], 'value')));
        }
    }

    public function test_each_spoken_picture_uses_its_own_reviewed_evidence(): void
    {
        $pack = json_decode(file_get_contents(resource_path('course/exams/visuals/revision.json')), true, flags: JSON_THROW_ON_ERROR);
        $manifest = json_decode(file_get_contents(resource_path('course/exams/visuals/assets.json')), true, flags: JSON_THROW_ON_ERROR);
        $assets = array_column($manifest['assets'], null, 'image');
        $this->assertCount(70, $assets);
        $seen = [];
        foreach ($pack['variants'] as $entry) {
            foreach ($entry['replace_sections']['speaking']['tasks'] as $task) {
                foreach ($task['visuals'] ?? [] as $visual) {
                    if (!isset($visual['image'])) continue;
                    $this->assertArrayHasKey($visual['image'], $assets);
                    $this->assertStringContainsString($assets[$visual['image']]['examiner_description'], $task['questions'][0]['rubric']);
                    $seen[] = $visual['image'];
                }
                foreach ($task['questions'] as $question) {
                    if (!isset($question['image'])) continue;
                    $this->assertStringContainsString($assets[$question['image']]['examiner_description'], $question['rubric']);
                    $seen[] = $question['image'];
                }
            }
            foreach ($entry['replace_sections']['reading']['tasks'] ?? [] as $task) {
                foreach ($task['questions'] as $question) {
                    if (!isset($question['image'])) continue;
                    $correct = collect($question['options'])->first(fn ($option) => (string) $option['id'] === (string) $question['correct']);
                    $this->assertSame($question['explanation'], $correct['text']);
                    $seen[] = $question['image'];
                }
            }
        }
        $this->assertCount(70, $seen);
        $this->assertCount(70, array_unique($seen));
    }

    public function test_visual_fields_reject_private_evidence_and_invalid_chart_values(): void
    {
        foreach (['examiner_description' => 'secret', 'bars' => [['label' => 'A', 'value' => 101]]] as $field => $value) {
            $content = $this->definition();
            $content['sections'][3]['tasks'][1]['visuals'][0][$field] = $value;
            try { app(ExamDefinition::class)->validate($content); $this->fail('Invalid public visual accepted'); }
            catch (ValidationException $e) { $this->assertNotEmpty($e->errors()); }
        }
    }

    public function test_current_slide_text_and_chart_are_supplied_to_grader_context(): void
    {
        $pack = json_decode(file_get_contents(resource_path('course/exams/visuals/revision-draft.json')), true, flags: JSON_THROW_ON_ERROR);
        $entry = collect($pack['variants'])->firstWhere('level', 'B2');
        $section = $entry['replace_sections']['speaking'];
        $task = &$section['tasks'][1];
        $task['visuals'][1]['bars'][0]['value'] = 44;
        $q = app(ExamDefinition::class)->questions($section)[$task['questions'][0]['id']];
        $this->assertStringContainsString('"value":44', $q['context']);
        $this->assertStringContainsString('Izdomāti mācību dati', $q['context']);
        $this->assertStringNotContainsString('/course/exams/visuals/', $q['context']);
    }

    public function test_visual_evidence_is_private_during_exam_and_reaches_grader_from_snapshot(): void
    {
        Http::preventStrayRequests();
        Schema::create('users', fn ($t) => $t->id());
        DB::table('users')->insert(['id' => 1]);
        (require database_path('migrations/2026_09_26_000001_create_course_exams.php'))->up();
        (require database_path('migrations/2026_09_26_000002_limit_exam_grading_retries.php'))->up();
        (require database_path('migrations/2026_10_03_000001_create_exam_variant_archives.php'))->up();
        $content = $this->definition();
        $exam = CourseExam::create(['level' => 'A1', 'title' => 'Test']);
        $variant = ExamVariant::create(['course_exam_id' => $exam->id, 'position' => 1, 'title' => 'Test', 'content' => $content]);
        $q = $content['sections'][3]['tasks'][1]['questions'][0];
        $attempt = ExamAttempt::create(['user_id' => 1, 'course_exam_id' => $exam->id, 'exam_variant_id' => $variant->id,
            'student_name' => 'Synthetic', 'snapshot' => $content, 'section_index' => 3, 'answers' => [$q['id'] => ['text' => 'Cilvēki gatavo ēdienu.']],
            'playbacks' => [], 'started_at' => now(), 'deadline_at' => now()->addMinutes(10)]);
        $payload = app(ExamSession::class)->payload($attempt);
        $this->assertCount(1, $payload['sections'][0]['tasks'][1]['visuals']);
        $this->assertStringNotContainsString('Reviewed visual evidence', json_encode($payload));
        $ai = \Mockery::mock(ExamAi::class);
        $ai->shouldReceive('assess')->once()->withArgs(function ($items, $level) use ($q) {
            return $level === 'A1' && count($items) === 1 && $items[0]['rubric'] === $q['rubric'];
        })->andReturn([$q['id'] => ['points' => 1, 'feedback' => 'Test', 'example' => '']]);
        $attempt->update(['status' => 'pending']);
        (new ExamGrader(app(ExamDefinition::class), $ai))->grade($attempt->id);
        $this->assertSame('completed', $attempt->fresh()->status);
        $this->assertSame($content, $attempt->fresh()->snapshot);
        Http::assertNothingSent();
    }
}
