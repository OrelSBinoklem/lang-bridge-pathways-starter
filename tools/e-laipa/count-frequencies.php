<?php

declare(strict_types=1);

/**
 * Count how often every word form occurs in the public e-Laipa task pages.
 *
 * The raw snapshot only keeps the first occurrence of a word, so this pass
 * re-reads every task page listed in it and counts all occurrences.
 *
 * Usage:
 *   php tools/e-laipa/count-frequencies.php
 *
 * Output: resources/external-sources/e-laipa/derived/e-laipa-a1-b2-frequencies.json
 *   frequencies[surface] = {count: total occurrences, tasks: number of tasks}
 *
 * Tokenising follows tools/e-laipa/export.php (same markup cleaning, Cyrillic
 * and stop-word filtering) with one difference: capitalised words are counted
 * too (lower-cased), otherwise sentence-initial words would be undercounted.
 * The task title (instruction line) is ignored, as in the export.
 */

const E_LAIPA_USER_AGENT = 'LangBridge-Pathways/e-Laipa-public-export (educational metadata)';

$root = dirname(__DIR__, 2);
$rawFile = $root . '/resources/external-sources/e-laipa/e-laipa-a1-b2.json';
$outFile = $root . '/resources/external-sources/e-laipa/derived/e-laipa-a1-b2-frequencies.json';

if (! is_file($rawFile)) {
    throw new RuntimeException("Required input not found: {$rawFile}");
}

$raw = json_decode(file_get_contents($rawFile), true, flags: JSON_THROW_ON_ERROR);

/** @var array<string, string> $taskUrls task id => material url */
$taskUrls = [];
foreach ($raw['levels'] ?? [] as $level) {
    foreach ($level['topics'] ?? [] as $topic) {
        foreach ($topic['tasks'] ?? [] as $task) {
            if (isset($task['id'], $task['source_url'])) {
                $taskUrls[(string) $task['id']] = (string) $task['source_url'];
            }
        }
    }
}

fwrite(STDERR, sprintf("Fetching %d task pages\n", count($taskUrls)));

function request(string $url): string
{
    for ($attempt = 1; $attempt <= 3; $attempt++) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_CONNECTTIMEOUT => 15,
            CURLOPT_TIMEOUT => 45,
            CURLOPT_USERAGENT => E_LAIPA_USER_AGENT,
        ]);
        $body = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);

        if (is_string($body) && $status >= 200 && $status < 300) {
            return $body;
        }

        if ($attempt === 3) {
            throw new RuntimeException("GET {$url} failed with HTTP {$status}");
        }

        usleep($attempt * 400_000);
    }

    throw new RuntimeException("GET {$url} failed");
}

/**
 * Fetch URLs concurrently; the callback receives each finished page so the
 * caller does not have to keep all HTML in memory.
 *
 * @param array<string, string> $urls
 * @param callable(string, string): void $onPage
 */
function fetchMany(array $urls, callable $onPage): void
{
    $multi = curl_multi_init();
    $queue = $urls;
    $active = [];
    $limit = 8;
    $done = 0;
    $total = count($urls);

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
            CURLOPT_USERAGENT => E_LAIPA_USER_AGENT,
        ]);
        curl_multi_add_handle($multi, $curl);
        $active[(int) $curl] = ['key' => (string) $key, 'url' => $url, 'handle' => $curl];
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
            $httpStatus = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
            curl_multi_remove_handle($multi, $curl);
            curl_close($curl);
            unset($active[(int) $curl]);

            if ($info['result'] !== CURLE_OK || $httpStatus < 200 || $httpStatus >= 300 || ! is_string($body)) {
                // One slow request should not abort the whole run.
                $body = request($item['url']);
            }

            $onPage($item['key'], $body);
            $done++;
            if ($done % 100 === 0 || $done === $total) {
                fwrite(STDERR, "  {$done}/{$total}\n");
            }

            while (count($active) < $limit && $queue !== []) {
                $addNext();
            }
        }

        if ($running > 0) {
            curl_multi_select($multi, 1.0);
        }
    } while ($running > 0 || $active !== []);

    curl_multi_close($multi);
}

