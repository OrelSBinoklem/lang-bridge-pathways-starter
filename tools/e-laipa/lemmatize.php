<?php

declare(strict_types=1);

/**
 * Build a derived, lemma-based word list from the e-Laipa raw snapshot.
 *
 * Usage:
 *   php tools/e-laipa/lemmatize.php
 *
 * The source snapshot remains unchanged. This script uses the public Latvian
 * morphology service maintained by LU MII/Tēzaurs and tags each saved source
 * token in isolation. That makes the result useful for dictionary matching,
 * while preserving source forms and a review signal for homographs.
 */

const MORPHO_TAGGER_URL = 'https://morpho-api.tezaurs.lv/morphotagger/';
const BATCH_SIZE = 120;
const CONCURRENCY = 6;

$root = dirname(__DIR__, 2);
$rawFile = $root . '/resources/external-sources/e-laipa/e-laipa-a1-b2.json';
$derivedDirectory = $root . '/resources/external-sources/e-laipa/derived';
$derivedFile = $derivedDirectory . '/e-laipa-a1-b2-lemmas.json';

if (! is_file($rawFile)) {
    throw new RuntimeException("Raw snapshot not found: {$rawFile}");
}

if (! is_dir($derivedDirectory) && ! mkdir($derivedDirectory, 0775, true) && ! is_dir($derivedDirectory)) {
    throw new RuntimeException("Unable to create {$derivedDirectory}");
}

/** @return array<string, mixed> */
function readRaw(string $path): array
{
    $raw = file_get_contents($path);
    if ($raw === false) {
        throw new RuntimeException("Unable to read {$path}");
    }

    $decoded = json_decode($raw, true, flags: JSON_THROW_ON_ERROR);
    if (! is_array($decoded) || ! isset($decoded['lexicon_index']) || ! is_array($decoded['lexicon_index'])) {
        throw new RuntimeException('Raw snapshot has no lexicon_index');
    }

    return $decoded;
}

/** @param array<int, string> $words */
function taggerUrl(array $words): string
{
    return MORPHO_TAGGER_URL . rawurlencode(implode("\n", $words));
}

/**
 * @param array<int, array<int, string>> $batches
 * @return array<int, string>
 */
function requestBatches(array $batches): array
{
    $multi = curl_multi_init();
    $pending = $batches;
    $active = [];
    $responses = [];

    $addNext = static function () use (&$pending, &$active, $multi): void {
        if ($pending === []) {
            return;
        }

        $batchIndex = array_key_first($pending);
        $words = $pending[$batchIndex];
        unset($pending[$batchIndex]);

        $curl = curl_init(taggerUrl($words));
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => 60,
            CURLOPT_USERAGENT => 'LangBridge-Pathways/e-Laipa-lemma-export (dictionary preparation)',
            CURLOPT_HTTPHEADER => ['Accept: text/plain'],
        ]);
        curl_multi_add_handle($multi, $curl);
        $active[(int) $curl] = ['batch' => $batchIndex, 'words' => $words, 'handle' => $curl];
    };

    while (count($active) < CONCURRENCY && $pending !== []) {
        $addNext();
    }

    do {
        do {
            $status = curl_multi_exec($multi, $running);
        } while ($status === CURLM_CALL_MULTI_PERFORM);

        while ($info = curl_multi_info_read($multi)) {
            $curl = $info['handle'];
            $item = $active[(int) $curl];
            $body = curl_multi_getcontent($curl);
            $httpStatus = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
            $error = curl_error($curl);
            curl_multi_remove_handle($multi, $curl);
            curl_close($curl);
            unset($active[(int) $curl]);

            if ($info['result'] !== CURLE_OK || $httpStatus < 200 || $httpStatus >= 300 || ! is_string($body)) {
                throw new RuntimeException("Morphology request {$item['batch']} failed (HTTP {$httpStatus}): {$error}");
            }

            $responses[$item['batch']] = $body;
            while (count($active) < CONCURRENCY && $pending !== []) {
                $addNext();
            }
        }

        if ($running > 0) {
            curl_multi_select($multi, 1.0);
        }
    } while ($running > 0 || $active !== []);

    curl_multi_close($multi);
    ksort($responses);

    return $responses;
}

