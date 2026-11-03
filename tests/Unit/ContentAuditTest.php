<?php

namespace Tests\Unit;

use App\Services\ContentAudit\CourseContentAudit;
use App\Services\ContentAudit\CourseVocabularyIndex;
use App\Services\ContentAudit\LatvianLemmaResolver;
use App\Services\ContentAudit\LessonTextExtractor;
use PHPUnit\Framework\TestCase;

class ContentAuditTest extends TestCase
{
    private function resolver(): LatvianLemmaResolver
    {
        return new LatvianLemmaResolver(['words' => ['nouns' => [
            ['lemma' => 'darbs', 'source_forms' => [['surface' => 'darbā']]],
            ['lemma' => 'roka', 'source_forms' => [['surface' => 'roku']]],
            ['lemma' => 'roks', 'source_forms' => [['surface' => 'roku']]],
        ]]]);
    }

    private function index(): array
    {
        $entries = [];
        foreach (['darbs' => [90, 2], 'māja' => [2], 'vilciens' => [1], 'labdien' => [], 'roka' => [90], 'roks' => [1], 'labs vakars' => [2]] as $word => $groups) {
            $entries[$word] = ['db' => [['word' => $word]], 'db_groups' => array_fill_keys($groups, true), 'elaipa' => [], 'elaipa_groups' => []];
        }
        $entries['upe'] = ['db' => [], 'db_groups' => [], 'elaipa' => [['topic' => 'Daba']], 'elaipa_groups' => [1 => true]];
        $entries['mežs'] = ['db' => [], 'db_groups' => [], 'elaipa' => [['topic' => 'Daba']], 'elaipa_groups' => []];

        return ['entries' => $entries, 'known' => array_fill_keys(array_keys($entries), true), 'groups' => [
            90 => ['id' => 90, 'position' => 0, 'title' => 'Agrāk', 'level' => 'A1'], 2 => ['id' => 2, 'position' => 1, 'title' => 'Tagad', 'level' => 'A1'],
            1 => ['id' => 1, 'position' => 2, 'title' => 'Vēlāk', 'level' => 'A2'],
        ], 'occurrences' => ['darbs' => ['reading' => [90 => true], 'speaking' => [2 => true]], 'māja' => ['listening' => [1 => true]]]];
    }

    private function audit(): CourseContentAudit
    {
        return new CourseContentAudit($this->createMock(CourseVocabularyIndex::class), new LessonTextExtractor, $this->resolver());
    }

    public function test_exact_corpus_heuristic_and_ambiguity_preserve_diacritics(): void
    {
        $resolver = $this->resolver();
        $known = $this->index()['known'];
        $this->assertSame('māja', LatvianLemmaResolver::normalize(' MĀJA '));
        $this->assertSame(['darbs'], $resolver->resolve('Darbā', $known, 'corpus')['lemmas']);
        $this->assertSame([], $resolver->resolve('Darbā', $known, 'exact')['lemmas']);
        $this->assertCount(2, $resolver->resolve('roku', $known, 'corpus')['lemmas']);
        $this->assertSame('heuristic', $resolver->resolve('mājām', $known, 'heuristic')['method']);
        $this->assertSame([], $resolver->resolve('majām', $known, 'heuristic')['lemmas']);
        $this->assertTrue($resolver->resolve('mājām', $known, 'heuristic')['review_required']);
    }

    public function test_extraction_uses_dialogue_once_and_excludes_russian_and_private_prompts(): void
    {
        $extractor = new LessonTextExtractor;
        $config = ['task_kind' => 'listening', 'transcript' => 'Darbā.', 'dialogue_segments' => [['text' => 'Darbā.']],
            'tutor_prompt' => 'Secret', 'questions' => [['statement' => 'Vai māja?', 'accepted_answers' => ['Jā'], 'explanation' => 'Ответ']]];
        $this->assertSame([['label' => 'Реплика 1', 'text' => 'Darbā.']], $extractor->parts($config));
        $this->assertCount(3, $extractor->parts($config, 'all'));
        $translation = ['task_kind' => 'ru_to_lv', 'source_text' => 'У меня дом', 'reference_translation' => 'Man ir māja.'];
        $this->assertSame([], $extractor->parts($translation));
        $this->assertSame('Man ir māja.', $extractor->parts($translation, 'all')[0]['text']);
    }

