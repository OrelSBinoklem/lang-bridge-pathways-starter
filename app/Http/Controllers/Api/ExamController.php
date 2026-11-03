<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\{CourseExam, ExamAttempt};
use App\Services\Exams\{ExamAi, ExamDefinition, ExamGrader, ExamSession};
use Illuminate\Http\Request;
use Illuminate\Support\Facades\{DB, Log, Storage};
use Illuminate\Support\Str;

class ExamController extends Controller
{
    public function __construct(private ExamSession $sessions) {}

    public function index(Request $request)
    {
        $language = $request->validate(['learn_lang' => 'sometimes|in:lv,en'])['learn_lang'] ?? 'lv';
        return response()->json(['data' => CourseExam::where('learn_lang', $language)->orderBy('id')->get()->map(function ($exam) use ($request) {
            $variant = $exam->variants()->where('is_published', true)->first(['content']);
            return [
            'id' => $exam->id, 'level' => $exam->level, 'learn_lang' => $exam->learn_lang, 'title' => $exam->title,
            'available' => $exam->is_published && $variant !== null,
            'durations' => collect($variant?->content['sections'] ?? [])
                ->mapWithKeys(fn ($section) => [$section['skill'] => (int) $section['seconds']])->all(),
            'best_score' => $exam->attempts()->where('user_id', $request->user()->id)->where('status', 'completed')->max('score'),
            'passed' => $exam->attempts()->where('user_id', $request->user()->id)->where('passed', true)->exists(),
            ];
        }), 'cooldown_hours' => ExamSession::cooldownHours(), 'retain_audio' => ExamSession::retainAudio(), 'is_admin' => $request->user()->isFrontendAdmin()]);
    }

    public function certificatePreview(Request $request, CourseExam $exam)
    {
        abort_unless($request->user()->isFrontendAdmin(), 403);
        $max = match ($exam->level) { 'B1' => 20, 'B2' => 25, default => 15 };
        return response()->json(['data' => [
            'id'=>0, 'level'=>$exam->level, 'learn_lang'=>$exam->learn_lang, 'title'=>'Образец результата', 'student_name'=>$request->user()->name,
            'is_preview'=>true, 'started_at'=>now()->toIso8601String(), 'submitted_at'=>now()->toIso8601String(),
            'passed'=>true, 'score'=>60, 'reviewed_at'=>null,
            'results'=>array_map(fn($skill)=>['skill'=>$skill,'points'=>$max * 0.6,'maximum'=>$max,'percent'=>60,'passed'=>true,'answers'=>[]], ExamDefinition::SKILLS),
        ]]);
    }

    public function history(Request $request)
    {
        $language = $request->validate(['learn_lang' => 'sometimes|in:lv,en'])['learn_lang'] ?? 'lv';
        return response()->json(['data' => ExamAttempt::where('user_id', $request->user()->id)->whereHas('exam', fn ($query) => $query->where('learn_lang', $language))->with('exam:id,level,learn_lang')->latest('id')
            ->paginate(20, ['id', 'course_exam_id', 'status', 'score', 'passed', 'started_at', 'submitted_at', 'next_attempt_at', 'reviewed_at'])]);
    }

    public function start(Request $request, CourseExam $exam)
    {
        return response()->json(['data' => $this->sessions->payload($this->sessions->start($request->user(), $exam))]);
    }

    public function show(Request $request, int $attempt)
    {
        return response()->json(['data' => $this->sessions->locked($attempt, $request->user()->id, function ($record) use ($request) {
            if ($record->status === 'running') app(\App\Services\CourseSubscription::class)->requireActive($request->user());
            return $this->sessions->payload($record);
        })]);
    }

    public function save(Request $request, int $attempt)
    {
        $data = $request->validate(['section' => 'required|integer|between:0,3', 'answers' => 'present|array|max:100', 'finish' => 'sometimes|boolean']);
        $payload = $this->sessions->locked($attempt, $request->user()->id, function ($record) use ($data) {
            $this->sessions->save($record, $data['section'], $data['answers'], $data['finish'] ?? false);
            return $this->sessions->payload($record);
        });
        return response()->json(['data' => $payload]);
    }

    public function grade(Request $request, int $attempt, ExamGrader $grader)
    {
        $record = ExamAttempt::whereKey($attempt)->where('user_id', $request->user()->id)->firstOrFail();
        if (!$record->grading_error || $record->updated_at->lt(now()->subMinute())) $grader->grade($record->id);
        return response()->json(['data' => $this->sessions->payload($record->fresh())]);
    }

