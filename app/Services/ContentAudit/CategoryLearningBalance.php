<?php

namespace App\Services\ContentAudit;

use Illuminate\Support\Facades\DB;

class CategoryLearningBalance
{
    public function __construct(private LatvianLemmaResolver $resolver, private LessonTextExtractor $texts,
        private ElaipaTopicOccurrences $topics) {}

    public function report(array $index, int $dictionaryId, array $scopeIds, array $ancestorIds, ?string $topicId): array
    {
        $groups = array_filter($index['groups'], fn ($group) => isset($ancestorIds[$group['category_id']]));
        $group = count($groups) === 1 ? array_values($groups)[0] : null;
        $inventory = $this->inventory($index, $dictionaryId, $scopeIds, $group);
        $source = $this->topics->source();
        $topicRows = $source['topics'] ?? [];
        $complete = (bool) ($source['complete'] ?? false);
        if (! $source) {
            foreach ($index['corpus_topics'] as $id => $topic) {
                $topicRows[$id] = $topic + ['words' => []];
            }
            foreach ($index['entries'] as $lemma => $entry) {
                foreach ($entry['elaipa'] as $hit) {
                    $id = $hit['level'].':'.$hit['topic'];
                    $topicRows[$id]['words'][$lemma] = $hit['frequency'];
                }
            }
        }
        $context = $topicRows[$topicId] ?? null;
        $elaipa = $this->corpusInventory($topicRows, $context['position'] ?? null);
        $reverse = [];
        foreach ($context['words'] ?? [] as $surface => $frequency) {
            $resolution = $this->resolve($surface);
            $key = count($resolution['lemmas']) === 1 ? $resolution['lemmas'][0] : $surface;
            if (! isset($reverse[$key])) {
                $match = $this->dictionaryMatch($surface, $inventory);
                $reverse[$key] = ['word' => $key, 'forms' => [], 'frequency' => 0, 'status' => $match['status'],
                    'matches' => $match['matches'], 'review_required' => $resolution['review_required'] || $match['status'] === 'ambiguous'];
            }
            $reverse[$key]['forms'][] = $surface;
            $reverse[$key]['frequency'] += $frequency;
        }
        $reverse = array_values($reverse);
        usort($reverse, fn ($a, $b) => [$b['frequency'], $a['word']] <=> [$a['frequency'], $b['word']]);
        $summary = array_fill_keys(['current', 'previous', 'future', 'elsewhere', 'missing', 'ambiguous'], 0);
        foreach ($reverse as $word) {
            $summary[$word['status']]++;
        }
        $sections = [];
        $load = new CourseLearningLoad;
        $loadContext = $group ? $load->context($index['groups'], $group) : null;
        foreach (['receptive' => ['reading', 'listening'], 'productive' => ['writing', 'speaking']] as $section => $skills) {
            $rows = $group ? $this->lessonRows($group['id'], $skills, $section, $inventory, $elaipa) : [];
            foreach ($rows as &$row) {
                $row['learning_load'] = $load->inspect($row['_load_config'], $row['skill'], $loadContext);
                unset($row['_load_config']);
            }
            unset($row);
            $sections[$section] = ['skills' => $skills, 'rows' => $rows, 'summary' => $this->aggregate($rows),
                'without_text' => count(array_filter($rows, fn ($row) => $row['metric']['total'] === 0))];
        }

        return ['course_group' => $group, 'topic_available' => $context !== null, 'order_available' => $group !== null,
            'source_basis' => $complete ? 'topic_occurrences' : 'first_seen', 'source' => $this->topics->metadata(),
            'tasks_counted' => $source['tasks_counted'] ?? null,
            'reverse' => ['total' => count($reverse), 'missing_before_and_now' => $summary['missing'] + $summary['future'] + $summary['elsewhere'],
                'summary' => $summary, 'words' => $reverse], 'comparisons' => $sections];
    }

    private function resolve(string $surface): array
    {
        return $this->resolver->resolve($surface, $this->resolver->index()['lemmas'], 'corpus');
    }

    public function inventory(array $index, int $dictionaryId, array $scopeIds, ?array $group): array
    {
        $inventory = ['exact' => [], 'lemmas' => []];
        foreach ($index['entries'] as $entry) {
            foreach ($entry['db'] as $word) {
                if ((int) $word['dictionary_id'] !== $dictionaryId) {
                    continue;
                }
                $relation = 'elsewhere';
                $positions = [];
                foreach ($word['categories'] as $category) {
                    if (isset($scopeIds[$category['id']])) {
                        $relation = 'current';
                    }
                    foreach ($index['groups'] as $owner) {
                        if (in_array($owner['category_id'], $category['ancestors'], true)) {
                            $positions[] = $owner['position'];
                        }
                    }
                }
                if ($group && $positions) {
                    if (min($positions) < $group['position']) {
                        $relation = 'previous';
                    } elseif ($relation !== 'current' && min($positions) > $group['position']) {
                        $relation = 'future';
                    }
                }
                $evidence = ['id' => $word['id'], 'word' => $word['word'], 'relation' => $relation,
                    'categories' => array_map(fn ($category) => ['id' => $category['id'], 'path' => $category['path']], $word['categories'])];
                foreach ($this->tokens($word['word']) as $surface) {
                    $inventory['exact'][$surface][$word['id']] = $evidence;
                    $resolved = $this->resolve($surface);
                    if (count($resolved['lemmas']) === 1) {
                        $inventory['lemmas'][$resolved['lemmas'][0]][$word['id']] = $evidence;
                    }
                }
            }
        }

        return $inventory;
    }

