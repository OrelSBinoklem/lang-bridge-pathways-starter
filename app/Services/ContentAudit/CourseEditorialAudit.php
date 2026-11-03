<?php

namespace App\Services\ContentAudit;

use App\Models\LessonPage;
use Illuminate\Validation\ValidationException;

class CourseEditorialAudit
{
    public function __construct(
        private CourseVocabularyIndex $vocabulary,
        private CourseContentAudit $audit,
        private LessonTextExtractor $texts,
        private AuthoredTextReference $references,
        private CategoryVocabularyAudit $categoryAudit,
        private LatvianLemmaResolver $resolver,
    ) {}

    public function report(int $dictionaryId, ?int $groupId = null): array
    {
        $index = $this->vocabulary->build($dictionaryId);
        $index['corpus_known'] = $this->resolver->index()['lemmas'];
        foreach ($index['entries'] as $key => $entry) {
            if ($entry['elaipa']) {
                $index['corpus_known'][$key] = true;
            }
        }
        $groups = $index['groups'];
        if ($groupId !== null) {
            if (! isset($groups[$groupId])) {
                throw ValidationException::withMessages(['group' => 'Группа не относится к опубликованному латышскому курсу этого словаря.']);
            }
            $groups = [$groupId => $groups[$groupId]];
        }
        $pages = LessonPage::with('blocks.variants', 'blocks.sourceBlock.variants', 'blocks.sourceBlock.page')
            ->whereIn('course_group_id', array_keys($groups))->where('learn_lang', 'lv')->orderBy('id')->get()->groupBy('course_group_id');
        $grammarFiles = [];
        foreach (glob(resource_path('course/grammar-*.json')) as $path) {
            $data = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
            foreach ($data['topics'] ?? [] as $topic) {
                if (isset($topic['slug'])) {
                    $grammarFiles[$topic['slug']][] = ['path' => 'resources/course/'.basename($path),
                        'sha256' => hash_file('sha256', $path), 'identity_verified' => false];
                }
            }
        }
        $themes = [];
        foreach ($groups as $id => $group) {
            $records = [];
            $inventory = array_fill_keys(['grammar', 'listening', 'reading', 'writing', 'speaking'], 0);
            $groupPages = $pages->get($id, collect());
            foreach ($groupPages as $page) {
                $inventory[$page->skill] = ($inventory[$page->skill] ?? 0) + 1;
                foreach ($page->blocks as $block) {
                    $source = $block->trainingBlock();
                    $base = [
                        'lesson_id' => $page->id, 'slug' => $page->slug, 'skill' => $page->skill,
                        'placement_block_id' => $block->id, 'source_block_id' => $source?->id,
                        'block_type' => $block->type, 'block_title' => $block->title,
                        'page_published' => $page->is_published && $page->status === 'published',
                        'source_page_id' => $source?->lesson_page_id,
                        'source_slug' => $source?->page?->slug, 'source_seed_key' => $source?->seed_key,
                        'grammar_source_candidates' => $grammarFiles[$source?->page?->slug] ?? [],
                    ];
                    if (! $source) {
                        $records[] = $base + ['status' => 'unavailable_source', 'flags' => ['unavailable_source'], 'variant_id' => null];

                        continue;
                    }
                    $variants = $source->variants->isEmpty() ? [null] : $source->variants;
                    foreach ($variants as $variant) {
                        $config = $variant?->config ?? $source->config ?? [];
                        $reference = empty($config['reference_translation']) ? $this->references->find($config) : null;
                        $body = $this->parts($block->type, $config, 'body', $index);
                        $all = $this->parts($block->type, $config, 'all', $index);
                        if ($reference) {
                            $all[] = ['label' => 'Совпавший авторский эталон', 'text' => $reference['text']];
                        }
                        $bodyReport = $this->audit->analyze($body, $index, $id, 'occurrences', 'corpus');
                        $allReport = $this->audit->analyze($all, $index, $id, 'occurrences', 'corpus');
                        $flags = [];
                        $kind = $config['task_kind'] ?? null;
                        if (! $allReport['total']) {
                            $flags[] = 'no_latvian_authored_text';
                        }
                        if ($kind === 'ru_to_lv' && empty($config['reference_translation']) && ! $reference) {
                            $flags[] = 'missing_translation_reference';
                        }
                        if ($block->type === 'custom_category') {
                            $flags[] = 'custom_component_not_indexed';
                        }
                        foreach (['future' => 'db_future_candidates', 'unknown' => 'unknown_candidates', 'ambiguous' => 'ambiguous_forms'] as $bucket => $flag) {
                            if (collect($allReport['summary'])->firstWhere('key', $bucket)['count'] > 0) {
                                $flags[] = $flag;
                            }
                        }
                        if ($allReport['review']) {
                            $flags[] = 'normalization_review';
                        }
                        $samples = [];
                        foreach ($allReport['words'] as $word) {
                            if (! in_array($word['db_bucket'], ['future', 'unknown', 'ambiguous', 'corpus']) && ! $word['match']['review_required']) {
                                continue;
                            }
                            $samples[] = ['surface' => $word['surface'], 'lemmas' => $word['match']['lemmas'],
                                'db_bucket' => $word['db_bucket'], 'method' => $word['match']['method'],
                                'review_required' => $word['match']['review_required'], 'count' => $word['count']];
                        }
                        usort($samples, fn ($a, $b) => [$b['count'], $a['surface']] <=> [$a['count'], $b['surface']]);
                        $variantId = $variant?->id;
                        $records[] = $base + [
                            'status' => 'analyzed', 'variant_id' => $variantId, 'variant_position' => $variant?->position,
                            'variant_published' => $variant?->is_published ?? null, 'task_kind' => $kind,
                            'config_sha256' => hash('sha256', json_encode($config, JSON_THROW_ON_ERROR)),
                            'audio_attached' => ! empty($config['audio_url']),
                            'body' => $this->metrics($bodyReport), 'expanded' => $this->metrics($allReport),
                            'flags' => $flags, 'review_words_total' => count($samples), 'review_words' => array_slice($samples, 0, 20),
                            'review_words_truncated' => count($samples) > 20,
                            'reference_source' => $reference ? ['path' => $reference['path'], 'sha256' => $reference['sha256']] : null,
                            'audit_path' => '/admin/content-audit?'.http_build_query(array_filter([
                                'lesson' => $page->id, 'block' => $block->id, 'variant' => $variantId, 'scope' => 'all',
                            ], fn ($value) => $value !== null)),
                        ];
                    }
                }
            }
            $candidates = [];
            $prefix = 'skills-'.$group['category_id'].'-'.strtolower($group['level']);
            foreach (glob(resource_path('course/'.$prefix.'*.json')) as $path) {
                $candidates[] = ['path' => 'resources/course/'.basename($path), 'sha256' => hash_file('sha256', $path), 'identity_verified' => false];
            }
            $dictionaryWords = [];
            foreach ($index['entries'] as $entry) {
                if (! isset($entry['db_groups'][$id])) {
                    continue;
                }
                foreach ($entry['db'] as $word) {
                    foreach ($word['categories'] as $category) {
                        if ((int) $word['dictionary_id'] === $dictionaryId && in_array((int) $group['category_id'], $category['ancestors'], true)) {
                            if (! isset($dictionaryWords[$word['id']])) {
                                $comparison = $this->categoryAudit->compare($word['word'], 'lv', $index, $index['group_topics'][$id] ?? null);
                                $dictionaryWords[$word['id']] = [
                                    'word_id' => $word['id'], 'word' => $word['word'], 'lemmas' => $comparison['lemmas'],
                                    'first_seen_status' => $comparison['status'], 'method' => $comparison['method'],
                                    'review_required' => $comparison['review_required'], 'first_seen_matches' => $comparison['matches'],
                                    'phrase_not_found_as_unit' => str_contains(trim($word['word']), ' ') && ! $comparison['matches'],
                                ];
                            }
                        }
                    }
                }
            }
            $flagCounts = [];
            foreach ($records as $record) {
                foreach ($record['flags'] as $flag) {
                    $flagCounts[$flag] = ($flagCounts[$flag] ?? 0) + 1;
                }
            }
            $themes[] = [
                'group' => $group, 'dictionary_words' => count($dictionaryWords),
                'dictionary_first_seen_distribution' => array_count_values(array_column($dictionaryWords, 'first_seen_status')),
                'dictionary_records' => array_values($dictionaryWords),
                'pages' => $groupPages->count(), 'blocks' => $groupPages->sum(fn ($page) => $page->blocks->count()),
                'skills_inventory' => $inventory, 'skills_without_lesson_pages' => array_keys(array_filter($inventory, fn ($count) => $count === 0)),
                'elaipa_first_seen_topic' => $index['group_topics'][$id] ?? null,
                'source_candidates' => $candidates, 'flag_counts' => $flagCounts, 'records' => $records,
            ];
        }

        return [
            'schema_version' => 1, 'generated_at' => now('UTC')->toIso8601String(), 'dictionary_id' => $dictionaryId,
            'read_only' => true, 'user_progress_included' => false, 'external_requests' => false,
            'is_pedagogical_verdict' => false, 'elaipa_contract' => ElaipaSourceContract::metadata(),
            'sources' => $index['sources'], 'index_revision' => $index['revision'],
            'flag_guide' => [
                'db_future_candidates' => 'Сверить лемму и фактическую категорию БД; не считать автоматически слишком сложным.',
                'unknown_candidates' => 'Проверить написание, имя, фразу и нормализацию; не добавлять автоматически в словарь.',
                'ambiguous_forms' => 'Определить значение по контексту в задании.',
                'normalization_review' => 'Проверить изолированный морфологический анализ, особенно имена и омонимы.',
                'no_latvian_authored_text' => 'В выбранных полях нет латышского текста; свободный будущий ответ не анализируется.',
                'missing_translation_reference' => 'Нет явного или точно совпавшего авторского эталона; найти сохранённый исходник.',
                'custom_component_not_indexed' => 'React-категория без структурированных текстовых данных требует отдельного адаптера.',
                'unavailable_source' => 'Ссылка грамматического блока не ведёт на допустимый опубликованный источник.',
            ],
            'themes' => $themes,
        ];
    }

    private function metrics(array $report): array
    {
        return ['units' => $report['total'], 'unique_surface_forms' => $report['unique'], 'normalization_review_units' => $report['review'],
            'db_distribution' => array_column($report['summary'], 'db_count', 'key'),
            'elaipa_found_units' => $report['elaipa_found']];
    }

    private function parts(string $type, array $config, string $scope, array $index): array
    {
        if ($type !== 'words') {
            return $this->texts->parts($config, $scope);
        }
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

        return $parts;
    }
}