    public function audio(Request $request, int $attempt)
    {
        $data = $request->validate(['task_id' => 'required_without:question_id|string|max:80', 'question_id' => 'required_without:task_id|string|max:80']);
        return $this->sessions->locked($attempt, $request->user()->id, function ($record) use ($data) {
            abort_unless($record->status === 'running', 409);
            if (isset($data['question_id'])) {
                abort_unless($record->section_index === 3 && !isset($data['task_id']), 409);
                $question = app(\App\Services\Exams\ExamDefinition::class)->questions($record->snapshot['sections'][3])[$data['question_id']] ?? null;
                abort_unless($question && $question['type'] === 'speaking', 404);
                $path = $question['audio_path'] ?? '';
                abort_unless(preg_match('~^exams/gemini/[a-f0-9]{64}\.mp3$~', $path) && Storage::disk('local')->exists($path), 404);
                $bytes = Storage::disk('local')->get($path);
                abort_unless($bytes, 503, 'Аудиозапись недоступна.');
                return response()->json(['audio' => base64_encode($bytes), 'playbacks' => $record->playbacks]);
            }
            abort_unless($record->section_index === 0, 409);
            $task = collect($record->snapshot['sections'][0]['tasks'])->firstWhere('id', $data['task_id']);
            abort_unless($task && preg_match('~^exams/[a-zA-Z0-9/_-]+\.mp3$~', $task['audio_path'] ?? ''), 404);
            $plays = $record->playbacks;
            $play = $plays[$data['task_id']] ?? ['count' => 0];
            abort_if($play['count'] >= 2, 409, 'Два прослушивания уже использованы.');
            foreach ($plays as $other) abort_if(($other['until'] ?? 0) > now()->timestamp, 409, 'Дождитесь окончания записи.');
            $bytes = Storage::disk('local')->get($task['audio_path']);
            abort_unless($bytes, 503, 'Аудиозапись недоступна.');
            $plays[$data['task_id']] = ['count' => $play['count'] + 1, 'until' => now()->timestamp + (int) ceil($task['audio_seconds'])];
            $record->update(['playbacks' => $plays]);
            return response()->json(['audio' => base64_encode($bytes), 'playbacks' => $plays]);
        });
    }

    public function speech(Request $request, int $attempt, ExamAi $ai, ExamDefinition $definition)
    {
        $data = $request->validate(['question_id' => 'required|string|max:80', 'audio' => 'required|string|max:14000000', 'mime' => 'required|in:audio/webm,audio/ogg,audio/mp4,audio/wav']);
        $bytes = base64_decode($data['audio'], true);
        abort_unless($bytes !== false && strlen($bytes) >= 100 && strlen($bytes) <= 10000000, 422);
        $token = (string) Str::uuid();
        $speechSettings = $this->sessions->locked($attempt, $request->user()->id, function ($record) use ($data, $definition, $token) {
            abort_unless($record->status === 'running' && $record->section_index === 3, 409);
            $q = $definition->questions($record->snapshot['sections'][3])[$data['question_id']] ?? null;
            abort_unless($q && $q['type'] === 'speaking', 422);
            $answers = $record->answers;
            abort_if(isset($answers[$q['id']]['processing']), 409);
            $answers[$q['id']] = ['processing' => $token];
            $record->update(['answers' => $answers]);
            return ['retain_audio' => $record->retain_audio, 'language' => $record->snapshot['language'] ?? 'lv'];
        });
        $extension = ['audio/webm' => 'webm', 'audio/ogg' => 'ogg', 'audio/mp4' => 'm4a', 'audio/wav' => 'wav'][$data['mime']];
        try {
            $retention = $speechSettings['retain_audio'];
            $transcription = $speechSettings['language'] === 'en' ? $ai->transcribe($bytes, $extension, 'en') : $ai->transcribe($bytes, $extension);
            DB::transaction(function () use ($attempt, $data, $token, $transcription, $bytes, $extension, $retention) {
                $record = ExamAttempt::whereKey($attempt)->lockForUpdate()->firstOrFail();
                $answers = $record->answers;
                if (($answers[$data['question_id']]['processing'] ?? '') !== $token) return;
                $answers[$data['question_id']] = $transcription;
                $record->update(['answers' => $answers]);
                if ($retention && ExamSession::retainAudio()) {
                    $path = 'exam-recordings/'.$attempt.'/'.$token.'.'.$extension;
                    if (Storage::disk('local')->put($path, $bytes)) {
                        DB::table('exam_recordings')->insert(['exam_attempt_id' => $attempt, 'question_id' => $data['question_id'], 'path' => $path, 'expires_at' => now()->addDays(30), 'created_at' => now(), 'updated_at' => now()]);
                    } else {
                        Log::warning('Exam recording could not be retained', ['attempt_id'=>$attempt]);
                    }
                }
            });
        } catch (\Throwable $error) {
            Log::warning('Exam transcription failed', ['attempt_id' => $attempt, 'exception' => get_class($error)]);
            $this->sessions->locked($attempt, $request->user()->id, function ($record) use ($data, $token) {
                $answers = $record->answers;
                if (($answers[$data['question_id']]['processing'] ?? '') === $token) $answers[$data['question_id']] = ['processing_error' => true];
                $record->update(['answers' => $answers]);
            });
            if ($error instanceof \App\Services\Credits\CreditException) throw $error;
            abort(503, 'Не удалось распознать запись. Повторите отправку до окончания части.');
        }
        return response()->json(['data' => ['question_id' => $data['question_id'], 'received' => true]]);
    }
}
