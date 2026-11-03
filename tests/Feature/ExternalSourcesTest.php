<?php

namespace Tests\Feature;

use App\Services\TaskGeneration\ElaipaVocabularyStatistics;
use Tests\TestCase;

class ExternalSourcesTest extends TestCase
{
    public function test_frequency_reader_uses_relocated_source_without_changing_provenance(): void
    {
        $reader = new ElaipaVocabularyStatistics;
        $relative = 'resources/external-sources/e-laipa/derived/e-laipa-a1-b2-frequencies.json';
        $source = json_decode(file_get_contents(base_path($relative)), true, 512, JSON_THROW_ON_ERROR);
        $metadata = $reader->metadata();

        $this->assertSame($relative, $metadata['path']);
        $this->assertSame(hash_file('sha256', base_path($relative)), $metadata['sha256']);
        $this->assertSame($source['raw_source'], $metadata['raw_source']);
        $form = array_key_first($source['frequencies']);
        $this->assertSame([$form => $source['frequencies'][$form]], $reader->forText($form));
    }

    public function test_topic_reader_uses_relocated_source(): void
    {
        $relative = 'resources/external-sources/e-laipa/derived/e-laipa-a1-b2-all-words.json';
        $source = json_decode(file_get_contents(base_path($relative)), true, 512, JSON_THROW_ON_ERROR);
        $topic = array_key_first($source['A1']);
        $result = (new ElaipaVocabularyStatistics)->topic('A1', $topic);

        $this->assertSame($relative, $result['path']);
        $this->assertSame(hash_file('sha256', base_path($relative)), $result['sha256']);
        $this->assertSame($source['A1'][$topic], $result['words']);
    }
}
