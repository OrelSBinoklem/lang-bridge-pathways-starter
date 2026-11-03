<?php

namespace App\Services\Exams;

use App\Models\{AppSetting, CourseExam, ExamAttempt, User};
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class ExamSession
{
    public function __construct(private ExamDefinition $definition) {}

    public static function cooldownHours(): int { return max(0, min(720, (int) (AppSetting::where('key', 'exam_cooldown_hours')->value('value') ?? 20))); }
    public static function retainAudio(): bool { return AppSetting::where('key', 'exam_retain_audio')->value('value') === '1'; }

    public function start(User $user, CourseExam $exam): ExamAttempt
    {
        return DB::transaction(function () use ($user, $exam) {
            User::whereKey($user->id)->lockForUpdate()->firstOrFail();
            abort_unless($exam->is_published, 404);
            $active = ExamAttempt::where('user_id', $user->id)->where('course_exam_id', $exam->id)->where('status', 'running')->lockForUpdate()->first();
            if ($active) {
                $this->advanceClock($active);
                if ($active->status === 'running') return $active;
            }
            $last = ExamAttempt::where('user_id', $user->id)->where('course_exam_id', $exam->id)->latest('id')->first();
            if ($last?->next_attempt_at?->isFuture()) throw ValidationException::withMessages(['exam' => 'Повторная сдача доступна '.$last->next_attempt_at->toIso8601String()]);
            $variants = $exam->variants()->where('is_published', true)->get();
            abort_if($variants->isEmpty(), 409, 'Экзамен ещё не подготовлен.');
            $count = ExamAttempt::where('user_id', $user->id)->where('course_exam_id', $exam->id)->count();
            $variant = $variants[($user->id + $count) % $variants->count()];
            if (($variant->content['language'] ?? 'lv') !== $exam->learn_lang) throw ValidationException::withMessages(['exam' => 'Язык варианта не совпадает с языком экзамена.']);
            $this->definition->validate($variant->content, true);
            return ExamAttempt::create([
                'user_id' => $user->id, 'student_name' => $user->name, 'course_exam_id' => $exam->id,
                'exam_variant_id' => $variant->id, 'snapshot' => array_replace($variant->content, ['language' => $exam->learn_lang, 'level' => $exam->level, 'title' => $variant->title]),
                'answers' => [], 'playbacks' => [], 'started_at' => now(),
                'deadline_at' => now()->addSeconds($variant->content['sections'][0]['seconds']),
                'cooldown_hours' => self::cooldownHours(), 'retain_audio' => self::retainAudio(),
            ]);
        });
    }

    // Expiry advances from the stored deadline, never from the time the browser reconnects.
    public function advanceClock(ExamAttempt $attempt): void
    {
        while ($attempt->status === 'running' && $attempt->deadline_at->lte(now())) {
            $end = $attempt->deadline_at;
            if ($attempt->section_index >= 3) {
                $attempt->fill(['status' => 'pending', 'submitted_at' => $end, 'next_attempt_at' => $end->addHours($attempt->cooldown_hours)]);
            } else {
                $index = $attempt->section_index + 1;
                $attempt->fill(['section_index' => $index, 'deadline_at' => $end->addSeconds($attempt->snapshot['sections'][$index]['seconds'])]);
            }
            $attempt->save();
        }
    }

    public function locked(int $id, int $userId, callable $action): mixed
    {
        return DB::transaction(function () use ($id, $userId, $action) {
            $attempt = ExamAttempt::whereKey($id)->where('user_id', $userId)->lockForUpdate()->firstOrFail();
            $this->advanceClock($attempt);
            return $action($attempt);
        });
    }

    public function save(ExamAttempt $attempt, int $section, array $answers, bool $finish): void
    {
        if ($attempt->status !== 'running' || $section !== $attempt->section_index) return;
        $questions = $this->definition->questions($attempt->snapshot['sections'][$section]);
        $saved = $attempt->answers;
        foreach ($answers as $id => $value) {
            if (!isset($questions[$id]) || $questions[$id]['type'] === 'speaking') continue;
            if (!is_string($value) || mb_strlen($value) > 12000) throw ValidationException::withMessages(['answers' => 'Недопустимый ответ.']);
            if ($questions[$id]['type'] === 'choice' && !in_array($value, array_column($questions[$id]['options'], 'id'), true) && $value !== '') throw ValidationException::withMessages(['answers' => 'Недопустимый вариант ответа.']);
            $saved[$id] = ['text' => $value];
        }
        $attempt->answers = $saved;
        if ($finish) {
            if ($section === 3) {
                $attempt->fill(['status' => 'pending', 'submitted_at' => now(), 'next_attempt_at' => now()->addHours($attempt->cooldown_hours)]);
            } else {
                $index = $section + 1;
                $attempt->fill(['section_index' => $index, 'deadline_at' => now()->addSeconds($attempt->snapshot['sections'][$index]['seconds'])]);
            }
        }
        $attempt->save();
    }

    public function payload(ExamAttempt $attempt): array
    {
        $done = $attempt->status === 'completed';
        $sections = $attempt->snapshot['sections'];
        foreach ($sections as &$section) if ($section['skill'] === 'reading') {
            foreach ($section['tasks'] as &$task) $task = app(ExamReadingLayout::class)->present($attempt->snapshot['level'], $task, $attempt->answers);
            unset($task);
        }
        unset($section);
        if (!$done) {
            $sections = $attempt->status === 'running' ? [$sections[$attempt->section_index]] : [];
            foreach ($sections as &$section) foreach ($section['tasks'] as &$task) {
                unset($task['audio_path'], $task['segments'], $task['transcript'], $task['audio_generation']);
                foreach ($task['questions'] as &$q) {
                    $q['has_audio'] = !empty($q['audio_path']);
                    if ($q['type'] === 'speaking' && $q['has_audio']) $q['prompt'] = '';
                    unset($q['audio_path'], $q['audio_generation'], $q['correct'], $q['accepted'], $q['rubric'], $q['explanation'], $q['explanation_translations'], $q['reference']);
                }
                unset($q);
            }
            unset($section, $task);
        } else {
            $translations = require resource_path('course/exams/comment-translations.php');
            foreach ($sections as &$section) foreach ($section['tasks'] as &$task) {
                unset($task['audio_path'], $task['segments'], $task['audio_generation']);
                foreach ($task['questions'] as &$q) {
                    unset($q['audio_path'], $q['audio_generation']);
                    $source = $q['explanation'] ?? null;
                    if (is_string($source) && isset($translations[$source])) {
                        $q['explanation_translations'] = array_replace($translations[$source], array_filter($q['explanation_translations'] ?? [], fn ($value) => is_string($value) && trim($value) !== ''));
                    }
                }
                unset($q);
            }
            unset($section, $task);
        }
        return [
            'id' => $attempt->id, 'learn_lang' => $attempt->snapshot['language'] ?? 'lv', 'level' => $attempt->snapshot['level'], 'title' => $attempt->snapshot['title'],
            'student_name' => $attempt->student_name, 'status' => $attempt->status, 'section_index' => $attempt->section_index,
            'sections' => $sections, 'answers' => $attempt->answers, 'playbacks' => $attempt->playbacks,
            'server_now' => now()->toIso8601String(), 'deadline_at' => $attempt->deadline_at->toIso8601String(),
            'started_at' => $attempt->started_at->toIso8601String(), 'submitted_at' => $attempt->submitted_at?->toIso8601String(),
            'next_attempt_at' => $attempt->next_attempt_at?->toIso8601String(), 'retain_audio' => $attempt->retain_audio,
            'results' => $done ? $attempt->results : null, 'score' => $done ? $attempt->score : null,
            'passed' => $done ? $attempt->passed : null, 'reviewed_at' => $attempt->reviewed_at?->toIso8601String(),
            'grading_error' => $attempt->grading_error ? 'Проверка временно недоступна. Ответы сохранены.' : null,
        ];
    }
}