/** @return array{surface: string, tag: string, lemma: string}|null */
function parseTaggerLine(string $line): ?array
{
    $parts = preg_split('/\t/', trim($line), 3);
    if (! is_array($parts) || count($parts) !== 3) {
        return null;
    }

    return ['surface' => $parts[0], 'tag' => $parts[1], 'lemma' => $parts[2]];
}

function partOfSpeech(string $tag): string
{
    return match (mb_substr($tag, 0, 1, 'UTF-8')) {
        'n' => 'nouns',
        'v' => 'verbs',
        'a' => 'adjectives',
        default => 'other_words',
    };
}

$raw = readRaw($rawFile);
$sourceEntries = $raw['lexicon_index'];
$forms = array_values(array_filter(array_map(
    static fn (array $entry): ?string => isset($entry['normalized']) && is_string($entry['normalized']) ? $entry['normalized'] : null,
    $sourceEntries,
)));
$sourceByForm = [];
foreach ($sourceEntries as $entry) {
    if (isset($entry['normalized']) && is_string($entry['normalized'])) {
        $sourceByForm[$entry['normalized']] = $entry;
    }
}

$batches = array_chunk($forms, BATCH_SIZE);
fwrite(STDERR, sprintf("Tagging %d source forms in %d batches\n", count($forms), count($batches)));
$responses = requestBatches($batches);

$entries = [
    'nouns' => [],
    'verbs' => [],
    'adjectives' => [],
    'other_words' => [],
];
$unmatched = [];

foreach ($responses as $batchIndex => $response) {
    $expected = $batches[$batchIndex];
    $analyses = array_values(array_filter(array_map('parseTaggerLine', preg_split('/\R/u', trim($response)) ?: [])));

    if (count($analyses) !== count($expected)) {
        $unmatched[] = [
            'reason' => 'response_count_mismatch',
            'batch' => $batchIndex,
            'expected_forms' => $expected,
            'received_lines' => count($analyses),
        ];
        continue;
    }

    foreach ($analyses as $index => $analysis) {
        $expectedForm = $expected[$index];
        if ($analysis['surface'] !== $expectedForm || $analysis['lemma'] === '') {
            $unmatched[] = [
                'reason' => 'surface_mismatch_or_missing_lemma',
                'surface' => $expectedForm,
                'received_surface' => $analysis['surface'],
                'tag' => $analysis['tag'],
                'lemma' => $analysis['lemma'],
            ];
            continue;
        }

        $bucket = partOfSpeech($analysis['tag']);
        $entryKey = $bucket . ':' . $analysis['lemma'];
        if (! isset($entries[$bucket][$entryKey])) {
            $entries[$bucket][$entryKey] = [
                'lemma' => $analysis['lemma'],
                'part_of_speech' => rtrim($bucket, 's'),
                'source_forms' => [],
                'first_seen' => $sourceByForm[$expectedForm]['first_seen'] ?? null,
                'analysis_mode' => 'isolated_token',
                'review_required' => true,
            ];
        }

        $entries[$bucket][$entryKey]['source_forms'][] = [
            'surface' => $expectedForm,
            'tag' => $analysis['tag'],
        ];
    }
}

foreach ($entries as $bucket => $bucketEntries) {
    $entries[$bucket] = array_values($bucketEntries);
    usort($entries[$bucket], static fn (array $left, array $right): int => strcmp($left['lemma'], $right['lemma']));
}

$derived = [
    'schema_version' => 1,
    'generated_at' => gmdate('c'),
    'raw_source' => [
        'path' => 'resources/external-sources/e-laipa/e-laipa-a1-b2.json',
        'sha256' => hash_file('sha256', $rawFile),
        'schema_version' => $raw['schema_version'] ?? null,
    ],
    'analysis' => [
        'provider' => 'LU MII / Tēzaurs Latvian morphology web service',
        'endpoint' => MORPHO_TAGGER_URL,
        'mode' => 'isolated_token',
        'note' => 'Every lemma must be reviewed before import because individual source tokens have no sentence context.',
    ],
    'words' => $entries,
    'phrases' => [],
    'unmatched' => $unmatched,
];

file_put_contents(
    $derivedFile,
    json_encode($derived, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL,
);

$counts = array_map('count', $entries);
fwrite(STDERR, sprintf(
    "Written %s: nouns=%d verbs=%d adjectives=%d other=%d unmatched=%d\n",
    $derivedFile,
    $counts['nouns'],
    $counts['verbs'],
    $counts['adjectives'],
    $counts['other_words'],
    count($unmatched),
));
