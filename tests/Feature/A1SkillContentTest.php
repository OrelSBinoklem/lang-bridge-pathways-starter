<?php

namespace Tests\Feature;

use App\Services\TaskGeneration\CourseSkillDraft;
use App\Services\TaskGeneration\ListeningDraft;
use Tests\TestCase;

class A1SkillContentTest extends TestCase
{
    public function test_all_remaining_a1_topics_have_complete_authored_packages_without_audio(): void
    {
        $source = $this->read('a1-skill-content.json');
        $details = $this->read('a1-skill-details.json');
        $this->assertSame(range(1766, 1774), array_column($source['groups'], 'category_id'));
        foreach ($source['groups'] as $group) {
            $id = $group['category_id'];
            $audit = $this->read("vocabulary-{$id}-a1.json");
            $skills = $this->read("skills-{$id}-a1.json");
            $listening = $this->read("listening-{$id}-a1.json");
            (new CourseSkillDraft)->validate($skills, $audit['current_word_ids']);
            (new ListeningDraft)->validate($listening, $audit['current_word_ids']);
            $this->assertSame('shared_course', $audit['mode']);
            $this->assertSame('not_assessed', $audit['knowledge']);
            $this->assertArrayNotHasKey('user_id', $audit);
            $this->assertNotEmpty($audit['prior_word_ids']);
            $this->assertNotEmpty($audit['elaipa_topic_reference']['candidates']);
            $this->assertSame(hash_file('sha256', resource_path('course/a1-skill-content.json')), $audit['source_sha256']);
            $this->assertSame(hash_file('sha256', resource_path('course/a1-skill-details.json')), $audit['details_sha256']);
            $this->assertCount(5, array_unique(array_column(array_column($skills['variants'], 'reading'), 'text')));
            $pages = (new CourseSkillDraft)->pages($skills);
            $this->assertSame('Письмо: задания по теме', $pages['writing']['title']);
            $this->assertSame('Говорение: диалог по теме', $pages['speaking']['title']);
            $this->assertCount(2, $pages['reading']['blocks']);
            $this->assertCount(3, $pages['writing']['blocks']);
            $this->assertCount(2, $pages['speaking']['blocks']);
            foreach ($pages as $page) {
                foreach ($page['blocks'] as $block) $this->assertCount(5, $block['variants']);
            }
            foreach ($listening['variants'] as $index => $variant) {
                $facts = [...$group['variants'][$index]['facts'], ...$details[$id][$index]];
                $this->assertCount(10, $facts);
                $this->assertCount(10, $variant['questions']);
                foreach ($facts as $offset => $fact) {
                    $question = $variant['questions'][$offset];
                    $this->assertSame($fact[$question[1] ? 0 : 1], $question[0]);
                    $this->assertStringContainsString($fact[0], $skills['variants'][$index]['reading']['text']);
                    if ($offset >= 5) $this->assertStringContainsString($fact[0], implode(' ', array_column($variant['segments'], 1)));
                }
                $this->assertSame($skills['variants'][$index]['reading']['questions'], $variant['questions']);
                $this->assertArrayNotHasKey('audio_url', $variant);
                $config = (new ListeningDraft)->config($variant);
                $this->assertNotEmpty($config['transcript']);
                $this->assertCount(10, $config['questions']);
                $this->assertSame($index % 2 === 0 ? 'female' : 'male', $variant['speakers']['b']['gender']);
                $this->assertSame($group['variants'][$index]['translation'][0], $skills['variants'][$index]['writing_translation']['lv']);
            }
        }
    }

    private function read(string $name): array
    {
        return json_decode(file_get_contents(resource_path('course/'.$name)), true, 512, JSON_THROW_ON_ERROR);
    }
}
