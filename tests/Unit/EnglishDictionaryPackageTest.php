<?php

namespace Tests\Unit;

use App\Services\EnglishDictionaryCopy;
use Tests\TestCase;

class EnglishDictionaryPackageTest extends TestCase
{
    public function test_reviewed_package_covers_each_source_record_once_with_at_most_30_words_per_section(): void
    {
        [$taxonomy, $groups, $identities] = (new EnglishDictionaryCopy)->resources();
        $words = collect($identities)->keyBy('id');
        $this->assertCount(count($identities), $words, 'Source identities must be unique');
        $this->assertSame(30, $taxonomy['max_words_per_leaf']);
        $this->assertSame(['A1', 'A2', 'B1', 'B2'], array_keys($groups));
        $this->assertSame([8, 8, 9, 9], array_map('count', array_values($groups)));
        $seen = [];
        foreach (['A1' => 1, 'A2' => 2, 'B1' => 3, 'B2' => 4] as $level => $number) {
            $expectedTopics = array_column($taxonomy['levels'][$level], 'key');
            $this->assertEqualsCanonicalizing($expectedTopics, array_keys($groups[$level]));
            foreach ($groups[$level] as $sections) {
                $names = [];
                foreach ($sections as $section) {
                    $this->assertNotEmpty(trim($section['name']));
                    $this->assertNotEmpty(trim($section['name_uk']));
                    $this->assertNotContains(mb_strtolower($section['name']), $names);
                    $names[] = mb_strtolower($section['name']);
                    $this->assertGreaterThan(0, count($section['word_ids']));
                    $this->assertLessThanOrEqual(30, count($section['word_ids']));
                    foreach ($section['word_ids'] as $id) {
                        $this->assertIsInt($id);
                        $this->assertFalse(isset($seen[$id]), 'Repeated source word '.$id);
                        $this->assertSame($number, $words->get($id)['level'] ?? null, 'Wrong level for '.$id);
                        $seen[$id] = true;
                    }
                }
            }
        }
        $this->assertEqualsCanonicalizing($words->keys()->all(), array_keys($seen));
    }
}
