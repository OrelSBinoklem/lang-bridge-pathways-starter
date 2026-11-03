<?php

declare(strict_types=1);

/**
 * Export the public e-Laipa course navigation and lexical candidates.
 *
 * Usage:
 *   php tools/e-laipa/export.php
 *
 * The source is a public API. The resulting JSON is the canonical raw snapshot
 * for later processing. Derived files must be written under resources/external-sources/e-laipa/
 * derived or reviews, never back into this source file. It intentionally does
 * not guess Latvian lemmas or parts of speech from an inflected form.
 */

const E_LAIPA_BASE_URL = 'https://e-laipa.dzc.lv';
const E_LAIPA_API_URL = E_LAIPA_BASE_URL . '/service/api.php/';
const E_LAIPA_MATERIAL_URL = E_LAIPA_BASE_URL . '/service/file.php/material/';

const LEVELS = ['A1', 'A2', 'B1', 'B2'];

$rawDirectory = dirname(__DIR__, 2) . '/resources/external-sources/e-laipa';
$rawFile = $rawDirectory . '/e-laipa-a1-b2.json';

if (! is_dir($rawDirectory) && ! mkdir($rawDirectory, 0775, true) && ! is_dir($rawDirectory)) {
    throw new RuntimeException("Unable to create {$rawDirectory}");
}

/** @return array<int, array<string, mixed>> */
function requestJson(string $url): array
{
    $response = request($url);
    $decoded = json_decode($response, true, flags: JSON_THROW_ON_ERROR);

    return is_array($decoded) ? $decoded : [];
}

function request(string $url): string
{
    $attempt = 0;

    while (++$attempt <= 3) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => 45,
            CURLOPT_USERAGENT => 'LangBridge-Pathways/e-Laipa-public-export (educational metadata)',
            CURLOPT_HTTPHEADER => ['Accept: application/json, text/html;q=0.9, */*;q=0.8'],
        ]);

        $body = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        $error = curl_error($curl);
        curl_close($curl);

        if (is_string($body) && $status >= 200 && $status < 300) {
            return $body;
        }

        if ($attempt === 3) {
            throw new RuntimeException("GET {$url} failed with HTTP {$status}: {$error}");
        }

        usleep($attempt * 400_000);
    }

    throw new RuntimeException("GET {$url} failed");
}

/**
 * @param array<string, string> $urls Keyed URLs so callers can retain their
 * source item while requests are executed concurrently.
 * @return array<string, string>
 */
function requestMany(array $urls): array
{
    $multi = curl_multi_init();
    $queue = $urls;
    $active = [];
    $responses = [];
    $limit = 8;

    $addNext = static function () use (&$queue, &$active, $multi): void {
        if ($queue === []) {
            return;
        }

        $key = array_key_first($queue);
        $url = $queue[$key];
        unset($queue[$key]);

        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => 45,
            CURLOPT_USERAGENT => 'LangBridge-Pathways/e-Laipa-public-export (educational metadata)',
            CURLOPT_HTTPHEADER => ['Accept: application/json, text/html;q=0.9, */*;q=0.8'],
        ]);
        curl_multi_add_handle($multi, $curl);
        $active[(int) $curl] = ['key' => $key, 'url' => $url, 'handle' => $curl];
    };

    while (count($active) < $limit && $queue !== []) {
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
            $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
            $error = curl_error($curl);
            curl_multi_remove_handle($multi, $curl);
            curl_close($curl);
            unset($active[(int) $curl]);

            if ($info['result'] !== CURLE_OK || $status < 200 || $status >= 300 || ! is_string($body)) {
                // A single delayed request should not abort a whole level.
                $body = request($item['url']);
                if ($body === '') {
                    throw new RuntimeException("GET {$item['url']} failed: {$error}");
                }
            }

            $responses[$item['key']] = $body;
            while (count($active) < $limit && $queue !== []) {
                $addNext();
            }
        }

        if ($running > 0) {
            curl_multi_select($multi, 1.0);
        }
    } while ($running > 0 || $active !== []);

    curl_multi_close($multi);

    return $responses;
}

/** @return array<int, array<string, mixed>> */
function decodeJson(string $response): array
{
    $decoded = json_decode($response, true, flags: JSON_THROW_ON_ERROR);

    return is_array($decoded) ? $decoded : [];
}

/** @param array<string, mixed> $node */
function navigationUrl(?array $node = null, ?string $level = null): string
{
    if ($node !== null) {
        return E_LAIPA_API_URL . 'navigation?parentuid=' . rawurlencode("'{$node['uid']}'") . '&orderby=rating';
    }

    return E_LAIPA_API_URL . "navigation?parentuid=null&level='" . rawurlencode((string) $level) . "'&orderby=rating";
}

function taskUrl(string $uid): string
{
    return E_LAIPA_MATERIAL_URL . rawurlencode($uid);
}

/**
 * Extract Latvian-looking lexical units from visible task markup. This is
 * deliberately conservative: JavaScript identifiers and all sentence context
 * are discarded. POS remains unknown until a Latvian morphology source is
 * connected; invented POS labels would poison the future dictionary import.
 *
 * @return array<int, string>
 */
