<?php

namespace App\Services\Exams;

use App\Models\ExamVariant;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;
use RuntimeException;

class ExamRevision
{
    public function apply(array $pack, bool $write = false): array
    {
        return $this->execute($pack, $write, false);
    }

    public function previewAudioDraft(array $pack): array
    {
        return $this->execute($pack, false, true);
    }

    private function execute(array $pack, bool $write, bool $audioDraft): array
    {
        if (empty($pack['revision']) || !is_string($pack['revision']) || mb_strlen($pack['revision']) > 150 || empty($pack['variants']) || !is_array($pack['variants'])) {
            throw new InvalidArgumentException('A revision name and variants are required.');
        }
        return DB::transaction(function () use ($pack, $write, $audioDraft) {
            $plan = [];
            $seen = [];
            foreach ($pack['variants'] as $entry) {
                if (!in_array($entry['level'] ?? null, ['A1', 'A2', 'B1', 'B2'], true) || !is_int($entry['position'] ?? null)
                    || !preg_match('/^[a-f0-9]{64}$/', $entry['expected_sha256'] ?? '')) {
                    throw new InvalidArgumentException('Each entry needs level, integer position and expected_sha256.');
                }
                $key = $entry['level'].':'.$entry['position'];
                if (isset($seen[$key])) throw new InvalidArgumentException('Duplicate variant in revision.');
                $seen[$key] = true;
                $variant = ExamVariant::whereHas('exam', fn ($q) => $q->where('level', $entry['level'])->where('learn_lang', 'lv'))
                    ->where('position', $entry['position'])->lockForUpdate()->firstOrFail();
                $content = $this->patch($variant->content, $entry);
                $changed = $content !== $variant->content;
                if ($changed && !hash_equals($entry['expected_sha256'], $this->contentHash($variant->content))) {
                    throw new RuntimeException('Administrator edits conflict with '.$key.'; no variants changed.');
                }
                app(ExamDefinition::class)->validate($content, !$audioDraft && $variant->is_published);
                $plan[] = compact('variant', 'content', 'changed');
            }
            $result = [];
            foreach ($plan as $item) {
                if ($write && $item['changed']) {
                    app(ExamVariantArchiver::class)->archive($item['variant'], 'Перед редакцией '.$pack['revision'], auth()->id());
                    $item['variant']->update(['content' => $item['content']]);
                }
                $result[] = ['id' => $item['variant']->id, 'position' => $item['variant']->position, 'changed' => $item['changed'], 'written' => $write && $item['changed']];
            }
            return $result;
        });
    }

    public function contentHash(array $content): string { return hash('sha256', json_encode($content, JSON_THROW_ON_ERROR)); }

    private function patch(array $content, array $entry): array
    {
        if (empty($entry['question_changes']) && empty($entry['replace_sections'])) throw new InvalidArgumentException('No editorial changes supplied.');
        foreach ($entry['replace_sections'] ?? [] as $skill => $section) {
            $index = array_search($skill, array_column($content['sections'], 'skill'), true);
            if ($index === false || ($section['skill'] ?? null) !== $skill || ($section['seconds'] ?? null) !== $content['sections'][$index]['seconds']) {
                throw new InvalidArgumentException('Section replacements must preserve skill and timer.');
            }
            if (abs($this->sectionPoints($section) - $this->sectionPoints($content['sections'][$index])) > 0.000001) {
                throw new InvalidArgumentException('Section replacements must preserve total points.');
            }
            $content['sections'][$index] = $section;
        }
        foreach ($entry['question_changes'] ?? [] as $change) {
            $fields = $change['set'] ?? [];
            if (!$fields || array_diff(array_keys($fields), ['prompt', 'accepted', 'correct', 'options', 'explanation', 'explanation_translations', 'rubric'])) {
                throw new InvalidArgumentException('Only question text, accepted answers, options, key and rubric may be patched.');
            }
            $found = false;
            foreach ($content['sections'] as &$section) foreach ($section['tasks'] as &$task) foreach ($task['questions'] as &$question) {
                if ($question['id'] === ($change['id'] ?? null)) { $question = array_replace($question, $fields); $found = true; }
            }
            unset($section, $task, $question);
            if (!$found) throw new InvalidArgumentException('Question not found: '.($change['id'] ?? 'missing ID'));
        }
        return $content;
    }

    private function sectionPoints(array $section): float
    {
        $points = 0.0;
        foreach ($section['tasks'] ?? [] as $task) foreach ($task['questions'] ?? [] as $question) {
            $points += (float) ($question['points'] ?? 0);
        }
        return $points;
    }
}
