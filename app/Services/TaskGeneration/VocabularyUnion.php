<?php

namespace App\Services\TaskGeneration;

class VocabularyUnion
{
    public function build(array $category, ?array $progress, ?array $topic): array
    {
        $union = [];
        $learned = array_flip(array_column($progress['learned_words'] ?? [], 'id'));
        $scored = array_flip(array_column($progress['words_with_score'] ?? [], 'id'));
        foreach (['previous_course' => $category['prior_words'], 'current_category' => $category['current_words'], 'personal_progress' => $progress['words_with_score'] ?? []] as $source => $words) {
            foreach ($words as $word) {
                $key = $this->normalize($word['word']);
                $union[$key] ??= ['word' => $word['word'], 'sources' => [], 'db_entries' => [], 'elaipa_candidates' => []];
                $union[$key]['sources'][$source] = true;
                $union[$key]['db_entries'][$word['id']] = [
                    'id' => $word['id'], 'translation' => $word['translation_1'],
                    'knowledge' => $progress === null ? 'not_assessed' : (isset($learned[$word['id']]) ? 'learned' : (isset($scored[$word['id']]) ? 'started' : 'not_demonstrated')),
                ];
            }
        }
        foreach ($topic['words'] ?? [] as $partOfSpeech => $words) {
            foreach ($words as [$word, $count]) {
                $key = $this->normalize($word);
                $union[$key] ??= ['word' => $word, 'sources' => [], 'db_entries' => [], 'elaipa_candidates' => []];
                $union[$key]['sources']['elaipa_topic'] = true;
                $union[$key]['elaipa_candidates'][] = ['part_of_speech' => $partOfSpeech, 'corpus_count' => $count, 'requires_review' => true];
            }
        }
        foreach ($union as &$entry) {
            $entry['sources'] = array_keys($entry['sources']);
            $entry['db_entries'] = array_values($entry['db_entries']);
        }
        unset($entry);

        return array_values($union);
    }

    private function normalize(string $word): string
    {
        return mb_strtolower(trim(preg_replace('/\s+/u', ' ', $word)));
    }
}
