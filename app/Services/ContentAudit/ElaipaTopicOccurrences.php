<?php

namespace App\Services\ContentAudit;

use DOMDocument;
use DOMXPath;
use Illuminate\Support\Facades\Cache;

class ElaipaTopicOccurrences
{
    public function __construct(private ?array $fixture = null) {}

    public function metadata(): ?array
    {
        if ($this->fixture !== null) {
            return ['path' => 'test-fixture', 'sha256' => hash('sha256', json_encode($this->fixture))];
        }
        $relative = 'resources/external-sources/e-laipa/derived/e-laipa-topic-occurrences.json';
        $path = base_path($relative);

        return is_file($path) ? ['path' => $relative, 'sha256' => hash_file('sha256', $path)] : null;
    }

    public function source(): ?array
    {
        if ($this->fixture !== null) {
            return $this->fixture;
        }
        $meta = $this->metadata();
        if (! $meta) {
            return null;
        }

        return Cache::store('file')->remember('elaipa-topic-occurrences:v1:'.$meta['sha256'], 86400,
            fn () => json_decode(file_get_contents(base_path($meta['path'])), true, 512, JSON_THROW_ON_ERROR));
    }

    public static function extract(string $html): array
    {
        $document = new DOMDocument;
        $previous = libxml_use_internal_errors(true);
        try {
            $document->loadHTML('<?xml encoding="UTF-8">'.$html, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
            $xpath = new DOMXPath($document);
            foreach ($xpath->query('//script|//style|//audio|//source|//svg|//noscript|//*[contains(concat(" ", normalize-space(@class), " "), " exe-title ")]') as $node) {
                $node->parentNode?->removeChild($node);
            }
            foreach ($xpath->query('//br|//td|//th|//p|//div|//li') as $node) {
                $node->appendChild($document->createTextNode(' '));
            }
            $text = $document->textContent;
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
        $text = preg_replace('/(?<=\p{Latin})[~\-](?=\p{Latin})/u', '', $text);
        preg_match_all('/(?<![\p{L}\p{M}])[\p{Latin}\p{M}]+(?:[’\x{0027}][\p{Latin}\p{M}]+)*(?![\p{L}\p{M}])/u', $text, $matches);
        $stop = array_fill_keys(['listen', 'repeat', 'read', 'and', 'the', 'a', 'an', 'true', 'false', 'null', 'undefined', 'function'], true);
        $counts = [];
        foreach ($matches[0] as $surface) {
            $key = LatvianLemmaResolver::normalize($surface);
            if (! isset($stop[$key])) {
                $counts[$key] = ($counts[$key] ?? 0) + 1;
            }
        }
        ksort($counts);

        return $counts;
    }
}