    public function dictionaryMatch(string $surface, array $inventory, ?int $limit = 5): array
    {
        $surface = LatvianLemmaResolver::normalize($surface);
        $resolved = $this->resolve($surface);
        $matches = $inventory['exact'][$surface] ?? [];
        if (count($resolved['lemmas']) === 1) {
            $matches += $inventory['lemmas'][$resolved['lemmas'][0]] ?? [];
        }
        $locations = array_column($matches, 'relation');
        $status = 'missing';
        foreach (['previous', 'current', 'future', 'elsewhere'] as $relation) {
            if (in_array($relation, $locations, true)) {
                $status = $relation;
                break;
            }
        }
        if (! $matches && count($resolved['lemmas']) > 1) {
            $status = 'ambiguous';
        }

        $matches = array_values($matches);
        $order = ['previous' => 0, 'current' => 1, 'future' => 2, 'elsewhere' => 3];
        usort($matches, fn ($a, $b) => [$order[$a['relation']], $a['id']] <=> [$order[$b['relation']], $b['id']]);

        return ['status' => $status, 'matches' => $limit === null ? $matches : array_slice($matches, 0, $limit), 'resolution' => $resolved];
    }

    public function corpusInventory(array $topics, ?int $position): array
    {
        $result = ['available' => $position !== null, 'known' => [], 'future' => [], 'all' => []];
        foreach ($topics as $topic) {
            $bucket = $position === null ? null : ($topic['position'] <= $position ? 'known' : 'future');
            foreach ($topic['words'] as $surface => $_) {
                $result['all'][$surface] = true;
                if ($bucket !== null) {
                    $result[$bucket][$surface] = true;
                }
                $resolved = $this->resolve($surface);
                if (count($resolved['lemmas']) === 1) {
                    $result['all'][$resolved['lemmas'][0]] = true;
                    if ($bucket !== null) {
                        $result[$bucket][$resolved['lemmas'][0]] = true;
                    }
                }
            }
        }

        return $result;
    }

    public function measure(string $text, array $inventory, array $elaipa): array
    {
        $counts = array_count_values($this->tokens($text));
        $buckets = array_fill_keys(['dictionary', 'elaipa_extra', 'future', 'unmatched', 'ambiguous'], 0);
        $wholeDictionary = 0;
        $words = [];
        foreach ($counts as $surface => $count) {
            $match = $this->dictionaryMatch($surface, $inventory);
            $resolved = $match['resolution'];
            $keys = [$surface];
            if (count($resolved['lemmas']) === 1) {
                $keys[] = $resolved['lemmas'][0];
            }
            $bucket = in_array($match['status'], ['current', 'previous'], true) ? 'dictionary'
                : (array_intersect_key($elaipa['known'], array_fill_keys($keys, true)) ? 'elaipa_extra'
                    : ($match['status'] === 'ambiguous' ? 'ambiguous'
                        : ($match['status'] === 'future' || array_intersect_key($elaipa['future'], array_fill_keys($keys, true)) ? 'future' : 'unmatched')));
            $buckets[$bucket] += $count;
            if ($match['matches']) {
                $wholeDictionary += $count;
            }
            $words[] = ['word' => $surface, 'count' => $count, 'bucket' => $bucket, 'lemmas' => $resolved['lemmas'],
                'elaipa_present' => (bool) array_intersect_key($elaipa['all'] ?? ($elaipa['known'] + $elaipa['future']), array_fill_keys($keys, true)),
                'dictionary_status' => $match['status'], 'matches' => $match['matches'], 'review_required' => $resolved['review_required']];
        }
        $total = array_sum($counts);

        return ['total' => $total, 'unique' => count($counts), 'buckets' => $buckets,
            'whole_dictionary_count' => $wholeDictionary,
            'whole_dictionary_percent' => $total ? round(100 * $wholeDictionary / $total, 1) : null,
            'dictionary_percent' => $total ? round(100 * $buckets['dictionary'] / $total, 1) : null,
            'combined_percent' => $total && $elaipa['available'] ? round(100 * ($buckets['dictionary'] + $buckets['elaipa_extra']) / $total, 1) : null,
            'words' => $words];
    }

