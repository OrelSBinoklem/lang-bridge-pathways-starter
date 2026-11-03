<?php

namespace App\Services\ContentAudit;

use Illuminate\Support\Facades\Cache;
use RuntimeException;

class LatvianLemmaResolver
{
    private ?array $index = null;

    public function __construct(private ?array $source = null) {}

    public static function normalize(string $word): string
    {
        if (class_exists(\Normalizer::class)) {
            $word = \Normalizer::normalize($word, \Normalizer::FORM_C) ?: $word;
        }

        return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $word)));
    }

    public function sourceMetadata(): array
    {
        $path = resource_path('external-sources/e-laipa/derived/e-laipa-a1-b2-lemmas.json');
        if ($this->source !== null) {
            return ['path' => 'test-fixture', 'sha256' => hash('sha256', json_encode($this->source))];
        }
        if (! is_file($path)) {
            throw new RuntimeException('Отсутствует JSON словоформ E-Laipa.');
        }

        return ['path' => 'resources/external-sources/e-laipa/derived/e-laipa-a1-b2-lemmas.json', 'sha256' => hash_file('sha256', $path)];
    }

    public function index(): array
    {
        if ($this->index !== null) {
            return $this->index;
        }
        $build = function (): array {
            $source = $this->source ?? json_decode(file_get_contents(base_path($this->sourceMetadata()['path'])), true, 512, JSON_THROW_ON_ERROR);
            $forms = $lemmas = [];
            foreach ($source['words'] ?? [] as $entries) {
                foreach ($entries as $entry) {
                    $lemma = self::normalize($entry['lemma']);
                    $lemmas[$lemma] = true;
                    foreach ($entry['source_forms'] ?? [] as $form) {
                        $forms[self::normalize($form['surface'])][$lemma] = true;
                    }
                }
            }
            foreach ($forms as &$candidates) {
                $candidates = array_keys($candidates);
            }
            unset($candidates);

            return ['forms' => $forms, 'lemmas' => $lemmas];
        };

        return $this->index = $this->source !== null ? $build() : Cache::store('file')->remember(
            'content-audit:lemma-v1:'.$this->sourceMetadata()['sha256'], 86400, $build,
        );
    }

    public function resolve(string $surface, array $known, string $mode = 'heuristic'): array
    {
        $word = self::normalize($surface);
        if (isset($known[$word])) {
            return ['lemmas' => [$word], 'method' => 'exact', 'review_required' => false];
        }
        if ($mode === 'exact') {
            return ['lemmas' => [], 'method' => 'unmatched', 'review_required' => false];
        }
        $corpus = $this->index()['forms'][$word] ?? [];
        if ($corpus) {
            return ['lemmas' => $corpus, 'method' => 'corpus_form', 'review_required' => true];
        }
        if ($mode !== 'heuristic') {
            return ['lemmas' => [], 'method' => 'unmatched', 'review_required' => false];
        }
        $candidates = [];
        // These endings propose existing lexical entries only; they are not a morphology engine.
        $endings = ['ajiem' => ['ais'], 'ajām' => ['ā'], 'ajam' => ['ais'], 'ajā' => ['ais', 'ā'],
            'ām' => ['a'], 'iem' => ['s', 'is'], 'ās' => ['a', 'ā'], 'ā' => ['a'],
            'us' => ['s', 'us'], 'os' => ['s'], 'u' => ['s', 'is', 'a', 'e'], 'a' => ['s'], 'i' => ['s', 'is'], 'es' => ['e'],
            'āju' => ['āt'], 'ēju' => ['ēt'], 'ju' => ['t'], 'jam' => ['t'], 'jat' => ['t'], 'ja' => ['t']];
        foreach ($endings as $ending => $replacements) {
            if (! str_ends_with($word, $ending) || mb_strlen($word) <= mb_strlen($ending) + 1) {
                continue;
            }
            $stem = mb_substr($word, 0, mb_strlen($word) - mb_strlen($ending));
            $stems = [$stem];
            foreach (['š' => ['s', 't'], 'ž' => ['z', 'd'], 'ķ' => ['k'], 'ģ' => ['g'], 'ņ' => ['n'], 'ļ' => ['l']] as $changed => $originals) {
                if (str_ends_with($stem, $changed)) {
                    foreach ($originals as $original) {
                        $stems[] = mb_substr($stem, 0, -1).$original;
                    }
                }
            }
            foreach ($stems as $candidateStem) {
                foreach ($replacements as $replacement) {
                    $candidate = $candidateStem.$replacement;
                    if (isset($known[$candidate])) {
                        $candidates[$candidate] = true;
                    }
                }
            }
        }

        return ['lemmas' => array_keys($candidates), 'method' => $candidates ? 'heuristic' : 'unmatched', 'review_required' => (bool) $candidates];
    }
}
