<?php

namespace App\Services\ContentAudit;

use App\Models\CourseGroup;
use App\Models\LessonPage;

class CourseContentAudit
{
    public const BUCKETS = [
        'prior' => 'Предыдущие темы', 'current' => 'Текущая тема', 'future' => 'Только будущие темы',
        'unplaced' => 'БД вне тем этого курса', 'corpus' => 'Только E-Laipa, без доказанного места в курсе',
        'ambiguous' => 'Неоднозначная форма', 'unknown' => 'Нигде не найдено',
    ];

    public const COLORS = [
        'prior' => '#168575', 'current' => '#2563eb', 'future' => '#d97706',
        'unplaced' => '#64748b', 'corpus' => '#0891b2', 'ambiguous' => '#9333ea', 'unknown' => '#dc2626',
    ];

    public function __construct(private CourseVocabularyIndex $vocabulary, private LessonTextExtractor $texts, private LatvianLemmaResolver $resolver) {}

    public function report(int $lessonId, ?int $blockId, ?int $variantId, ?int $contextId, string $scope, string $countMode, string $mode): array
    {
        $page = LessonPage::with('blocks.sourceBlock.variants', 'blocks.variants', 'courseGroup')->findOrFail($lessonId);
        abort_unless($page->learn_lang === 'lv', 422, 'Поддерживается латышский язык.');
        $block = $blockId ? $page->blocks->firstWhere('id', $blockId) : $page->blocks->first();
        abort_unless($block, 422, 'На странице нет выбранного блока.');
        $source = $block->source_block_id ? $block->sourceBlock : $block;
        abort_unless($source, 422, 'Источник блока отсутствует.');
        $variant = $variantId ? $source->variants->firstWhere('id', $variantId) : $source->variants->first();
        abort_if($variantId && ! $variant, 422, 'Вариант не принадлежит выбранному блоку.');
        $context = $page->courseGroup ?? ($contextId ? CourseGroup::findOrFail($contextId) : null);
        abort_if($context && $context->learn_lang !== 'lv', 422);
        $index = $this->vocabulary->build($context?->dictionary_id);
        $config = $variant?->config ?? $source->config ?? [];
        $parts = $this->texts->parts($config, $scope);
        $reference = null;
        if ($scope === 'all' && empty($config['reference_translation'])) {
            $reference = app(AuthoredTextReference::class)->find($config);
            if ($reference) {
                $parts[] = ['label' => 'Эталон перевода из совпадающего авторского JSON', 'text' => $reference['text']];
            }
        }
        if ($block->type === 'words') {
            $parts = [];
            foreach ($index['entries'] as $entry) {
                foreach ($entry['db'] as $word) {
                    if ((int) $word['dictionary_id'] !== (int) ($config['dictionary_id'] ?? 0)) {
                        continue;
                    }
                    foreach ($word['categories'] as $category) {
                        if (in_array((int) ($config['category_id'] ?? 0), $category['ancestors'], true)) {
                            $parts[] = ['label' => 'Слова категории', 'text' => $word['word']];
                            break;
                        }
                    }
                }
            }
        }
        $result = $this->analyze($parts, $index, $context?->id, $countMode, $mode);
        $result['selection'] = ['lesson' => $page->id, 'block' => $block->id, 'variant' => $variant?->id,
            'title' => $page->title, 'block_title' => $block->title, 'variant_title' => $variant?->title,
            'context' => $context?->display_title, 'level' => $context?->level,
            'source_block' => $source->id, 'draft' => ! $page->is_published || $page->status !== 'published' || ($variant && ! $variant->is_published)];
        $result['sources'] = $index['sources'];
        if ($reference) {
            $result['sources']['authored_reference'] = ['path' => $reference['path'], 'sha256' => $reference['sha256']];
        }
        $result['mapped_topics'] = $index['mapped_topics'];
        $result['unmapped_groups'] = $index['unmapped_groups'];
        $result['revision'] = hash('sha256', json_encode([$index['revision'], $result['selection'], $scope, $countMode, $mode, $result['segments']], JSON_THROW_ON_ERROR));

        return $result;
    }

