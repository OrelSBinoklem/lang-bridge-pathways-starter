<?php

namespace App\Services\Exams;

class ExamReadingLayout
{
    public function present(string $level, array $task, array $answers = []): array
    {
        if ($level === 'A2') return $this->a2($task, $answers);
        if ($level === 'B2') return $this->b2($task);
        return $task;
    }

    private function a2(array $task, array $answers): array
    {
        $plans = json_decode(file_get_contents(resource_path('course/exams/reading-layouts-a2.json')), true, flags: JSON_THROW_ON_ERROR);
        $plan = $plans[$task['id']] ?? null;
        if (!$plan || count($task['questions']) !== 6) return $task;
        $guard = ['text' => $task['text'] ?? '', 'questions' => array_map(fn ($q) => ['id' => $q['id'], 'type' => $q['type'], 'prompt' => $q['prompt'], 'options' => $q['options'] ?? [], 'correct' => $q['correct'] ?? null], $task['questions'])];
        if (!hash_equals($plan['sha256'], hash('sha256', json_encode($guard, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)))) return $task;
        $bank = $this->announcements($task['text'], range('A', 'H'));
        if (!$bank) return $task;
        $original = $task;
        $groups = [];
        foreach ($plan['groups'] as $index => $letters) {
            $labels = array_combine($letters, range('A', 'D'));
            $group = ['title' => ($index + 1).'. grupa', 'announcements' => [], 'question_ids' => []];
            foreach ($letters as $letter) $group['announcements'][] = ['label' => $labels[$letter], 'text' => $bank[$letter]];
            foreach ([$index * 2, $index * 2 + 1] as $position) {
                $q = &$task['questions'][$position];
                $q['options'] = array_values(array_map(fn ($option) => ['id' => $option['id'], 'text' => $labels[$option['text']]], array_filter($q['options'], fn ($option) => isset($labels[$option['text']]))));
                // A previously saved choice must never disappear from an old attempt.
                $saved = $answers[$q['id']]['text'] ?? '';
                if ($saved !== '' && !in_array($saved, array_column($q['options'], 'id'), true)) return $original;
                $this->relabelExplanation($q, $labels, $bank);
                $group['question_ids'][] = $q['id'];
                unset($q);
            }
            $groups[] = $group;
        }
        $task['title'] = '2. Katrā grupā lasiet sludinājumus A–D. Katrai situācijai izvēlieties atbilstošo sludinājumu.';
        $task['reading_groups'] = $groups;
        $task['text'] = $this->fallbackText($groups);
        return $task;
    }

    private function b2(array $task): array
    {
        if (count($task['questions']) !== 8 || empty($task['text'])) return $task;
        $parts = preg_split('/\R\s*\R(?=(?:I|II|III|IV)\.\s)/u', trim($task['text']));
        if (count($parts) !== 4) return $task;
        $original = $task;
        $groups = [];
        foreach (['I', 'II', 'III', 'IV'] as $index => $marker) {
            $lines = explode("\n", str_replace("\r\n", "\n", $parts[$index]), 2);
            if (count($lines) !== 2 || !str_starts_with($lines[0], $marker.'. ')) return $original;
            $bank = $this->announcements($lines[1], range('A', 'D'));
            if (!$bank) return $original;
            $group = ['title' => $lines[0], 'announcements' => [], 'question_ids' => []];
            foreach ($bank as $letter => $text) $group['announcements'][] = ['label' => $letter, 'text' => $text];
            foreach ([$index * 2, $index * 2 + 1] as $position) {
                $q = &$task['questions'][$position];
                if ($q['type'] !== 'choice' || array_column($q['options'] ?? [], 'text') !== array_map(fn ($letter) => $marker.'-'.$letter, range('A', 'D'))) return $original;
                foreach ($q['options'] as &$option) $option['text'] = substr($option['text'], strlen($marker) + 1);
                unset($option);
                $this->mapExplanations($q, fn ($text) => preg_replace('/(?<![IV])'.$marker.'-([A-D])(?![\pL\pN])/u', '$1', $text));
                $group['question_ids'][] = $q['id'];
                unset($q);
            }
            $groups[] = $group;
        }
        $task['reading_groups'] = $groups;
        $task['text'] = $this->fallbackText($groups);
        return $task;
    }

    private function announcements(string $text, array $letters): ?array
    {
        $parts = preg_split('/\R\s*(?=[A-H]\.\s)/u', trim($text));
        if (count($parts) !== count($letters)) return null;
        $bank = [];
        foreach ($letters as $index => $letter) {
            if (!str_starts_with($parts[$index], $letter.'. ')) return null;
            $bank[$letter] = trim(substr($parts[$index], 3));
        }
        return $bank;
    }

    private function fallbackText(array $groups): string
    {
        return implode("\n\n", array_map(fn ($group) => $group['title']."\n".implode("\n\n", array_map(
            fn ($announcement) => $announcement['label'].'. '.$announcement['text'], $group['announcements'])), $groups));
    }

    private function relabelExplanation(array &$question, array $labels, array $bank): void
    {
        $this->mapExplanations($question, fn ($text) => preg_replace_callback('/(?<![\pL\pN])([A-H])(?![\pL\pN])/u', function ($match) use ($labels, $bank) {
            // References to a distractor absent from this set use its title, not a wrong new letter.
            return $labels[$match[1]] ?? '«'.explode('. ', $bank[$match[1]], 2)[0].'»';
        }, $text));
    }

    private function mapExplanations(array &$question, callable $map): void
    {
        if (isset($question['explanation'])) $question['explanation'] = $map($question['explanation']);
        foreach ($question['explanation_translations'] ?? [] as $language => $text) $question['explanation_translations'][$language] = $map($text);
    }
}