function extractWords(string $html): array
{
    // Titles hold Latvian, English and Russian UI variants separated by '#'.
    // They are instructions, not the exercise vocabulary.
    $html = preg_replace('/<div\s+class="exe-title"[^>]*>.*?<\/div>/is', ' ', $html) ?? $html;
    $withoutScripts = preg_replace('#<(script|style|audio|source|svg)\b[^>]*>.*?</\1>#is', ' ', $html) ?? $html;
    $text = html_entity_decode(strip_tags($withoutScripts), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    // The e-Laipa morphology tables mark a stem/ending boundary with either
    // `~` or `-` (for example `māt~es`, `māt-e`). Those markers are not word
    // separators and must disappear before tokenisation.
    $text = str_replace(['~', '-'], '', $text);
    $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

    preg_match_all("/(?<!\\p{L})[\\p{Ll}][\\p{L}']{1,}(?!\\p{L})/u", $text, $matches);

    $stopWords = array_fill_keys([
        'function', 'alphabet', 'numbers', 'true', 'false', 'null', 'undefined',
        'listen', 'repeat', 'read', 'and', 'the', 'a', 'an', 'прослушай', 'повтори',
        'прочитай', 'слушай', 'латviešu',
    ], true);

    $words = [];
    foreach ($matches[0] as $word) {
        $normalized = mb_strtolower($word, 'UTF-8');
        if (preg_match('/\p{Cyrillic}/u', $normalized) === 1) {
            continue;
        }
        if (isset($stopWords[$normalized]) || mb_strlen($normalized, 'UTF-8') < 2) {
            continue;
        }

        $words[$normalized] = $normalized;
    }

    return array_values($words);
}

/** @return array{title: string, words: array<int, string>} */
function parseTaskDetails(string $html): array
{
    $title = '';
    if (preg_match('/class="exe-title"[^>]*>(.*?)<\/div>/is', $html, $match) === 1) {
        $title = trim(html_entity_decode(strip_tags($match[1]), ENT_QUOTES | ENT_HTML5, 'UTF-8'));
    }

    return ['title' => $title, 'words' => extractWords($html)];
}

$course = [
    'schema_version' => 2,
    'generated_at' => gmdate('c'),
    'source' => [
        'provider' => 'e-Laipa',
        'home' => E_LAIPA_BASE_URL,
        'scope' => 'Public task metadata and lexical candidates from all visible task markup.',
        'limitations' => [
            'No reading passages or listening transcripts are copied.',
            'Words are global first-occurrence candidates; Latvian lemma and POS validation is a separate pass.',
        ],
    ],
    'levels' => [],
    'lexicon_index' => [],
];

$seenWords = [];

foreach (LEVELS as $level) {
    fwrite(STDERR, "{$level}: loading topics\n");
    $topics = requestJson(navigationUrl(level: $level));
    $exportLevel = ['key' => $level, 'topics' => []];

    $typeResponses = requestMany(array_combine(
        array_map(static fn (array $topic): string => (string) $topic['uid'], $topics),
        array_map(static fn (array $topic): string => navigationUrl($topic), $topics),
    ));
    $typesByTopic = [];
    $taskUrls = [];

    foreach ($topics as $topic) {
        fwrite(STDERR, "  {$level}: {$topic['title']}\n");
        $types = decodeJson($typeResponses[$topic['uid']]);
        $typesByTopic[$topic['uid']] = $types;
        foreach ($types as $type) {
            $taskUrls[$type['uid']] = navigationUrl($type);
        }
    }

    $taskResponses = requestMany($taskUrls);
    $materialUrls = [];
    foreach ($typesByTopic as $types) {
        foreach ($types as $type) {
            foreach (decodeJson($taskResponses[$type['uid']]) as $task) {
                $materialUrls[$task['uid']] = taskUrl((string) $task['uid']);
            }
        }
    }
    fwrite(STDERR, "  {$level}: loading " . count($materialUrls) . " task pages\n");
    $materialResponses = requestMany($materialUrls);

    foreach ($topics as $topic) {
        $types = $typesByTopic[$topic['uid']];
        $exportTopic = [
            'id' => $topic['uid'],
            'title' => $topic['title'],
            'tasks' => [],
        ];

        foreach ($types as $type) {
            $tasks = decodeJson($taskResponses[$type['uid']]);
            foreach ($tasks as $task) {
                $taskDetails = parseTaskDetails($materialResponses[$task['uid']]);

                $newWords = [];
                foreach ($taskDetails['words'] as $word) {
                    if (isset($seenWords[$word])) {
                        continue;
                    }

                    $seenWords[$word] = [
                        'surface' => $word,
                        'normalized' => $word,
                        'standard_form' => null,
                        'standard_form_status' => 'unverified',
                        'part_of_speech' => 'unknown',
                        'first_seen' => [
                            'level' => $level,
                            'topic_id' => $topic['uid'],
                            'task_id' => $task['uid'],
                        ],
                    ];
                    $newWords[] = $seenWords[$word];
                }

                $exportTopic['tasks'][] = [
                    'id' => $task['uid'],
                    'sequence' => (int) $task['rating'],
                    'label' => $task['title'],
                    'title' => $taskDetails['title'],
                    'path' => $task['path'],
                    'source_url' => taskUrl((string) $task['uid']),
                    'words' => [
                        'nouns' => [],
                        'verbs' => [],
                        'adjectives' => [],
                        'other_words' => $newWords,
                        'phrases' => [],
                    ],
                ];
            }

        }

        $exportLevel['topics'][] = $exportTopic;
    }

    $course['levels'][] = $exportLevel;
}

$course['lexicon_index'] = array_values($seenWords);

file_put_contents(
    $rawFile,
    json_encode($course, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL,
);

fwrite(STDERR, sprintf("Written raw snapshot %s (%d unique candidates)\n", $rawFile, count($seenWords)));
