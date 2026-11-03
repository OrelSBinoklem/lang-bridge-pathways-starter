<?php

namespace App\Services\Exams;

use RuntimeException;

/** Original English assessments; source text and generated audio have independent revisions. */
class EnglishExamPackage
{
    public function load(bool $withAudio = false): array
    {
        $directory = resource_path('course/exams/english');
        $manifest = $withAudio ? json_decode(file_get_contents($directory.'/audio-manifest.json'), true, flags: JSON_THROW_ON_ERROR) : [];
        $variants = [];
        $ids = [];
        foreach (['A1', 'A2', 'B1', 'B2'] as $level) {
            $rows = json_decode(file_get_contents($directory.'/'.strtolower($level).'.json'), true, flags: JSON_THROW_ON_ERROR);
            if (! is_array($rows) || count($rows) !== 5) {
                throw new RuntimeException('Five English variants are required for '.$level);
            }
            foreach ($rows as $index => $content) {
                if (($content['language'] ?? '') !== 'en' || ($content['level'] ?? '') !== $level) {
                    throw new RuntimeException('English variant language/level mismatch');
                }
                app(ExamDefinition::class)->validate($content);
                foreach ($content['sections'] as &$section) {
                    foreach ($section['tasks'] as &$task) {
                        if ($section['skill'] === 'listening') {
                            if (empty($task['segments']) || empty($task['transcript'])) {
                                throw new RuntimeException('Listening transcript/segments required');
                            }
                            if ($task['transcript'] !== implode("\n", array_column($task['segments'], 'text'))) {
                                throw new RuntimeException('Listening transcript differs from spoken segments');
                            }
                            if ($withAudio) {
                                $this->attach($task, $manifest);
                            }
                        }
                        foreach ($task['questions'] as &$question) {
                            if (isset($ids[$question['id']]) || ! str_starts_with($question['id'], 'en-'.strtolower($level).'-v'.($index + 1).'-')) {
                                throw new RuntimeException('English question ID is duplicated or misplaced');
                            }
                            $ids[$question['id']] = true;
                            if ($section['skill'] === 'speaking' && $withAudio) {
                                $this->attach($question, $manifest);
                            }
                        }
                        unset($question);
                    }
                    unset($task);
                }
                unset($section);
                app(ExamDefinition::class)->validate($content, $withAudio);
                $variants[] = $content;
            }
        }

        return $variants;
    }

    private function attach(array &$item, array $manifest): void
    {
        $audio = $manifest['items'][$item['id']] ?? null;
        if (! is_array($audio) || ($audio['audio_generation']['text_sha256'] ?? '') !== app(ExamPublishedAudio::class)->textHash($item)) {
            throw new RuntimeException('Audio missing or stale: '.$item['id']);
        }
        if (($audio['audio_generation']['transcript_verified'] ?? false) !== true) {
            throw new RuntimeException('Audio transcript comparison needs review: '.$item['id']);
        }
        $item = array_replace($item, array_intersect_key($audio, array_flip(['audio_path', 'audio_seconds', 'audio_generation'])));
        app(ExamPublishedAudio::class)->verify($item);
    }
}
