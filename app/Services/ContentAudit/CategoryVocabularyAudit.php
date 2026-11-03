<?php

namespace App\Services\ContentAudit;

use App\Models\DictionaryCategory;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class CategoryVocabularyAudit
{
    public function __construct(private CourseVocabularyIndex $vocabulary, private LatvianLemmaResolver $resolver,
        private ?CategoryLearningBalance $balance = null) {}

    public function report(DictionaryCategory $category, ?string $topicId = null, bool $descendants = true, string $mode = 'corpus'): array
    {
        [$index, $scopeIds, $ancestorIds, $topicId, $autoTopicId] = $this->context($category, $topicId, $descendants);
        $words = DB::table('dictionary_words as w')->where('w.dictionary_id', $category->dictionary_id)
            ->whereExists(fn ($q) => $q->selectRaw('1')->from('dictionary_word_category as c')
                ->whereColumn('c.word_id', 'w.id')->whereIn('c.category_id', array_keys($scopeIds)))
            ->orderBy('w.id')->get(['w.id', 'w.word', 'w.learn_lang', 'w.is_phrase']);
        $rows = [];
        foreach ($words as $word) {
            $rows[] = ['id' => $word->id, 'word' => $word->word, 'is_phrase' => (bool) $word->is_phrase]
                + $this->compare($word->word, $word->learn_lang, $index, $topicId, $mode);
        }
        $summary = array_fill_keys(['current', 'previous', 'future', 'elsewhere', 'unplaced', 'missing', 'ambiguous', 'unsupported'], 0);
        foreach ($rows as $row) {
            $summary[$row['status']]++;
        }

        return [
            'category' => ['id' => $category->id, 'name' => $category->name, 'dictionary_id' => $category->dictionary_id],
            'context' => $index['corpus_topics'][$topicId] ?? null, 'automatic_topic' => $autoTopicId,
            'topics' => array_values($index['corpus_topics']), 'include_descendants' => $descendants,
            'mode' => $mode, 'total' => count($rows),
            'summary' => array_map(fn ($count) => ['count' => $count, 'percent' => count($rows) ? round(100 * $count / count($rows), 1) : 0], $summary),
            'words' => $rows, 'sources' => $index['sources'], 'revision' => $index['revision'],
            'elaipa_contract' => ElaipaSourceContract::metadata(),
            'learning_balance' => ($this->balance ?? app(CategoryLearningBalance::class))->report(
                $index, (int) $category->dictionary_id, $scopeIds, $ancestorIds, $topicId),
        ];
    }

    private function context(DictionaryCategory $category, ?string $topicId, bool $descendants): array
    {
        $index = $this->vocabulary->build((int) $category->dictionary_id);
        $index['corpus_known'] = $this->corpusKnown($index);
        $categories = DB::table('dictionary_categories')->where('dictionary_id', $category->dictionary_id)->get(['id', 'parent_id'])->keyBy('id');
        $ancestorIds = [];
        $cursor = $category->id;
        while ($cursor && isset($categories[$cursor]) && ! isset($ancestorIds[$cursor])) {
            $ancestorIds[$cursor] = true;
            $cursor = $categories[$cursor]->parent_id;
        }
        $scopeIds = [(int) $category->id => true];
        if ($descendants) {
            do {
                $count = count($scopeIds);
                foreach ($categories as $child) {
                    if (isset($scopeIds[$child->parent_id])) {
                        $scopeIds[$child->id] = true;
                    }
                }
            } while (count($scopeIds) !== $count);
        }
        $contexts = [];
        foreach ($index['groups'] as $group) {
            if (isset($ancestorIds[$group['category_id']]) && isset($index['group_topics'][$group['id']])) {
                $contexts[$index['group_topics'][$group['id']]] = true;
            }
        }
        $autoTopicId = count($contexts) === 1 ? array_key_first($contexts) : null;
        $topicId ??= $autoTopicId;
        if ($topicId !== null && ! isset($index['corpus_topics'][$topicId])) {
            throw ValidationException::withMessages(['topic' => 'Тема отсутствует в JSON E-Laipa.']);
        }

        return [$index, $scopeIds, $ancestorIds, $topicId, $autoTopicId];
    }

    public function inspectWord(DictionaryCategory $category, string $surface, ?string $topicId = null, bool $descendants = true): array
    {
        [$index, $scopeIds, $ancestorIds, $topicId] = $this->context($category, $topicId, $descendants);
        $balance = $this->balance ?? app(CategoryLearningBalance::class);
        $groups = array_values(array_filter($index['groups'], fn ($group) => isset($ancestorIds[$group['category_id']])));
        $group = count($groups) === 1 ? $groups[0] : null;
        $inventory = $balance->inventory($index, (int) $category->dictionary_id, $scopeIds, $group);
        $surface = LatvianLemmaResolver::normalize($surface);
        $match = $balance->dictionaryMatch($surface, $inventory, null);
        $keys = array_fill_keys([$surface, ...$match['resolution']['lemmas']], true);
        $topics = [];
        $source = app(ElaipaTopicOccurrences::class)->source();
        $contextPosition = $index['corpus_topics'][$topicId]['position'] ?? null;
        foreach ($source['topics'] ?? [] as $id => $topic) {
            $forms = [];
            foreach ($topic['words'] as $form => $frequency) {
                $resolved = $this->resolver->resolve($form, $this->resolver->index()['lemmas'], 'corpus');
                if (isset($keys[$form]) || (count($resolved['lemmas']) === 1 && isset($keys[$resolved['lemmas'][0]]))) {
                    $forms[] = ['word' => $form, 'frequency' => $frequency];
                }
            }
            if ($forms) {
                $position = $topic['position'];
                $topics[] = ['id' => $id, 'level' => $topic['level'], 'topic' => $topic['topic'], 'position' => $position,
                    'relation' => $contextPosition === null ? 'elsewhere' : ($position < $contextPosition ? 'previous' : ($position === $contextPosition ? 'current' : 'future')),
                    'forms' => $forms, 'frequency' => array_sum(array_column($forms, 'frequency'))];
            }
        }
        usort($topics, fn ($a, $b) => $a['position'] <=> $b['position']);
        $categories = DB::table('dictionary_categories')->where('dictionary_id', $category->dictionary_id)->get(['id', 'parent_id', 'name'])->keyBy('id');
        $targets = [];
        foreach ($categories as $target) {
            $path = [];
            $seen = [];
            $cursor = $target->id;
            $owners = [];
            while ($cursor && isset($categories[$cursor]) && ! isset($seen[$cursor])) {
                $seen[$cursor] = true;
                array_unshift($path, $categories[$cursor]->name);
                foreach ($index['groups'] as $owner) {
                    if ($owner['category_id'] === $cursor) {
                        $owners[] = $owner;
                    }
                }
                $cursor = $categories[$cursor]->parent_id;
            }
            $position = $owners ? min(array_column($owners, 'position')) : null;
            $targets[] = ['id' => $target->id, 'path' => implode(' / ', $path), 'position' => $position,
                'relation' => $group === null || $position === null ? 'elsewhere' : ($position < $group['position'] ? 'previous' : ($position === $group['position'] ? 'current' : 'future'))];
        }
        usort($targets, fn ($a, $b) => [$a['position'] ?? PHP_INT_MAX, $a['path']] <=> [$b['position'] ?? PHP_INT_MAX, $b['path']]);

        return ['word' => $surface, 'status' => $match['status'], 'resolution' => $match['resolution'],
            'matches' => $match['matches'], 'topics' => $topics, 'topics_complete' => (bool) ($source['complete'] ?? false), 'categories' => $targets];
    }

    public function compare(string $word, string $language, array $index, ?string $topicId, string $mode = 'corpus'): array
    {
        if (strtolower($language) !== 'lv') {
            return ['status' => 'unsupported', 'lemmas' => [], 'method' => 'unmatched', 'review_required' => false, 'matches' => []];
        }
        // DB exact matches must not suppress recognition of an E-Laipa inflected form.
        $known = $index['corpus_known'] ?? $this->corpusKnown($index);
        $resolved = $this->resolver->resolve($word, $known, $mode);
        $matches = [];
        $contextPosition = $index['corpus_topics'][$topicId]['position'] ?? null;
        foreach ($resolved['lemmas'] as $lemma) {
            foreach ($index['entries'][$lemma]['elaipa'] ?? [] as $hit) {
                $key = $hit['level'].':'.$hit['topic'];
                $position = $index['corpus_topics'][$key]['position'] ?? null;
                $relative = $contextPosition === null || $position === null ? 'elsewhere'
                    : ($position === $contextPosition ? 'current' : ($position < $contextPosition ? 'previous' : 'future'));
                $matches[] = $hit + ['lemma' => $lemma, 'topic_id' => $key, 'relative' => $relative, 'position' => $position,
                    'topic_basis' => 'first_seen', 'frequency_scope' => 'whole_corpus', 'presence_in_current_topic_verified' => null];
            }
        }
        usort($matches, fn ($a, $b) => [$a['position'], $a['lemma'], $a['part_of_speech']] <=> [$b['position'], $b['lemma'], $b['part_of_speech']]);
        $locations = array_column($matches, 'relative');
        $status = count($resolved['lemmas']) > 1 ? 'ambiguous' : (in_array('current', $locations, true) ? 'current'
            : (in_array('previous', $locations, true) ? 'previous' : (in_array('future', $locations, true) ? 'future'
                : ($matches ? 'elsewhere' : ($resolved['lemmas'] ? 'unplaced' : 'missing')))));

        return $resolved + ['status' => $status, 'matches' => $matches];
    }

    private function corpusKnown(array $index): array
    {
        $known = $this->resolver->index()['lemmas'];
        foreach ($index['entries'] as $key => $entry) {
            if ($entry['elaipa']) {
                $known[$key] = true;
            }
        }

        return $known;
    }
}