    public function analyze(array $parts, array $index, ?int $contextId, string $countMode = 'occurrences', string $mode = 'corpus'): array
    {
        $current = $index['groups'][$contextId] ?? null;
        $words = $segments = [];
        foreach ($parts as $part) {
            $pieces = [];
            $cursor = 0;
            foreach ($this->texts->units($part['text'], $index['known']) as $unit) {
                if ($unit['offset'] > $cursor) {
                    $pieces[] = ['text' => substr($part['text'], $cursor, $unit['offset'] - $cursor), 'key' => null];
                }
                $pieces[] = ['text' => $unit['surface'], 'key' => $unit['key']];
                $cursor = $unit['offset'] + $unit['length'];
                if (! isset($words[$unit['key']])) {
                    $match = $this->resolver->resolve($unit['key'], $index['known'], $mode);
                    $entries = [];
                    foreach ($match['lemmas'] as $lemma) {
                        $entries[$lemma] = $index['entries'][$lemma] ?? ['db' => [], 'db_groups' => [], 'elaipa' => [], 'elaipa_groups' => []];
                    }
                    if ($match['method'] === 'exact' && count($entries) === 1 && ! array_values($entries)[0]['db']) {
                        $match['review_required'] = true;
                    }
                    $words[$unit['key']] = ['key' => $unit['key'], 'surface' => $unit['surface'], 'count' => 0,
                        'match' => $match, 'entries' => $entries,
                        'bucket' => $this->classify($match, $entries, $index['groups'], $current),
                        'db_bucket' => $this->classify($match, $entries, $index['groups'], $current)];
                }
                $words[$unit['key']]['count']++;
            }
            if ($cursor < strlen($part['text'])) {
                $pieces[] = ['text' => substr($part['text'], $cursor), 'key' => null];
            }
            $segments[] = ['label' => $part['label'], 'pieces' => $pieces];
        }
        $buckets = $dbBuckets = array_fill_keys(array_keys(self::BUCKETS), 0);
        $topicCounts = $categoryCounts = [];
        $skills = array_fill_keys(['words', 'grammar', 'listening', 'reading', 'writing', 'speaking'], 0);
        $total = $review = $newForms = $corpusFound = 0;
        foreach ($words as &$word) {
            $weight = $countMode === 'unique' ? 1 : $word['count'];
            $total += $weight;
            $buckets[$word['bucket']] += $weight;
            $dbBuckets[$word['db_bucket']] += $weight;
            if ($word['match']['review_required']) {
                $review += $weight;
            }
            if (count($word['match']['lemmas']) === 1 && $word['match']['method'] !== 'exact') {
                $newForms += $weight;
            }
            if (count($word['entries']) === 1 && array_values($word['entries'])[0]['elaipa']) {
                $corpusFound += $weight;
            }
            $groupIds = [];
            if (count($word['entries']) === 1) {
                foreach ($word['entries'] as $entry) {
                    $groupIds = array_keys($entry['db_groups']);
                }
            }
            usort($groupIds, fn ($a, $b) => ($index['groups'][$a]['position'] ?? PHP_INT_MAX) <=> ($index['groups'][$b]['position'] ?? PHP_INT_MAX));
            $owner = $groupIds[0] ?? null;
            $topicKey = $owner ? 'group:'.$owner : 'bucket:'.$word['db_bucket'];
            $topicCounts[$topicKey] ??= ['label' => $owner ? $index['groups'][$owner]['level'].' · '.$index['groups'][$owner]['title'] : self::BUCKETS[$word['db_bucket']],
                'count' => 0, 'color' => self::COLORS[$word['db_bucket']], 'position' => $owner ? $index['groups'][$owner]['position'] : PHP_INT_MAX];
            $topicCounts[$topicKey]['count'] += $weight;
            $seenCategories = [];
            if (count($word['entries']) === 1) {
                foreach ($word['entries'] as $entry) {
                    foreach ($entry['db'] as $dbWord) {
                        foreach ($dbWord['categories'] ?? [] as $category) {
                            if (isset($seenCategories[$category['id']])) {
                                continue;
                            }
                            $seenCategories[$category['id']] = true;
                            $categoryCounts[$category['id']] ??= ['label' => $category['path'], 'dictionary' => $category['dictionary'], 'count' => 0];
                            $categoryCounts[$category['id']]['count'] += $weight;
                        }
                    }
                }
            }
            $seenSkills = [];
            if ($current && count($word['match']['lemmas']) === 1) {
                if ($word['db_bucket'] === 'prior') {
                    $seenSkills['words'] = true;
                }
                $lemma = $word['match']['lemmas'][0];
                foreach ($index['occurrences'][$lemma] ?? [] as $skill => $occurrences) {
                    $skill = $skill === 'custom_category' ? 'words' : $skill;
                    foreach (array_keys($occurrences) as $id) {
                        if (isset($skills[$skill], $index['groups'][$id]) && $index['groups'][$id]['position'] < $current['position']) {
                            $seenSkills[$skill] = true;
                        }
                    }
                }
            }
            $word['prior_skills'] = array_keys($seenSkills);
            foreach ($seenSkills as $skill => $unused) {
                $skills[$skill] += $weight;
            }
        }
        unset($word);
        uasort($topicCounts, fn ($a, $b) => $a['position'] <=> $b['position']);
        $percent = fn ($count) => $total ? round($count / $total * 100, 1) : 0;
        $summary = [];
        foreach (self::BUCKETS as $key => $label) {
            $summary[] = ['key' => $key, 'label' => $label, 'count' => $buckets[$key], 'percent' => $percent($buckets[$key]), 'db_count' => $dbBuckets[$key], 'db_percent' => $percent($dbBuckets[$key]), 'color' => self::COLORS[$key]];
        }
        $topicChart = array_map(fn ($row) => [...$row, 'percent' => $percent($row['count'])], array_values($topicCounts));
        uasort($categoryCounts, fn ($a, $b) => $b['count'] <=> $a['count']);
        $categoryRows = array_map(fn ($row) => [...$row, 'percent' => $percent($row['count'])], array_values($categoryCounts));
        $names = ['words' => 'Словарь', 'grammar' => 'Грамматика', 'listening' => 'Слушание', 'reading' => 'Чтение', 'writing' => 'Письмо', 'speaking' => 'Говорение'];
        $skillChart = [];
        foreach ($skills as $key => $count) {
            $skillChart[] = ['label' => $names[$key], 'count' => $count, 'percent' => $percent($count), 'color' => ['#168575', '#7c3aed', '#0284c7', '#ca8a04', '#e11d48', '#ea580c'][array_search($key, array_keys($skills))]];
        }

        return ['words' => $words, 'segments' => $segments, 'total' => $total, 'unique' => count($words), 'review' => $review,
            'new_forms' => $newForms, 'summary' => $summary, 'topic_chart' => $topicChart, 'skill_chart' => $skillChart,
            'category_rows' => $categoryRows,
            'elaipa_found' => $corpusFound, 'elaipa_contract' => ElaipaSourceContract::metadata(),
            'count_mode' => $countMode, 'has_context' => (bool) $current];
    }

    private function classify(array $match, array $entries, array $groups, ?array $current): string
    {
        if (! $match['lemmas']) {
            return 'unknown';
        }
        if (count($match['lemmas']) !== 1) {
            return 'ambiguous';
        }
        $entry = array_values($entries)[0];
        // The source exports first_seen, not membership in every E-Laipa topic.
        // Only current DB category links can establish course prerequisites.
        $ids = array_keys($entry['db_groups']);
        if ($current && $ids) {
            $positions = array_map(fn ($id) => $groups[$id]['position'], $ids);
            if (min($positions) < $current['position']) {
                return 'prior';
            }
            if (in_array($current['id'], $ids)) {
                return 'current';
            }

            return 'future';
        }
        if ($entry['db']) {
            return 'unplaced';
        }

        return $entry['elaipa'] || $match['lemmas'] ? 'corpus' : 'unknown';
    }
}
