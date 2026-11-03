<?php

namespace App\Services\ContentAudit;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class CourseVocabularyIndex
{
    public function __construct(private LatvianLemmaResolver $resolver, private LessonTextExtractor $texts) {}

    public function build(?int $dictionaryId): array
    {
        $groups = DB::table('course_groups')->where('learn_lang', 'lv')->where('is_published', true)
            ->when($dictionaryId, fn ($q) => $q->where('dictionary_id', $dictionaryId))->get()->all();
        usort($groups, fn ($a, $b) => [array_search($a->level, ['A1', 'A2', 'B1', 'B2']), $a->position, $a->id] <=> [array_search($b->level, ['A1', 'A2', 'B1', 'B2']), $b->position, $b->id]);
        $categories = DB::table('dictionary_categories')->get(['id', 'dictionary_id', 'parent_id', 'name'])->keyBy('id')->all();
        $dictionaries = DB::table('dictionaries')->get(['id', 'name'])->keyBy('id')->all();
        $words = DB::table('dictionary_words')->whereRaw('LOWER(learn_lang) = ?', ['lv'])->get(['id', 'dictionary_id', 'word', 'learn_lang', 'is_phrase'])->all();
        $links = DB::table('dictionary_word_category')->get(['word_id', 'category_id'])->all();
        $corpusPath = resource_path('external-sources/e-laipa/derived/e-laipa-a1-b2-all-words.json');
        if (! is_file($corpusPath)) {
            throw new RuntimeException('Отсутствуют темы JSON E-Laipa.');
        }
        $aliasPath = resource_path('course/elaipa-topic-aliases.json');
        $aliases = json_decode(file_get_contents($aliasPath), true, 512, JSON_THROW_ON_ERROR)['aliases'];
        $versions = [DB::table('lesson_pages')->get(['id', 'updated_at', 'course_group_id', 'skill', 'status', 'is_published'])->all(),
            DB::table('lesson_blocks')->get(['id', 'updated_at', 'lesson_page_id', 'source_block_id', 'type', 'config'])->all(),
            DB::table('lesson_block_variants')->get(['id', 'updated_at', 'lesson_block_id', 'is_published', 'config'])->all()];
        $metadata = ['lemma' => $this->resolver->sourceMetadata(), 'topics' => ['path' => 'resources/external-sources/e-laipa/derived/e-laipa-a1-b2-all-words.json', 'sha256' => hash_file('sha256', $corpusPath)],
            'aliases' => ['path' => 'resources/course/elaipa-topic-aliases.json', 'sha256' => hash_file('sha256', $aliasPath)]];
        $revision = hash('sha256', json_encode([$groups, $categories, $dictionaries, $words, $links, $versions, $metadata], JSON_THROW_ON_ERROR));

        return Cache::store('file')->remember('content-audit:index-v7:'.$revision, 3600, function () use ($groups, $categories, $dictionaries, $words, $links, $corpusPath, $aliases, $revision, $metadata): array {
            $groupByCategory = [];
            $groupIndex = [];
            foreach ($groups as $position => $group) {
                $groupIndex[$group->id] = ['id' => $group->id, 'position' => $position, 'level' => $group->level, 'category_id' => $group->category_id, 'title' => $categories[$group->category_id]->name ?? $group->title];
                if ($group->category_id) {
                    $groupByCategory[$group->category_id] = $group->id;
                }
            }
            $paths = [];
            $categoryGroups = [];
            foreach ($categories as $id => $category) {
                $path = [];
                $seen = [];
                $cursor = $id;
                while ($cursor && isset($categories[$cursor]) && ! isset($seen[$cursor])) {
                    $seen[$cursor] = true;
                    $ancestor = $categories[$cursor];
                    array_unshift($path, $ancestor->name);
                    if (isset($groupByCategory[$cursor])) {
                        $categoryGroups[$id][] = $groupByCategory[$cursor];
                    }
                    $cursor = $ancestor->parent_id;
                }
                $paths[$id] = ['id' => $id, 'ancestors' => array_keys($seen), 'dictionary_id' => $category->dictionary_id, 'dictionary' => $dictionaries[$category->dictionary_id]->name ?? 'Словарь', 'path' => implode(' / ', $path)];
            }
            $wordCategories = [];
            foreach ($links as $link) {
                if (isset($paths[$link->category_id])) {
                    $wordCategories[$link->word_id][$link->category_id] = $paths[$link->category_id];
                }
            }
            $entries = [];
            foreach ($words as $word) {
                $key = LatvianLemmaResolver::normalize($word->word);
                $entries[$key] ??= ['db' => [], 'db_groups' => [], 'elaipa' => [], 'elaipa_groups' => []];
                $entries[$key]['db'][] = ['id' => $word->id, 'word' => $word->word, 'dictionary_id' => $word->dictionary_id, 'dictionary' => $dictionaries[$word->dictionary_id]->name ?? 'Словарь', 'categories' => array_values($wordCategories[$word->id] ?? [])];
                foreach (array_keys($wordCategories[$word->id] ?? []) as $categoryId) {
                    foreach ($categoryGroups[$categoryId] ?? [] as $groupId) {
                        $entries[$key]['db_groups'][$groupId] = true;
                    }
                }
            }
            $topics = json_decode(file_get_contents($corpusPath), true, 512, JSON_THROW_ON_ERROR);
            $mappedTopics = [];
            $groupTopics = [];
            $corpusTopics = [];
            $topicKeys = [];
            $headings = [];
            $headingKey = fn ($value) => LatvianLemmaResolver::normalize(preg_replace('/[!…]+$/u', '', preg_replace('/^\d+\.\s*/u', '', trim($value))));
            foreach (['A1', 'A2', 'B1', 'B2'] as $level) {
                foreach (array_keys($topics[$level] ?? []) as $topic) {
                    $topicKeys[$level][$headingKey($topic)] = $topic;
                    $key = $level.':'.$topic;
                    $corpusTopics[$key] = ['id' => $key, 'level' => $level, 'topic' => $topic, 'position' => count($corpusTopics)];
                }
            }
            foreach ($entries as $word => $entry) {
                foreach (array_keys($entry['db_groups']) as $groupId) {
                    $headings[$groupId][$headingKey($word)] = true;
                }
            }
            $unmappedGroups = [];
            foreach ($groups as $group) {
                $candidates = [];
                foreach ($topicKeys[$group->level] ?? [] as $key => $topic) {
                    if (isset($headings[$group->id][$key])) {
                        $candidates[$topic] = true;
                    }
                }
                $reviewed = [];
                foreach ($aliases as $alias) {
                    if ($alias['level'] === $group->level
                        && $headingKey($alias['category_name']) === $headingKey($groupIndex[$group->id]['title'])
                        && isset($topics[$group->level][$alias['elaipa_topic']])) {
                        $reviewed[$alias['elaipa_topic']] = true;
                    }
                }
                // Explicit reviewed mappings take precedence over ordinary words resembling another topic heading.
                if ($reviewed) {
                    $candidates = $reviewed;
                }
                if (count($candidates) === 1) {
                    $topic = array_key_first($candidates);
                    $mappedTopics[$group->level.':'.$topic][] = $group->id;
                    $groupTopics[$group->id] = $group->level.':'.$topic;
                } else {
                    $unmappedGroups[] = $groupIndex[$group->id]['title'];
                }
            }
            foreach ($topics as $level => $levelTopics) {
                foreach ($levelTopics as $topic => $parts) {
                    foreach ($parts as $part => $items) {
                        foreach ($items as [$lemma,$frequency]) {
                            $key = LatvianLemmaResolver::normalize($lemma);
                            $entries[$key] ??= ['db' => [], 'db_groups' => [], 'elaipa' => [], 'elaipa_groups' => []];
                            $entries[$key]['elaipa'][] = ['level' => $level, 'topic' => $topic, 'part_of_speech' => $part, 'frequency' => $frequency];
                            foreach ($mappedTopics[$level.':'.$topic] ?? [] as $groupId) {
                                $entries[$key]['elaipa_groups'][$groupId] = true;
                            }
                        }
                    }
                }
            }
            $known = array_fill_keys(array_keys($entries), true);
            foreach ($this->resolver->index()['lemmas'] as $key => $value) {
                $known[$key] = true;
            }
            $occurrences = [];
            $placed = DB::table('lesson_blocks as b')->join('lesson_pages as p', 'p.id', '=', 'b.lesson_page_id')
                ->whereIn('p.course_group_id', array_keys($groupIndex))->where('p.status', 'published')->where('p.is_published', true)->where('p.learn_lang', 'lv')
                ->get(['b.id', 'b.source_block_id', 'b.config', 'b.type', 'p.course_group_id']);
            $sourceIds = $placed->map(fn ($block) => $block->source_block_id ?: $block->id)->unique()->all();
            $sources = DB::table('lesson_blocks as b')->join('lesson_pages as p', 'p.id', '=', 'b.lesson_page_id')
                ->whereIn('b.id', $sourceIds)->where('p.is_published', true)->where('p.status', 'published')->where('p.learn_lang', 'lv')
                ->get(['b.id', 'b.type', 'b.source_block_id', 'b.config', 'p.skill'])->keyBy('id');
            $variantConfigs = DB::table('lesson_block_variants')->whereIn('lesson_block_id', $sourceIds)->where('is_published', true)->get(['lesson_block_id', 'config'])->groupBy('lesson_block_id');
            foreach ($placed as $block) {
                $sourceId = $block->source_block_id ?: $block->id;
                $source = $sources[$sourceId] ?? null;
                if (! $source || ($block->source_block_id && ($block->type !== 'grammar' || $source->type !== 'grammar' || $source->skill !== 'grammar' || $source->source_block_id))) {
                    continue;
                }
                $configs = $variantConfigs->get($sourceId, collect())->pluck('config')->all() ?: [$source->config];
                foreach ($configs as $json) {
                    foreach ($this->texts->parts(json_decode($json ?: '{}', true, 512, JSON_THROW_ON_ERROR)) as $part) {
                        foreach ($this->texts->units($part['text'], $known) as $token) {
                            $match = $this->resolver->resolve($token['key'], $known, 'corpus');
                            if (count($match['lemmas']) !== 1) {
                                continue;
                            }
                            $occurrences[$match['lemmas'][0]][$block->type][$block->course_group_id] = true;
                        }
                    }
                }
            }

            return ['revision' => $revision, 'groups' => $groupIndex, 'entries' => $entries, 'known' => $known, 'occurrences' => $occurrences, 'sources' => $metadata, 'mapped_topics' => count($mappedTopics), 'unmapped_groups' => $unmappedGroups, 'group_topics' => $groupTopics, 'corpus_topics' => $corpusTopics];
        });
    }
}
