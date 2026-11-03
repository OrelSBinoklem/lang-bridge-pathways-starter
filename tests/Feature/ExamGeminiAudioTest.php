<?php

namespace Tests\Feature;

use App\Models\{CourseExam, ExamAttempt, ExamVariant, User};
use App\Services\Exams\{ExamAudioInspection, ExamDefinition, ExamPublishedAudio, ExamSession};
use Illuminate\Support\Facades\{DB, Schema, Storage};
use Tests\TestCase;

class ExamGeminiAudioTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        Schema::create('users', fn ($t) => $t->id());
        DB::table('users')->insert(['id' => 1]);
        (require database_path('migrations/2026_09_26_000001_create_course_exams.php'))->up();
        (require database_path('migrations/2026_09_26_000002_limit_exam_grading_retries.php'))->up();
        (require database_path('migrations/2026_10_03_000001_create_exam_variant_archives.php'))->up();
    }

    private function voiced(array $item): array
    {
        $bytes = 'synthetic-mp3';
        $checksum = hash('sha256', $bytes);
        $item['audio_path'] = 'exams/gemini/'.$checksum.'.mp3';
        $item['audio_seconds'] = 12;
        $item['audio_generation'] = ['version' => 3, 'provider' => 'google', 'model' => 'gemini-3.8-flash-tts',
            'text_sha256' => app(ExamPublishedAudio::class)->textHash($item), 'bytes_sha256' => $checksum];
        Storage::disk('local')->put($item['audio_path'], $bytes);
        app(ExamAudioInspection::class)->receipt($item['audio_path'], 12);
        return $item;
    }

    private function attempt(): ExamAttempt
    {
        $content = (require resource_path('course/exams/a1.php'))[0];
        $content['level'] = 'A1';
        foreach ($content['sections'][0]['tasks'] as &$task) $task = $this->voiced($task);
        unset($task);
        foreach ($content['sections'][3]['tasks'] as &$task) foreach ($task['questions'] as &$q) $q = $this->voiced($q);
        unset($task, $q);
        app(ExamDefinition::class)->validate($content, true);
        $exam = CourseExam::create(['level' => 'A1', 'title' => 'A1']);
        $variant = ExamVariant::create(['course_exam_id' => $exam->id, 'position' => 1, 'title' => 'Test', 'content' => $content]);
        return ExamAttempt::create(['user_id' => 1, 'course_exam_id' => $exam->id, 'exam_variant_id' => $variant->id,
            'student_name' => 'Synthetic', 'snapshot' => $content, 'section_index' => 3, 'started_at' => now(),
            'deadline_at' => now()->addMinutes(10), 'answers' => [], 'playbacks' => []]);
    }

    public function test_changed_text_or_audio_bytes_are_rejected(): void
    {
        $item = $this->voiced(['prompt' => 'Kā jūs sauc?']);
        app(ExamPublishedAudio::class)->verify($item);
        $changed = $item;
        $changed['prompt'] = 'Kur jūs dzīvojat?';
        try { app(ExamPublishedAudio::class)->verify($changed); $this->fail('Changed prompt must fail.'); } catch (\RuntimeException) {}
        Storage::disk('local')->put($item['audio_path'], 'different');
        $this->expectException(\RuntimeException::class);
        app(ExamPublishedAudio::class)->verify($item);
    }

    public function test_question_audio_is_private_and_only_accessible_in_speaking(): void
    {
        $attempt = $this->attempt();
        $payload = app(ExamSession::class)->payload($attempt);
        $q = $payload['sections'][0]['tasks'][0]['questions'][0];
        $this->assertTrue($q['has_audio']);
        $this->assertSame('', $q['prompt']);
        $this->assertArrayNotHasKey('audio_path', $q);
        $this->assertArrayNotHasKey('audio_generation', $q);
        $request = \Illuminate\Http\Request::create('/api/exam-attempts/'.$attempt->id.'/audio', 'POST', ['question_id' => $q['id']]);
        $user = new User; $user->id = 1;
        $request->setUserResolver(fn () => $user);
        $controller = app(\App\Http\Controllers\Api\ExamController::class);
        $response = $controller->audio($request, $attempt->id)->getData(true);
        $this->assertSame('synthetic-mp3', base64_decode($response['audio']));
        $this->assertSame([], $attempt->fresh()->playbacks);
        $attempt->update(['section_index' => 0]);
        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);
        $controller->audio($request, $attempt->id);
    }

    public function test_spoken_prompt_is_hidden_only_during_exam_and_snapshot_is_preserved(): void
    {
        $attempt = $this->attempt();
        $snapshot = $attempt->snapshot;
        $task = $snapshot['sections'][3]['tasks'][0];
        $prompt = $task['questions'][0]['prompt'];
        $payload = app(ExamSession::class)->payload($attempt);
        $this->assertNotSame('', $prompt);
        $this->assertSame('', $payload['sections'][0]['tasks'][0]['questions'][0]['prompt']);
        $this->assertSame($task['title'], $payload['sections'][0]['tasks'][0]['title']);
        $this->assertSame($snapshot, $attempt->fresh()->snapshot);

        $attempt->update(['status' => 'completed']);
        $review = app(ExamSession::class)->payload($attempt);
        $this->assertSame($prompt, $review['sections'][3]['tasks'][0]['questions'][0]['prompt']);
        $this->assertSame($snapshot, $attempt->fresh()->snapshot);
    }

    public function test_unvoiced_questions_and_written_listening_questions_remain_readable(): void
    {
        $attempt = $this->attempt();
        $snapshot = $attempt->snapshot;
        unset($snapshot['sections'][3]['tasks'][0]['questions'][0]['audio_path']);
        $attempt->update(['snapshot' => $snapshot]);
        $payload = app(ExamSession::class)->payload($attempt);
        $q = $payload['sections'][0]['tasks'][0]['questions'][0];
        $this->assertFalse($q['has_audio']);
        $this->assertSame($snapshot['sections'][3]['tasks'][0]['questions'][0]['prompt'], $q['prompt']);

        $attempt->update(['section_index' => 0]);
        $payload = app(ExamSession::class)->payload($attempt);
        $this->assertSame($snapshot['sections'][0]['tasks'][0]['questions'][0]['prompt'], $payload['sections'][0]['tasks'][0]['questions'][0]['prompt']);
        $this->assertArrayNotHasKey('transcript', $payload['sections'][0]['tasks'][0]);
    }

    public function test_another_user_cannot_fetch_question_audio(): void
    {
        $attempt = $this->attempt();
        $q = $attempt->snapshot['sections'][3]['tasks'][0]['questions'][0];
        $request = \Illuminate\Http\Request::create('/api/exam-attempts/'.$attempt->id.'/audio', 'POST', ['question_id' => $q['id']]);
        $user = new User; $user->id = 2;
        $request->setUserResolver(fn () => $user);
        $this->expectException(\Illuminate\Database\Eloquent\ModelNotFoundException::class);
        app(\App\Http\Controllers\Api\ExamController::class)->audio($request, $attempt->id);
    }
}
