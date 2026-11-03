<?php

namespace Tests\Unit;

use App\Services\ContentAudit\CategoryLearningBalance;
use App\Services\ContentAudit\ElaipaTopicOccurrences;
use App\Services\ContentAudit\LatvianLemmaResolver;
use App\Services\ContentAudit\LessonTextExtractor;
use PHPUnit\Framework\TestCase;

class CategoryLearningBalanceTest extends TestCase
{
    private function balance(): CategoryLearningBalance
    {
        $resolver = new LatvianLemmaResolver(['words' => ['nouns' => [
            ['lemma' => 'darbs', 'source_forms' => [['surface' => 'darbā']]],
            ['lemma' => 'vieta', 'source_forms' => [['surface' => 'vietā'], ['surface' => 'vienādi']]],
            ['lemma' => 'vienāds', 'source_forms' => [['surface' => 'vienādi']]],
            ['lemma' => 'būt', 'source_forms' => [['surface' => 'esmu']]],
        ]]]);

        return new CategoryLearningBalance($resolver, new LessonTextExtractor, new ElaipaTopicOccurrences([]));
    }

    private function inventory(): array
    {
        $groups = [1 => ['id' => 1, 'category_id' => 101, 'position' => 0],
            2 => ['id' => 2, 'category_id' => 102, 'position' => 1], 3 => ['id' => 3, 'category_id' => 103, 'position' => 2]];
        $entries = [];
        foreach ([[1, 'Darbs darbā.', 101, 20], [2, 'rīt', 102, 20], [3, 'vieta', 103, 20], [4, 'koks', 999, 20], [5, 'svešs', 101, 99]] as [$id, $word, $category, $dictionary]) {
            $entries[$word]['db'][] = ['id' => $id, 'word' => $word, 'dictionary_id' => $dictionary,
                'categories' => [['id' => $category, 'ancestors' => [$category], 'path' => "Category $category"]]];
        }

        return $this->balance()->inventory(['groups' => $groups, 'entries' => $entries], 20, [102 => true], $groups[2]);
    }

    public function test_prior_phrase_words_and_inflections_count_but_future_and_other_dictionary_do_not(): void
    {
        $balance = $this->balance();
        $inventory = $this->inventory();
        foreach (['darbs', 'darbā'] as $word) {
            $this->assertSame('previous', $balance->dictionaryMatch($word, $inventory)['status']);
        }
        $this->assertSame('current', $balance->dictionaryMatch('rīt', $inventory)['status']);
        $this->assertSame('future', $balance->dictionaryMatch('vietā', $inventory)['status']);
        $this->assertSame('elsewhere', $balance->dictionaryMatch('koks', $inventory)['status']);
        $this->assertSame('missing', $balance->dictionaryMatch('svešs', $inventory)['status']);
        $this->assertSame('ambiguous', $balance->dictionaryMatch('vienādi', $inventory)['status']);
    }

    public function test_cumulative_elaipa_adds_real_earlier_vocabulary_without_marking_future_as_known(): void
    {
        $balance = $this->balance();
        $corpus = $balance->corpusInventory([
            ['position' => 0, 'words' => ['esmu' => 2]], ['position' => 1, 'words' => ['rīt' => 1]],
            ['position' => 2, 'words' => ['vieta' => 2]],
        ], 1);
        $metric = $balance->measure('Darbā esmu vietā xx vienādi', $this->inventory(), $corpus);
        $this->assertSame(5, $metric['total']);
        $this->assertSame(['dictionary' => 1, 'elaipa_extra' => 1, 'future' => 1, 'unmatched' => 1, 'ambiguous' => 1], $metric['buckets']);
        $this->assertSame(20.0, $metric['dictionary_percent']);
        $this->assertSame(2, $metric['whole_dictionary_count']);
        $this->assertSame(40.0, $metric['whole_dictionary_percent']);
        $this->assertSame(40.0, $metric['combined_percent']);
        $this->assertTrue(isset($corpus['known']['būt']));
        $words = array_column($metric['words'], null, 'word');
        $this->assertTrue($words['esmu']['elaipa_present']);
        $this->assertTrue($words['vietā']['elaipa_present']);
        $this->assertFalse($words['xx']['elaipa_present']);
    }

