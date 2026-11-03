<?php

namespace App\Services\Exams;

use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class ExamDefinition
{
    public const SKILLS = ['listening', 'reading', 'writing', 'speaking'];

    public function validate(array $content, bool $publishing = false): void
    {
        Validator::make($content, [
            'sections' => 'required|array|size:4',
            'sections.*.skill' => 'required|in:listening,reading,writing,speaking',
            'sections.*.seconds' => 'required|integer|min:60|max:7200',
            'sections.*.tasks' => 'required|array|min:1',
            'sections.*.tasks.*.id' => 'required|regex:/^[a-z0-9_-]+$/',
            'sections.*.tasks.*.title' => 'required|string|max:1000',
            'sections.*.tasks.*.visuals' => 'sometimes|nullable|array|max:6',
            'sections.*.tasks.*.visuals.*' => 'array:title,text,image,credit,bars,chart_note',
            'sections.*.tasks.*.visuals.*.title' => 'required|string|max:250',
            'sections.*.tasks.*.visuals.*.text' => 'nullable|string|max:2500',
            'sections.*.tasks.*.visuals.*.image' => ['nullable', 'string', 'regex:~^/course/exams/visuals/[a-zA-Z0-9_-]+\.(?:webp|jpg|png)$~'],
            'sections.*.tasks.*.visuals.*.credit' => 'nullable|string|max:250',
            'sections.*.tasks.*.visuals.*.chart_note' => 'nullable|string|max:500',
            'sections.*.tasks.*.visuals.*.bars' => 'nullable|array|min:1|max:6',
            'sections.*.tasks.*.visuals.*.bars.*' => 'array:label,value',
            'sections.*.tasks.*.visuals.*.bars.*.label' => 'required|string|max:200',
            'sections.*.tasks.*.visuals.*.bars.*.value' => 'required|numeric|min:0|max:100',
            'sections.*.tasks.*.questions' => 'required|array|min:1',
            'sections.*.tasks.*.questions.*.id' => 'required|regex:/^[a-z0-9_-]+$/',
            'sections.*.tasks.*.questions.*.type' => 'required|in:choice,short,essay,speaking',
            'sections.*.tasks.*.questions.*.prompt' => 'required|string|max:5000',
            'sections.*.tasks.*.questions.*.points' => 'required|numeric|min:0.1|max:100',
            'sections.*.tasks.*.questions.*.explanation_translations' => 'sometimes|nullable|array:ru,uk',
            'sections.*.tasks.*.questions.*.explanation_translations.*' => 'nullable|string|max:12000',
        ])->validate();
        if (array_column($content['sections'], 'skill') !== self::SKILLS) $this->invalid('Порядок частей: слушание, чтение, письмо, говорение.');
        $ids = [];
        foreach ($content['sections'] as $section) {
            foreach ($section['tasks'] as $task) {
                if (isset($ids[$task['id']])) $this->invalid('ID заданий и вопросов должны быть уникальными.');
                $ids[$task['id']] = true;
                if ($publishing && $section['skill'] === 'listening') {
                    $path = $task['audio_path'] ?? '';
                    if (!preg_match('~^exams/[a-zA-Z0-9/_-]+\.mp3$~', $path) || !Storage::disk('local')->exists($path)) $this->invalid('Для публикации нужны готовые приватные аудиофайлы.');
                    $duration = $task['audio_seconds'] ?? null;
                    if (!is_numeric($duration) || !is_finite((float) $duration) || (float) $duration <= 0 || (float) $duration > 7200) $this->invalid('Укажите конечную положительную длительность аудио, не более двух часов.');
                    if (($task['audio_generation']['version'] ?? null) === 3) {
                        app(ExamPublishedAudio::class)->verify($task);
                    } elseif (!empty($task['audio_generation']['version']) || !empty($task['audio_generation']['sha256']) || str_contains($path, '/v2/')) {
                        $recipe = app(ExamAudioRecipe::class)->build($content['level'] ?? '', $task);
                        if (($task['audio_generation']['version'] ?? null) !== 2 || $path !== $recipe['path']
                            || ($task['audio_generation']['sha256'] ?? null) !== $recipe['sha256']) {
                            $this->invalid('Новая озвучка не соответствует тексту, голосам или подаче.');
                        }
                        app(ExamAudioInspection::class)->verifyReceipt($path, (float) $duration);
                    }
                    if (preg_match('~^exams/(?:a1|a2|b1|b2)/([a-f0-9]{64})\.mp3$~', $path, $match) && !empty($task['segments'])) {
                        $voices = ['male'=>'SqGJaEOnW97EMDTsC4pw','female'=>'Z7lsHmuN8xVOHr7J4AO0'];
                        $inputs = [];
                        foreach ($task['segments'] as $segment) {
                            if (!isset($voices[$segment['speaker'] ?? ''])) $this->invalid('Укажите пол говорящего.');
                            $inputs[] = ['voice_id'=>$voices[$segment['speaker']], 'text'=>$segment['text']];
                        }
                        $hash = hash('sha256', json_encode(['eleven_v3','lv',$inputs], JSON_UNESCAPED_UNICODE));
                        if (!hash_equals($match[1], $hash)) $this->invalid('Текст озвучки изменён. Снимите вариант с публикации и обновите аудио.');
                    }
                }
                foreach ($task['questions'] as $q) {
                    if ($publishing && !empty($q['audio_path'])) {
                        if ($section['skill'] !== 'speaking' || $q['type'] !== 'speaking') $this->invalid('Озвучка вопроса разрешена только для говорения.');
                        app(ExamPublishedAudio::class)->verify($q);
                    }
                    if (isset($ids[$q['id']])) $this->invalid('ID заданий и вопросов должны быть уникальными.');
                    $ids[$q['id']] = true;
                    if ($q['type'] === 'choice' && (!isset($q['options']) || !in_array($q['correct'] ?? null, array_column($q['options'], 'id'), true))) $this->invalid('Выберите правильный ответ из вариантов.');
                    if ($q['type'] === 'short' && empty($q['accepted'])) $this->invalid('Укажите допустимые ответы.');
                    if (in_array($q['type'], ['essay', 'speaking']) && empty($q['rubric'])) $this->invalid('Нужны критерии AI-проверки.');
                }
            }
        }
    }

    public function questions(array $section): array
    {
        $questions = [];
        foreach ($section['tasks'] as $task) {
            $context = $task['text'] ?? '';
            if (!empty($task['visuals'])) {
                $slides = array_map(fn ($visual) => array_intersect_key($visual, array_flip(['title', 'text', 'bars', 'chart_note'])), $task['visuals']);
                $context .= "\nVisible task slides: ".json_encode($slides, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            }
            foreach ($task['questions'] as $q) $questions[$q['id']] = $q + ['context' => $context, 'task_title' => $task['title']];
        }
        return $questions;
    }

    private function invalid(string $message): never
    {
        throw ValidationException::withMessages(['content' => $message]);
    }
}