    private function tokens(string $text): array
    {
        $text = preg_replace('/\{\{[^}]*\}\}/', ' ', html_entity_decode(strip_tags($text), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
        $text = preg_replace('/\b[AB][12]\b/iu', ' ', $text);

        return array_values(array_map(fn ($token) => $token['key'], array_filter($this->texts->tokens($text),
            fn ($token) => preg_match('/^\p{Latin}/u', $token['surface']))));
    }

    public function learnerText(array $config, bool $productive): string
    {
        $parts = [];
        $add = function ($value) use (&$parts): void {
            if (is_string($value) && trim($value) !== '') {
                $parts[] = $value;
            }
        };
        if ($productive) {
            $add($config['topic'] ?? null);
        }
        if (! empty($config['dialogue_segments'])) {
            foreach ($config['dialogue_segments'] as $segment) {
                $add($segment['text'] ?? null);
            }
        } else {
            $add(isset($config['transcript']) ? preg_replace('/^[AB]:\s*/m', '', $config['transcript']) : null);
        }
        $add($config['text'] ?? null);
        if (($config['task_kind'] ?? '') !== 'ru_to_lv') {
            $add($config['source_text'] ?? null);
        }
        // Practice blocks show instruction, falling back to lesson_text; Latin fragments remain relevant in Russian instructions.
        $add(($config['instruction'] ?? '') ?: ($config['lesson_text'] ?? null));
        $add($config['prompt'] ?? null);
        foreach ($config['questions'] ?? [] as $question) {
            if (is_string($question)) {
                $add($question);

                continue;
            }
            $add($question['prompt'] ?? $question['statement'] ?? $question['text'] ?? null);
            foreach (['options', 'tokens'] as $field) {
                foreach ($question[$field] ?? [] as $value) {
                    $add($value);
                }
            }
        }

        return implode("\n", $parts);
    }

    private function lessonRows(int $groupId, array $skills, string $section, array $inventory, array $elaipa): array
    {
        $placed = DB::table('lesson_blocks as b')->join('lesson_pages as p', 'p.id', '=', 'b.lesson_page_id')
            ->where('p.course_group_id', $groupId)->where('p.is_published', true)->where('p.status', 'published')
            ->where('p.learn_lang', 'lv')->whereIn('p.skill', $skills)
            ->orderBy('p.skill')->orderBy('b.position')->orderBy('b.id')
            ->get(['b.id', 'b.title', 'b.config', 'b.source_block_id', 'p.slug', 'p.skill']);
        $sourceIds = $placed->map(fn ($block) => $block->source_block_id ?: $block->id)->all();
        $variants = DB::table('lesson_block_variants')->whereIn('lesson_block_id', $sourceIds)->where('is_published', true)
            ->orderBy('position')->orderBy('id')->get()->groupBy('lesson_block_id');
        $rows = [];
        foreach ($placed as $block) {
            // Reused grammar sources do not belong to either language-skill comparison.
            if ($block->source_block_id) {
                continue;
            }
            $items = $variants->get($block->id, collect());
            if ($items->isEmpty()) {
                $items = collect([(object) ['id' => null, 'config' => $block->config]]);
            }
            foreach ($items as $number => $variant) {
                $config = json_decode($variant->config ?: '{}', true, 512, JSON_THROW_ON_ERROR);
                $input = $this->learnerText($config, $section === 'productive');
                $rows[] = ['block_id' => $block->id, 'variant_id' => $variant->id, 'variant' => $number + 1,
                    'skill' => $block->skill, 'title' => $block->title, 'url' => '/lessons/'.$block->slug,
                    '_load_config' => $config,
                    'scope' => 'input', 'learner_text' => $input,
                    'metric' => $this->measure($input, $inventory, $elaipa)];
            }
        }

        return $rows;
    }

    private function aggregate(array $rows, string $field = 'metric'): array
    {
        $total = 0;
        $buckets = array_fill_keys(['dictionary', 'elaipa_extra', 'future', 'unmatched', 'ambiguous'], 0);
        $hasCombined = false;
        $wholeDictionary = 0;
        foreach ($rows as $row) {
            $total += $row[$field]['total'];
            $wholeDictionary += $row[$field]['whole_dictionary_count'];
            $hasCombined = $hasCombined || $row[$field]['combined_percent'] !== null;
            foreach ($buckets as $key => $_) {
                $buckets[$key] += $row[$field]['buckets'][$key];
            }
        }

        return ['total' => $total, 'buckets' => $buckets, 'dictionary_percent' => $total ? round(100 * $buckets['dictionary'] / $total, 1) : null,
            'whole_dictionary_count' => $wholeDictionary,
            'whole_dictionary_percent' => $total ? round(100 * $wholeDictionary / $total, 1) : null,
            'combined_percent' => $total && $hasCombined ? round(100 * ($buckets['dictionary'] + $buckets['elaipa_extra']) / $total, 1) : null];
    }
}