    public function test_empty_or_unmapped_context_has_null_percentages_not_fake_zero(): void
    {
        $balance = $this->balance();
        $corpus = $balance->corpusInventory([], null);
        $this->assertNull($balance->measure('Напиши ответ.', $this->inventory(), $corpus)['dictionary_percent']);
        $this->assertNull($balance->measure('Напиши ответ.', $this->inventory(), $corpus)['whole_dictionary_percent']);
        $metric = $balance->measure('darbs', $this->inventory(), $corpus);
        $this->assertSame(100.0, $metric['dictionary_percent']);
        $this->assertNull($metric['combined_percent']);
    }

    public function test_whole_dictionary_includes_future_and_unplaced_words_but_not_other_dictionaries(): void
    {
        $metric = $this->balance()->measure('vietā koks svešs', $this->inventory(), $this->balance()->corpusInventory([], null));
        $this->assertSame(0.0, $metric['dictionary_percent']);
        $this->assertSame(66.7, $metric['whole_dictionary_percent']);
        $this->assertSame(2, $metric['whole_dictionary_count']);
    }

    public function test_intersection_with_any_elaipa_topic_does_not_require_a_selected_topic(): void
    {
        $balance = $this->balance();
        $corpus = $balance->corpusInventory([['position' => 2, 'words' => ['vieta' => 2]]], null);
        $metric = $balance->measure('vietā', $this->inventory(), $corpus);
        $this->assertTrue($metric['words'][0]['elaipa_present']);
        $this->assertNull($metric['combined_percent']);
        $this->assertSame([], $corpus['known']);
        $this->assertSame([], $corpus['future']);
    }

    public function test_html_extraction_omits_titles_scripts_and_audio_and_preserves_table_boundaries(): void
    {
        $words = ElaipaTopicOccurrences::extract('<div class="exe-title">Read English</div><script>secretWord()</script><style>styleWord</style><audio>audioWord</audio><table><tr><td>Es</td><td>es~mu</td></tr></table><p>Tu esi. Русский.</p>');
        $this->assertSame(['es' => 1, 'esi' => 1, 'esmu' => 1, 'tu' => 1], $words);
    }

    public function test_learner_questions_and_mixed_instructions_do_not_include_answer_keys_or_private_tutor_instructions(): void
    {
        $balance = $this->balance();
        $text = $balance->learnerText(['instruction' => 'A1. Ответь на вопрос: Kur tu strādā?',
            'lesson_text' => 'UNUSED-FALLBACK', 'questions' => [['prompt' => 'Vai darbs?', 'accepted_answers' => ['ANSWER-KEY'], 'explanation' => 'SECRET-EXPLANATION']],
            'reference_translation' => 'REFERENCE-ONLY', 'tutor_prompt' => 'PRIVATE-ONLY'], true);
        $this->assertStringContainsString('Kur tu strādā?', $text);
        $this->assertStringContainsString('Vai darbs?', $text);
        foreach (['UNUSED-FALLBACK', 'ANSWER-KEY', 'SECRET-EXPLANATION', 'REFERENCE-ONLY', 'PRIVATE-ONLY'] as $hidden) {
            $this->assertStringNotContainsString($hidden, $text);
        }
        $metric = $balance->measure($text, $this->inventory(), $balance->corpusInventory([], null));
        $this->assertSame(5, $metric['total']);
        $this->assertNotContains('a', array_column($metric['words'], 'word'));
        $this->assertSame('Darbs?', $balance->learnerText(['lesson_text' => 'Darbs?'], true));
    }
}
