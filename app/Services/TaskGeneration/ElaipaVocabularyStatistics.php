<?php

namespace App\Services\TaskGeneration;

use RuntimeException;

class ElaipaVocabularyStatistics
{
    private ?array $source = null;

    public function source(): array
    {
        if ($this->source === null) {
            $path = resource_path('external-sources/e-laipa/derived/e-laipa-a1-b2-frequencies.json');
            if (! is_file($path)) {
                throw new RuntimeException('E-Laipa frequency JSON is missing.');
            }
            $this->source = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
            $this->source['file_sha256'] = hash_file('sha256', $path);
        }

        return $this->source;
    }

    public function forms(string $text): array
    {
        preg_match_all('/[\p{L}\p{M}]+/u', mb_strtolower($text), $matches);

        return array_values(array_unique($matches[0]));
    }

    public function forText(string $text): array
    {
        $frequencies = $this->source()['frequencies'];
        $result = [];
        foreach ($this->forms($text) as $form) {
            $result[$form] = $frequencies[$form] ?? null;
        }

        return $result;
    }

    public function metadata(): array
    {
        $source = $this->source();

        return [
            'path' => 'resources/external-sources/e-laipa/derived/e-laipa-a1-b2-frequencies.json',
            'sha256' => $source['file_sha256'],
            'raw_source' => $source['raw_source'],
            'definition' => $source['definition'],
            'limitation' => 'Exact word forms in A1-B2 educational pages, not lemmas, CEFR labels, general-language frequency, or evidence of user knowledge. Null means no corpus entry.',
        ];
    }

    public function topic(string $level, string $topic): array
    {
        $relative = 'resources/external-sources/e-laipa/derived/e-laipa-a1-b2-all-words.json';
        $path = base_path($relative);
        $topics = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
        if (! isset($topics[$level][$topic])) {
            throw new RuntimeException('Unknown E-Laipa level/topic; use an exact source key.');
        }

        return [
            'path' => $relative, 'sha256' => hash_file('sha256', $path),
            'level' => $level, 'topic' => $topic, 'words' => $topics[$level][$topic],
            'limitation' => 'First-seen topic, not a validated CEFR lexicon. Lemmas were inferred out of context and contain errors. Counts cover the whole corpus; review forms manually.',
        ];
    }
}