    public function test_phrases_are_greedy_and_never_cross_punctuation(): void
    {
        $extractor = new LessonTextExtractor;
        $text = 'Labs vakars! labs, vakars.';
        $units = $extractor->units($text, ['labs vakars' => true]);
        $this->assertCount(3, $units);
        $this->assertSame('labs vakars', $units[0]['key']);
        foreach ($units as $unit) {
            $this->assertSame($unit['surface'], substr($text, $unit['offset'], $unit['length']));
        }
    }

    public function test_percentages_are_exclusive_and_future_only_respects_earlier_duplicates(): void
    {
        $report = $this->audit()->analyze([['label' => 'Test', 'text' => 'Darbā māja vilciens labdien upe mežs roku xyz darbā.']], $this->index(), 2);
        $this->assertSame(9, $report['total']);
        $this->assertSame('prior', $report['words']['darbā']['bucket']);
        $this->assertSame('current', $report['words']['māja']['bucket']);
        $this->assertSame('future', $report['words']['vilciens']['bucket']);
        $this->assertSame('corpus', $report['words']['upe']['bucket']);
        $this->assertSame('corpus', $report['words']['upe']['db_bucket']);
        $this->assertSame('unplaced', $report['words']['labdien']['bucket']);
        $this->assertSame('corpus', $report['words']['mežs']['bucket']);
        $this->assertSame('ambiguous', $report['words']['roku']['bucket']);
        $this->assertSame('unknown', $report['words']['xyz']['bucket']);
        $this->assertSame(9, array_sum(array_column($report['summary'], 'count')));
        $this->assertSame(9, array_sum(array_column($report['topic_chart'], 'count')));
        $this->assertSame(['words', 'reading'], $report['words']['darbā']['prior_skills']);
        $this->assertSame([], $report['words']['māja']['prior_skills']);
        $this->assertFalse($report['elaipa_contract']['all_topic_occurrences_available']);
        $this->assertSame('first_seen', $report['elaipa_contract']['topic_basis']);
    }

    public function test_unique_mode_changes_denominator_and_does_not_merge_different_forms(): void
    {
        $parts = [['label' => 'Test', 'text' => 'Darbs darbs darbā māja.']];
        $report = $this->audit()->analyze($parts, $this->index(), 2, 'unique');
        $this->assertSame(3, $report['total']);
        $this->assertSame(2, $report['words']['darbs']['count']);
        $this->assertSame(66.7, $report['summary'][0]['percent']);
    }

    public function test_first_seen_in_corpus_cannot_establish_prerequisites_or_override_db_order(): void
    {
        $index = $this->index();
        $index['entries']['vilciens']['elaipa_groups'] = [90 => true];
        $index['entries']['upe']['elaipa_groups'] = [90 => true];
        $report = $this->audit()->analyze([['label' => 'Test', 'text' => 'vilciens upe']], $index, 2);
        $this->assertSame('future', $report['words']['vilciens']['bucket']);
        $this->assertSame('corpus', $report['words']['upe']['bucket']);
        $this->assertSame('whole_corpus', $report['elaipa_contract']['frequency_scope']);
    }

    public function test_empty_and_contextless_reports_never_invent_a_timeline(): void
    {
        $this->assertSame(0, $this->audit()->analyze([], $this->index(), 2)['total']);
        $report = $this->audit()->analyze([['label' => 'Test', 'text' => 'vilciens']], $this->index(), null);
        $this->assertFalse($report['has_context']);
        $this->assertSame('unplaced', $report['words']['vilciens']['bucket']);
        $this->assertSame(0, array_sum(array_column($report['skill_chart'], 'count')));
    }
}
