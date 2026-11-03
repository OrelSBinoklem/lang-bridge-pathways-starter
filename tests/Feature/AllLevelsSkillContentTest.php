<?php

namespace Tests\Feature;

use App\Services\TaskGeneration\CourseSkillDraft;
use App\Services\TaskGeneration\ListeningDraft;
use Tests\TestCase;

class AllLevelsSkillContentTest extends TestCase
{
    public function test_all_a2_b1_b2_themes_have_five_authored_variants_and_shared_vocabulary_audits(): void
    {
        $manifest = $this->read('task-packages-a2-b2.json');
        $this->assertCount(26, $manifest['packages']);
        $ids = array_column($manifest['packages'], 'category_id');
        sort($ids);
        $this->assertSame(range(1775, 1800), $ids);
        $sources = [];
        foreach ($manifest['packages'] as $package) {
            foreach (['skills', 'listening', 'vocabulary'] as $kind) {
                $this->assertSame(hash_file('sha256', base_path($package[$kind]['path'])), $package[$kind]['sha256']);
            }
            $skills = $this->read(basename($package['skills']['path']));
            $listening = $this->read(basename($package['listening']['path']));
            $audit = $this->read(basename($package['vocabulary']['path']));
            $sources[$audit['source']['path']] ??= json_decode(file_get_contents(base_path($audit['source']['path'])), true, 512, JSON_THROW_ON_ERROR);
            $source = collect($sources[$audit['source']['path']]['groups'])->firstWhere('category_id', $package['category_id']);
            $this->assertSame(hash_file('sha256', base_path($audit['source']['path'])), $audit['source']['sha256']);
            $this->assertSame(hash_file('sha256', base_path($audit['grammar_reference']['path'])), $audit['grammar_reference']['sha256']);
            $this->assertSame('shared_course', $audit['mode']);
            $this->assertSame('assumed_passive_curriculum_not_assessed', $audit['knowledge']);
            $this->assertArrayNotHasKey('user_id', $audit);
            $this->assertNotEmpty($audit['prior_word_ids']);
            $this->assertNotEmpty($audit['grammar_reference']['focus']);
            $this->assertNotEmpty(array_filter($audit['passive_vocabulary']['words'], fn ($w) => $w['elaipa'] && $w['db_ids'] === []));
            $this->assertSame(['level' => $package['level'], 'topic' => $skills['elaipa_topic']], end($audit['passive_vocabulary']['source_topics']));
            (new CourseSkillDraft)->validate($skills, $audit['current_word_ids']);
            (new ListeningDraft)->validate($listening, $audit['current_word_ids']);
            $pages = (new CourseSkillDraft)->pages($skills);
            $this->assertSame([2, 3, 2], array_map(fn ($page) => count($page['blocks']), array_values($pages)));
            foreach ($pages as $skill => $page) {
                foreach ($page['blocks'] as $block) {
                    $this->assertCount(5, $block['variants']);
                    if ($skill !== 'reading') {
                        $this->assertStringContainsString('уровня '.$package['level'], $block['bot_prompt']);
                        $this->assertStringNotContainsString('заданием A1', $block['bot_prompt']);
                    }
                }
            }
            $this->assertCount(5, array_unique(array_column(array_column($skills['variants'], 'reading'), 'text')));
            foreach ($listening['variants'] as $index => $variant) {
                $this->assertArrayNotHasKey('audio_url', $variant);
                $this->assertNotSame($skills['variants'][$index]['reading']['questions'], $variant['questions']);
                $this->assertSame($source['variants'][$index]['listening']['segments'], $variant['segments']);
                $this->assertSame($source['variants'][$index]['reading'], $skills['variants'][$index]['reading']);
                $this->assertSame($source['variants'][$index]['writing_translation'], $skills['variants'][$index]['writing_translation']);
                $this->assertSame($source['variants'][$index]['grammar_features'], $audit['variants'][$index]['grammar_features']);
                $this->assertLessThan($audit['variants'][$index]['reading']['word_count'], $audit['variants'][$index]['writing']['word_count']);
                $config = (new ListeningDraft)->config($variant);
                foreach ($variant['speakers'] as $profile) {
                    $this->assertContains($profile['age_group'], ['young_adult', 'adult', 'older_adult']);
                    $this->assertNotEmpty($profile['delivery']);
                    $this->assertStringNotContainsString($profile['delivery'], $config['transcript']);
                }
                $this->assertSame($variant['speakers'], $config['speaker_profiles']);
            }
        }
    }

    private function read(string $name): array
    {
        return json_decode(file_get_contents(resource_path('course/'.$name)), true, 512, JSON_THROW_ON_ERROR);
    }
}