/** @return array<int, string> every token occurrence, lower-cased */
function tokenize(string $html): array
{
    // Titles hold Latvian, English and Russian UI variants separated by '#'.
    $html = preg_replace('/<div\s+class="exe-title"[^>]*>.*?<\/div>/is', ' ', $html) ?? $html;
    $withoutScripts = preg_replace('#<(script|style|audio|source|svg)\b[^>]*>.*?</\1>#is', ' ', $html) ?? $html;
    $text = html_entity_decode(strip_tags($withoutScripts), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    // `~` and `-` mark a stem/ending boundary in the e-Laipa tables, not a word break.
    $text = str_replace(['~', '-'], '', $text);
    $text = preg_replace('/\s+/u', ' ', $text) ?? $text;

    preg_match_all("/(?<!\\p{L})\\p{L}[\\p{L}']{1,}(?!\\p{L})/u", $text, $matches);

    $stopWords = array_fill_keys([
        'function', 'alphabet', 'numbers', 'true', 'false', 'null', 'undefined',
        'listen', 'repeat', 'read', 'and', 'the', 'a', 'an', 'прослушай', 'повтори',
        'прочитай', 'слушай', 'латviešu',
    ], true);

    $tokens = [];
    foreach ($matches[0] as $word) {
        $normalized = mb_strtolower($word, 'UTF-8');
        if (preg_match('/\p{Cyrillic}/u', $normalized) === 1) {
            continue;
        }
        if (isset($stopWords[$normalized]) || mb_strlen($normalized, 'UTF-8') < 2) {
            continue;
        }

        $tokens[] = $normalized;
    }

    return $tokens;
}

/** @var array<string, int> $counts */
$counts = [];
/** @var array<string, int> $taskCounts */
$taskCounts = [];
$tokensTotal = 0;
$pagesCounted = 0;

fetchMany($taskUrls, static function (string $taskId, string $html) use (&$counts, &$taskCounts, &$tokensTotal, &$pagesCounted): void {
    $seenInTask = [];
    foreach (tokenize($html) as $token) {
        $counts[$token] = ($counts[$token] ?? 0) + 1;
        $seenInTask[$token] = true;
        $tokensTotal++;
    }
    foreach ($seenInTask as $token => $_) {
        $taskCounts[$token] = ($taskCounts[$token] ?? 0) + 1;
    }
    $pagesCounted++;
});

// Most frequent first; ties alphabetical so the file is stable between runs.
uksort($counts, static function (string $a, string $b) use ($counts): int {
    return [$counts[$b], $a] <=> [$counts[$a], $b];
});

$frequencies = [];
foreach ($counts as $token => $count) {
    $frequencies[$token] = ['count' => $count, 'tasks' => $taskCounts[$token] ?? 0];
}

$result = [
    'schema_version' => 1,
    'generated_at' => gmdate('c'),
    'raw_source' => [
        'path' => 'resources/external-sources/e-laipa/e-laipa-a1-b2.json',
        'sha256' => hash_file('sha256', $rawFile),
    ],
    'definition' => 'count = total occurrences of the lower-cased word form in all e-Laipa task pages (instruction titles excluded); tasks = number of task pages containing it. Table/paradigm text counts as usage.',
    'tasks_counted' => $pagesCounted,
    'tokens_total' => $tokensTotal,
    'unique_forms' => count($frequencies),
    'frequencies' => $frequencies,
];

$json = json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
// One line per word form: "iet": {"count": 131, "tasks": 60},
$json = preg_replace('/\{\s+"count": (\d+),\s+"tasks": (\d+)\s+\}/', '{"count": $1, "tasks": $2}', $json) ?? $json;

file_put_contents($outFile, $json . PHP_EOL);

fwrite(STDERR, sprintf(
    "Written %s: tasks=%d tokens=%d unique_forms=%d\n",
    $outFile,
    $pagesCounted,
    $tokensTotal,
    count($frequencies),
));
