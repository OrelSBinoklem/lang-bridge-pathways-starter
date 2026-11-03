<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\ExamController;
use App\Models\CourseExam;
use App\Models\ExamAttempt;
use App\Models\ExamVariant;
use App\Models\User;
use App\Services\Exams\EnglishExamPackage;
use App\Services\Exams\ExamAi;
use App\Services\Exams\ExamDefinition;
use App\Services\Exams\ExamGrader;
use App\Services\Exams\ExamSession;
use App\Services\Tutor\AiProfiles;
use App\Services\Tutor\ServiceWorkflows;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class EnglishExamTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        config(['credits.enabled' => false, 'services.openai.key' => 'fixture-only']);
        Schema::create('users', fn ($t) => $t->id());
        (require database_path('migrations/2026_09_26_000001_create_course_exams.php'))->up();
        (require database_path('migrations/2026_09_26_000002_limit_exam_grading_retries.php'))->up();
        (require database_path('migrations/2026_10_03_000001_create_exam_variant_archives.php'))->up();
        Schema::create('app_settings', function ($t) {
            $t->string('key')->primary();
            $t->text('value');
            $t->timestamps();
        });
        Http::preventStrayRequests();
    }

    public function test_all_twenty_english_sources_validate_without_network_or_database_writes(): void
    {
        $variants = app(EnglishExamPackage::class)->load();
        $this->assertCount(20, $variants);
        $this->assertSame(['A1' => 5, 'A2' => 5, 'B1' => 5, 'B2' => 5], array_count_values(array_column($variants, 'level')));
        $this->assertCount(20, array_unique(array_column($variants, 'title')));
        foreach ($variants as $variant) {
            $this->assertCount(3, $variant['sections'][0]['tasks']);
            foreach ($variant['sections'] as $section) {
                $questions = array_merge(...array_column($section['tasks'], 'questions'));
                if (in_array($section['skill'], ['listening', 'reading'])) {
                    $this->assertGreaterThanOrEqual(15, count($questions));
                }
                foreach ($questions as $q) {
                    if ($q['type'] === 'choice') {
                        $this->assertSame(count($q['options']), count(array_unique(array_column($q['options'], 'id'))));
                    }
                }
            }
        }
        $this->artisan('exams:prepare-english')->assertSuccessful();
        $this->assertSame(0, CourseExam::count());
        Http::assertNothingSent();
    }

    public function test_english_install_is_additive_and_refuses_to_overwrite_admin_edits(): void
    {
        $latvian = CourseExam::create(['level' => 'A1', 'learn_lang' => 'lv', 'title' => 'Keep', 'is_published' => false]);
        $this->artisan('exams:prepare-english', ['--write' => true])->assertSuccessful();
        $this->artisan('exams:prepare-english', ['--write' => true])->assertSuccessful();
        $this->assertSame(5, CourseExam::count());
        $this->assertSame(20, ExamVariant::count());
        $variant = ExamVariant::firstOrFail();
        $content = $variant->content;
        $content['sections'][2]['tasks'][0]['title'] = 'Administrator correction';
        $variant->update(['content' => $content]);
        $this->artisan('exams:prepare-english', ['--write' => true])->assertFailed();
        $this->assertSame('Administrator correction', $variant->fresh()->content['sections'][2]['tasks'][0]['title']);
        $this->assertSame('Keep', $latvian->fresh()->title);
        $this->assertSame(0, ExamAttempt::count());
    }

    public function test_english_assessment_has_english_instructions_and_no_latvian_reference_tool(): void
    {
        Http::fake(['api.openai.com/*' => Http::response(['status' => 'completed', 'output' => [['content' => [['type' => 'output_text', 'text' => json_encode(['answers' => [['id' => 'essay', 'points' => 5, 'feedback' => 'Хорошо.', 'example' => 'I enjoy reading.', 'errors' => [], 'recommendation' => 'Продолжайте.']]])]]]]])]);
        app(ExamAi::class)->assess([['id' => 'essay', 'maximum' => 10, 'answer' => 'I enjoy reading.', 'rubric' => 'Content and grammar.']], 'A2', 'en');
        Http::assertSent(function ($request) {
            $this->assertStringContainsString('English examination tutor', $request['input'][0]['content']);
            $this->assertStringNotContainsString('Latvian', json_encode($request['input']));
            $this->assertArrayNotHasKey('tools', $request->data());

            return true;
        });
    }

    public function test_grading_uses_the_english_language_from_the_persisted_attempt(): void
    {
        \Illuminate\Support\Facades\DB::table('users')->insert(['id' => 1]);
        $content = app(EnglishExamPackage::class)->load()[0];
        $exam = CourseExam::create(['learn_lang' => 'en', 'level' => 'A1', 'title' => 'English']);
        $variant = ExamVariant::create(['course_exam_id' => $exam->id, 'position' => 1, 'title' => $content['title'], 'content' => $content]);
        $essay = $content['sections'][2]['tasks'][0]['questions'][0];
        $attempt = ExamAttempt::create(['user_id' => 1, 'course_exam_id' => $exam->id, 'exam_variant_id' => $variant->id, 'student_name' => 'Fixture',
            'snapshot' => $content, 'answers' => [$essay['id'] => ['text' => 'Please come to my home on Saturday.']], 'playbacks' => [],
            'status' => 'pending', 'started_at' => now(), 'deadline_at' => now(), 'cooldown_hours' => 20]);
        $ai = \Mockery::mock(ExamAi::class);
        $ai->shouldReceive('assess')->once()->withArgs(fn ($items, $level, $language) => $language === 'en' && $level === 'A1' && count($items) === 1 && $items[0]['id'] === $essay['id'])
            ->andReturn([$essay['id'] => ['points' => 10, 'feedback' => 'Fixture', 'example' => '', 'errors' => [], 'recommendation' => '']]);
        (new ExamGrader(app(ExamDefinition::class), $ai))->grade($attempt->id);
        $this->assertSame('completed', $attempt->fresh()->status);
    }

    public function test_english_workflow_is_independently_editable_and_uses_english_transcription(): void
    {
        $workflows = app(ServiceWorkflows::class);
        $graph = $workflows->defaultGraph('english_exams');
        $workflows->validate('english_exams', $graph);
        $preview = $workflows->preview('english_exams', ['role' => 'exam_stt_en_secondary', 'graph' => $graph, 'body' => ['model' => 'gpt-4o-transcribe']]);
        $this->assertSame('en', $preview['request']['language']);
        $this->assertStringContainsString('English', $preview['request']['prompt']);
        $this->assertStringContainsString('Latvian', app(AiProfiles::class)->defaults()['examiner']['prompts'][0]);
        Http::fake(fn () => Http::response(['text' => 'I go to work.']));
        $transcript = app(ExamAi::class)->transcribe('fixture-audio', 'webm', 'en');
        $this->assertSame(['auto', 'en'], array_column($transcript['transcript_candidates'], 'language'));
        Http::assertSent(function ($request) {
            $parts = array_column($request->data(), 'contents', 'name');
            $this->assertStringContainsString('learning English', $parts['prompt']);

            return true;
        });
    }

    public function test_catalog_is_language_scoped_and_active_payload_never_exposes_spoken_prompts_or_keys(): void
    {
        $actor = \Mockery::mock(User::class)->makePartial();
        $actor->forceFill(['id' => 1]);
        $actor->shouldReceive('isFrontendAdmin')->andReturn(false);
        CourseExam::create(['learn_lang' => 'lv', 'level' => 'A1', 'title' => 'Latvian']);
        $english = CourseExam::create(['learn_lang' => 'en', 'level' => 'A1', 'title' => 'English']);
        $request = Request::create('/api/exams', 'GET', ['learn_lang' => 'en']);
        $request->setUserResolver(fn () => $actor);
        $data = app(ExamController::class)->index($request)->getData(true)['data'];
        $this->assertSame([$english->id], array_column($data, 'id'));
        $snapshot = app(EnglishExamPackage::class)->load()[0];
        $question = &$snapshot['sections'][3]['tasks'][0]['questions'][0];
        $hidden = $question['prompt'];
        $question['audio_path'] = 'exams/gemini/'.str_repeat('a', 64).'.mp3';
        unset($question);
        $attempt = new ExamAttempt(['snapshot' => $snapshot, 'section_index' => 3, 'status' => 'running', 'answers' => [], 'playbacks' => [], 'started_at' => now(), 'deadline_at' => now()->addMinutes(10)]);
        $payload = app(ExamSession::class)->payload($attempt);
        $this->assertSame('en', $payload['learn_lang']);
        $this->assertStringNotContainsString($hidden, json_encode($payload));
        foreach ($payload['sections'][0]['tasks'] as $task) {
            foreach ($task['questions'] as $q) {
                $this->assertArrayNotHasKey('rubric', $q);
                $this->assertArrayNotHasKey('audio_path', $q);
            }
        }
    }
}
