<?php

namespace Tests\Unit;

use App\Services\ContentAudit\LatvianLemmaResolver;
use App\Services\ContentAudit\LessonTextExtractor;
use App\Services\ContentAudit\PracticeVariantDiversity;
use PHPUnit\Framework\TestCase;

class PracticeVariantDiversityTest extends TestCase
{
    private function selector(): PracticeVariantDiversity
    {
        $entries = [];
        foreach (['māja' => ['māja', 'mājā'], 'dārzs' => ['dārzs', 'dārzā'], 'upe' => ['upe'], 'laiva' => ['laiva'],
            'ārsts' => ['ārsts', 'ārstam'], 'slimnīca' => ['slimnīca', 'slimnīcā']] as $lemma => $forms) {
            $entries[] = ['lemma' => $lemma, 'source_forms' => array_map(fn ($surface) => ['surface' => $surface], $forms)];
        }
        return new PracticeVariantDiversity(new LatvianLemmaResolver(['words' => ['A1' => $entries]]), new LessonTextExtractor);
    }

    public function test_inflections_repeated_words_names_and_audio_metadata_do_not_fake_diversity(): void
    {
        $selector = $this->selector();
        $a = $selector->vocabulary(['text' => 'Māja dārzs Anna. māja māja', 'audio_url' => '/random-words.mp3']);
        $b = $selector->vocabulary(['text' => 'Mājā dārzā Pēteris.', 'speaker_profiles' => ['character' => 'strange unique words']]);
        $this->assertSame(['dārzs', 'māja'], $a['words']);
        $this->assertSame($a['words'], $b['words']);
    }

    public function test_all_triples_are_compared_and_stable_ties_keep_original_order(): void
    {
        $variants = [];
        foreach (['Māja dārzs.', 'Mājā dārzā.', 'Upe laiva.', 'Ārsts slimnīca.', 'Ārstam slimnīcā.'] as $i => $text) {
            $variants[] = ['id' => $i + 1, 'position' => $i, 'config' => ['text' => $text]];
        }
        $result = $this->selector()->choose(array_reverse($variants));
        $this->assertSame([1, 3, 4], $result['selected_ids']);
        $this->assertSame([2, 5], $result['archive_ids']);
        $this->assertEquals(1, $result['mean_distance']);
    }

    public function test_short_tasks_are_not_dropped_and_missing_latvian_is_explicit(): void
    {
        $selector = $this->selector();
        $result = $selector->choose([['id' => 8, 'position' => 0, 'config' => ['task_kind' => 'roleplay', 'instruction' => 'Узнай дорогу до больницы.']]]);
        $this->assertSame([8], $result['selected_ids']);
        $this->assertSame([], $result['archive_ids']);
        $this->assertSame('instruction_fallback', $result['vocabulary'][8]['basis']);
        $this->assertNotEmpty($result['vocabulary'][8]['words']);
    }

    public function test_productive_tasks_use_authored_latvian_not_russian_reference_or_answers(): void
    {
        $words = $this->selector()->vocabulary(['task_kind' => 'ru_to_lv', 'instruction' => 'Переведи предложение.',
            'tutor_prompt' => 'Образец: Māja dārzs upe laiva. Не показывать заранее.', 'answer_text' => 'ārsts slimnīca']);
        $this->assertSame(['dārzs', 'laiva', 'māja', 'upe'], $words['words']);
        $this->assertSame('latvian_lemmas', $words['basis']);
    }

    public function test_missing_vocabulary_does_not_earn_maximum_diversity(): void
    {
        $variants = [];
        foreach (['', 'māja dārzs', 'māja upe', 'māja laiva'] as $i => $text) {
            $variants[] = ['id' => $i + 1, 'position' => $i, 'config' => ['text' => $text]];
        }
        $this->assertSame([2, 3, 4], $this->selector()->choose($variants)['selected_ids']);
    }

    public function test_grammar_order_and_gap_use_authored_tokens_and_answers_not_explanations(): void
    {
        $words = $this->selector()->vocabulary(['task_kind' => 'grammar_order', 'questions' => [[
            'prompt' => 'Собери предложение.', 'tokens' => ['Mājā', 'dārzā'],
            'accepted_answers' => ['Mājā dārzā'], 'explanation' => 'ārsts slimnīca',
        ]], 'answer_text' => 'upe laiva']);
        $this->assertSame(['dārzs', 'māja'], $words['words']);
        $gap = $this->selector()->vocabulary(['task_kind' => 'grammar_gap', 'questions' => [[
            'prompt' => 'Ieraksti {{blank}}.', 'accepted_answers' => ['slimnīcā'],
        ]]]);
        $this->assertContains('slimnīca', $gap['words']);
    }
}
