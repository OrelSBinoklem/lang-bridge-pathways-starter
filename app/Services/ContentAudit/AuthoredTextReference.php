<?php

namespace App\Services\ContentAudit;

use App\Services\TaskGeneration\CourseSkillDraft;

class AuthoredTextReference
{
    private ?array $references = null;

    private function signature(array $config): string
    {
        return hash('sha256', json_encode([$config['task_kind'] ?? null, $config['instruction'] ?? null, $config['tutor_prompt'] ?? null], JSON_THROW_ON_ERROR));
    }

    public function find(array $config): ?array
    {
        if (($config['task_kind'] ?? null) !== 'ru_to_lv') {
            return null;
        }
        if ($this->references === null) {
            $this->references = [];
            foreach (glob(resource_path('course/skills-*.json')) as $path) {
                if (str_ends_with($path, '-vocabulary.json')) {
                    continue;
                }
                $draft = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
                if (! isset($draft['variants'],$draft['level'],$draft['image_url'],$draft['image_facts'])) {
                    continue;
                }
                $pages = (new CourseSkillDraft)->pages($draft);
                foreach ($pages['writing']['blocks'][0]['variants'] as $position => $variant) {
                    $text = $draft['variants'][$position]['writing_translation']['lv'] ?? null;
                    if (! is_string($text) || $text === '') {
                        continue;
                    }
                    // Matching the complete saved task protects subsequent administrative edits.
                    $this->references[$this->signature($variant['config'])] = ['text' => $text,
                        'path' => 'resources/course/'.basename($path), 'sha256' => hash_file('sha256', $path)];
                }
            }
        }

        return $this->references[$this->signature($config)] ?? null;
    }
}
