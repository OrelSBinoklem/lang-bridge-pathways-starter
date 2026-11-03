<?php

namespace Tests\Unit;

use App\Services\ContentAudit\CategoryVocabularyAudit;
use App\Services\ContentAudit\CourseVocabularyIndex;
use App\Services\ContentAudit\LatvianLemmaResolver;
use App\Services\ContentAudit\LessonTextExtractor;
use PHPUnit\Framework\TestCase;

class CategoryVocabularyAuditTest extends TestCase
{
    private function audit(): CategoryVocabularyAudit
    {
        $resolver = new LatvianLemmaResolver(['words' => ['nouns' => [
            ['lemma' => 'darbs', 'source_forms' => [['surface' => 'darbā'], ['surface' => 'vienādi']]],
            ['lemma' => 'vieta', 'source_forms' => [['surface' => 'vienādi']]],
            ['lemma' => 'vientuļš', 'source_forms' => []],
        ]]]);

        return new CategoryVocabularyAudit(new CourseVocabularyIndex($resolver, new LessonTextExtractor), $resolver);
    }

    private function index(array $hits): array
    {
        $topics = [
            'A1:Past' => ['position' => 0],
            'A2:Now' => ['position' => 1],
            'B1:Later' => ['position' => 2],
        ];
        $entries = [];
        foreach ($hits as $lemma => $ids) {
            $entries[$lemma] = ['elaipa' => array_map(function ($id) {
                [$level, $topic] = explode(':', $id);

                return ['level' => $level, 'topic' => $topic, 'frequency' => 4, 'part_of_speech' => 'nouns'];
            }, $ids)];
        }

        return ['entries' => $entries, 'corpus_topics' => $topics];
    }

    public function test_current_takes_priority_but_preserves_previous_and_future_occurrences(): void
    {
        $result = $this->audit()->compare('Darbā', 'lv', $this->index(['darbs' => ['B1:Later', 'A2:Now', 'A1:Past']]), 'A2:Now');
        $this->assertSame('current', $result['status']);
        $this->assertSame(['previous', 'current', 'future'], array_column($result['matches'], 'relative'));
        $this->assertSame('corpus_form', $result['method']);
        $this->assertTrue($result['review_required']);
    }

    public function test_previous_takes_priority_and_future_only_has_no_previous_match(): void
    {
        $audit = $this->audit();
        $this->assertSame('previous', $audit->compare('darbs', 'lv', $this->index(['darbs' => ['A1:Past', 'B1:Later']]), 'A2:Now')['status']);
        $this->assertSame('future', $audit->compare('darbs', 'lv', $this->index(['darbs' => ['B1:Later']]), 'A2:Now')['status']);
    }

    public function test_no_context_cannot_invent_topic_order(): void
    {
        $result = $this->audit()->compare('darbs', 'lv', $this->index(['darbs' => ['B1:Later']]), null);
        $this->assertSame('elsewhere', $result['status']);
        $this->assertSame('elsewhere', $result['matches'][0]['relative']);
    }

    public function test_distinguishes_absent_word_unplaced_lemma_and_ambiguous_form(): void
    {
        $audit = $this->audit();
        $index = $this->index(['darbs' => ['A1:Past'], 'vieta' => ['B1:Later']]);
        $this->assertSame('missing', $audit->compare('nezināmsxyz', 'lv', $index, 'A2:Now')['status']);
        $this->assertSame('unplaced', $audit->compare('vientuļš', 'lv', $index, 'A2:Now')['status']);
        $result = $audit->compare('vienādi', 'lv', $index, 'A2:Now');
        $this->assertSame('ambiguous', $result['status']);
        $this->assertCount(2, $result['lemmas']);
    }

    public function test_exact_mode_does_not_accept_inflections_and_phrase_is_not_split(): void
    {
        $audit = $this->audit();
        $index = $this->index(['darbs' => ['A1:Past']]);
        $this->assertSame('missing', $audit->compare('darbā', 'lv', $index, 'A2:Now', 'exact')['status']);
        $this->assertSame('missing', $audit->compare('darbs vieta', 'lv', $index, 'A2:Now')['status']);
        $this->assertSame('unsupported', $audit->compare('darbs', 'en', $index, 'A2:Now')['status']);
    }
}
