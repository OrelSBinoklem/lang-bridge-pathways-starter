<?php

namespace Tests\Unit;

use App\Services\TaskGeneration\ListeningDraft;
use App\Services\TaskGeneration\VocabularyUnion;
use PHPUnit\Framework\TestCase;
use RuntimeException;

class TaskGenerationTest extends TestCase
{
    public function test_union_preserves_sources_senses_and_personal_evidence(): void
    {
        $word = ['id' => 1, 'word' => 'Māja', 'translation_1' => 'дом'];
        $otherSense = ['id' => 2, 'word' => 'māja', 'translation_1' => 'другой смысл'];
        $union = (new VocabularyUnion)->build(
            ['prior_words' => [$word], 'current_words' => [$otherSense]],
            ['learned_words' => [$word], 'words_with_score' => [$word]],
            ['words' => ['nouns' => [['māja', 25], ['māju', 4], ['maja', 1]]]],
        );
        $this->assertCount(3, $union);
        $this->assertSame(['previous_course', 'current_category', 'personal_progress', 'elaipa_topic'], $union[0]['sources']);
        $this->assertSame(['learned', 'not_demonstrated'], array_column($union[0]['db_entries'], 'knowledge'));
        $this->assertSame([], $union[1]['db_entries']);
        $this->assertTrue($union[1]['elaipa_candidates'][0]['requires_review']);
        $shared = (new VocabularyUnion)->build(['prior_words' => [], 'current_words' => [$word]], null, null);
        $this->assertSame('not_assessed', $shared[0]['db_entries'][0]['knowledge']);
    }

    public function test_town_package_has_five_balanced_valid_dialogues(): void
    {
        $draft = $this->draft();
        $validator = new ListeningDraft;
        $validator->validate($draft, range(73148, 73173));
        foreach ($draft['variants'] as $variant) {
            $config = $validator->config($variant);
            $this->assertCount(10, $config['questions']);
            $this->assertCount(10, $config['dialogue_segments']);
            $this->assertStringStartsWith('A: ', $config['transcript']);
        }
    }

    public function test_validator_rejects_foreign_vocabulary_ids(): void
    {
        $this->expectException(RuntimeException::class);
        (new ListeningDraft)->validate($this->draft(), [1]);
    }

    public function test_validator_rejects_unbalanced_questions(): void
    {
        $draft = $this->draft();
        $draft['variants'][0]['questions'][0][1] = false;
        $this->expectException(RuntimeException::class);
        (new ListeningDraft)->validate($draft, range(73148, 73173));
    }

    public function test_casting_metadata_is_preserved_without_polluting_transcript(): void
    {
        $draft = $this->draft();
        $draft['variants'][0]['speakers']['a']['age_group'] = 'older_adult';
        $draft['variants'][0]['speakers']['a']['delivery'] = 'Спокойный уверенный голос, без спешки.';
        $validator = new ListeningDraft;
        $validator->validate($draft, range(73148, 73173));
        $config = $validator->config($draft['variants'][0]);
        $this->assertSame($draft['variants'][0]['speakers'], $config['speaker_profiles']);
        $this->assertStringNotContainsString('Спокойный', $config['transcript']);
        $draft['variants'][0]['speakers']['a']['age_group'] = 'unknown';
        $this->expectException(RuntimeException::class);
        $validator->validate($draft, range(73148, 73173));
    }

    public function test_short_listening_question_sets_are_not_forced_to_ten(): void
    {
        foreach ([3, 5] as $count) {
            $draft = $this->draft();
            foreach ($draft['variants'] as &$variant) {
                $variant['questions'] = array_map(fn ($i) => ['Statement '.$i, $i % 2 === 0, 'Evidence'], range(0, $count - 1));
            }
            unset($variant);
            $validator = new ListeningDraft;
            $validator->validate($draft, range(73148, 73173));
            $this->assertCount($count, $validator->config($draft['variants'][0])['questions']);
        }
    }

    private function draft(): array
    {
        return json_decode(file_get_contents(__DIR__.'/../../resources/course/listening-1765-a1.json'), true, 512, JSON_THROW_ON_ERROR);
    }
}
