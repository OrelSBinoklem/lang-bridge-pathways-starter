<?php

namespace Tests\Unit;

use PHPUnit\Framework\TestCase;

class CourseListeningPilotScriptsTest extends TestCase
{
    public function test_pilot_has_ten_distinct_two_voice_dialogues_with_balanced_questions(): void
    {
        $scripts = json_decode(
            file_get_contents(dirname(__DIR__, 2) . '/resources/course/listening-pilot-a1.json'),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );
        $audio = json_decode(
            file_get_contents(dirname(__DIR__, 2) . '/resources/course/listening-pilot-a1-audio.json'),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );

        $this->assertSame([1763, 1764], array_keys($scripts));
        $transcripts = [];
        foreach ($scripts as $categoryId => $group) {
            $this->assertCount(5, $group);
            foreach ($group as $index => $script) {
                $this->assertNotEmpty($script['title']);
                $this->assertSame('male', $script['speakers']['a']['gender']);
                $this->assertSame('female', $script['speakers']['b']['gender']);
                $this->assertGreaterThanOrEqual(2, count($script['segments']));

                $speakers = array_unique(array_column($script['segments'], 0));
                sort($speakers);
                $this->assertSame(['a', 'b'], $speakers);
                $transcript = implode(' ', array_column($script['segments'], 1));
                $this->assertLessThanOrEqual(2000, mb_strlen($transcript));
                foreach ($script['speakers'] as $speaker) {
                    $this->assertStringContainsString($speaker['name'], $transcript);
                }
                $transcripts[] = $transcript;
                $recording = $audio[$categoryId]['variant:' . ($index + 1)];
                $this->assertSame('eleven_v3', $recording['audio_generation']['model']);
                $this->assertSame('lv', $recording['audio_generation']['language']);
                $this->assertSame(hash('sha256', implode("\n", array_map(
                    fn (array $segment) => strtoupper($segment[0]) . ': ' . $segment[1],
                    $script['segments'],
                ))), $recording['transcript_sha256']);
                $path = dirname(__DIR__, 2) . '/frontend/public' . $recording['audio_url'];
                $this->assertFileExists($path);
                $this->assertSame(hash_file('sha256', $path), $recording['file_sha256']);

                $this->assertCount(10, $script['questions']);
                $this->assertCount(10, array_unique(array_column($script['questions'], 0)));
                $this->assertSame(5, count(array_filter(array_column($script['questions'], 1))));
                foreach ($script['questions'] as $question) {
                    $this->assertNotEmpty($question[0]);
                    $this->assertIsBool($question[1]);
                    $this->assertNotEmpty($question[2]);
                }
            }
        }
        $this->assertCount(10, array_unique($transcripts));
    }
}
