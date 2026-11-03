<?php

declare(strict_types=1);

/**
 * Build a derived, level+topic grouped word list from the e-Laipa lemma export.
 * Every lemma is grouped under the topic (thematic category) where it was first
 * seen and carries its usage frequency in the e-Laipa materials.
 *
 * Frequency of a lemma = sum of the counts of its distinct source word forms
 * (see tools/e-laipa/count-frequencies.php, which must be run first).
 *
 * Usage:
 *   php tools/e-laipa/categorize-by-topic.php <bucket>
 *   bucket is one of: nouns, verbs, adjectives, other_words, all
 *
 * Output entries are [lemma, count] pairs, most frequent first within a topic
 * (ties alphabetical). For `all`, every topic holds one such list per bucket.
 */

$bucket = $argv[1] ?? null;
$partBuckets = ['nouns', 'verbs', 'adjectives', 'other_words'];
$knownBuckets = [...$partBuckets, 'all'];
if (! is_string($bucket) || ! in_array($bucket, $knownBuckets, true)) {
    fwrite(STDERR, 'Usage: php tools/e-laipa/categorize-by-topic.php <' . implode('|', $knownBuckets) . ">\n");
    exit(1);
}

$root = dirname(__DIR__, 2);
$rawFile = $root . '/resources/external-sources/e-laipa/e-laipa-a1-b2.json';
$lemmasFile = $root . '/resources/external-sources/e-laipa/derived/e-laipa-a1-b2-lemmas.json';
$frequenciesFile = $root . '/resources/external-sources/e-laipa/derived/e-laipa-a1-b2-frequencies.json';
$outFile = $root . '/resources/external-sources/e-laipa/derived/e-laipa-a1-b2-' . ($bucket === 'all' ? 'all-words' : $bucket) . '.json';

foreach ([$rawFile, $lemmasFile, $frequenciesFile] as $path) {
    if (! is_file($path)) {
        throw new RuntimeException("Required input not found: {$path}" . ($path === $frequenciesFile ? ' (run count-frequencies.php first)' : ''));
    }
}

$raw = json_decode(file_get_contents($rawFile), true, flags: JSON_THROW_ON_ERROR);
$lemmas = json_decode(file_get_contents($lemmasFile), true, flags: JSON_THROW_ON_ERROR);
$frequencies = json_decode(file_get_contents($frequenciesFile), true, flags: JSON_THROW_ON_ERROR)['frequencies'] ?? [];

/** @var array<int, array{key: string, topics: array<int, array{id: string, title: string}>}> $levels */
$levels = $raw['levels'] ?? [];

// A topic id is only meaningful within its level, but the source ids already
// look globally unique, so a flat map is enough to resolve a title.
$topicTitleById = [];
$topicOrderByLevel = [];
foreach ($levels as $level) {
    $topicOrderByLevel[$level['key']] = [];
    foreach ($level['topics'] as $topic) {
        $topicTitleById[$topic['id']] = $topic['title'];
        $topicOrderByLevel[$level['key']][] = $topic['title'];
    }
}

// A surface form claimed by several lemma entries would be counted once per
// entry; report how often that happens so the numbers can be trusted.
$surfaceOwners = [];
foreach ($partBuckets as $name) {
    foreach ($lemmas['words'][$name] ?? [] as $entry) {
        foreach ($entry['source_forms'] ?? [] as $form) {
            $surfaceOwners[mb_strtolower((string) ($form['surface'] ?? ''), 'UTF-8')][] = $entry['lemma'] ?? '';
        }
    }
}
$sharedSurfaces = count(array_filter($surfaceOwners, static fn (array $owners): bool => count(array_unique($owners)) > 1));

/** @param array<string, mixed> $entry */
function lemmaFrequency(array $entry, array $frequencies): int
{
    $surfaces = [];
    foreach ($entry['source_forms'] ?? [] as $form) {
        $surface = mb_strtolower((string) ($form['surface'] ?? ''), 'UTF-8');
        if ($surface !== '') {
            $surfaces[$surface] = true;
        }
    }

    $sum = 0;
    foreach (array_keys($surfaces) as $surface) {
        $sum += (int) ($frequencies[$surface]['count'] ?? 0);
    }

    return $sum;
}

$missingTopic = [];
$zeroFrequency = 0;

/**
 * @param array<int, array<string, mixed>> $entries
 * @return array<string, array<string, array<int, array{0: string, 1: int}>>> level => topic => [[lemma, count], ...]
 */
$group = static function (array $entries) use ($topicTitleById, $topicOrderByLevel, $frequencies, &$missingTopic, &$zeroFrequency): array {
    /** @var array<string, array<string, array<string, int>>> $grouped */
    $grouped = [];
    foreach ($entries as $entry) {
        $lemma = $entry['lemma'] ?? null;
        $level = $entry['first_seen']['level'] ?? null;
        $topicId = $entry['first_seen']['topic_id'] ?? null;
        if ($lemma === null || $level === null || $topicId === null) {
            continue;
        }

        $topicTitle = $topicTitleById[$topicId] ?? null;
        if ($topicTitle === null) {
            $missingTopic[] = $lemma;
            continue;
        }

        $count = lemmaFrequency($entry, $frequencies);
        if ($count === 0) {
            $zeroFrequency++;
        }

        // Same lemma twice in one topic (different tags): keep the larger count.
        $grouped[$level][$topicTitle][$lemma] = max($grouped[$level][$topicTitle][$lemma] ?? 0, $count);
    }

    // Walk levels/topics in the source's own order so the output reads the same
    // way the course does, rather than in hash-map insertion order.
    $ordered = [];
    foreach ($topicOrderByLevel as $level => $topicTitles) {
        if (! isset($grouped[$level])) {
            continue;
        }

        $ordered[$level] = [];
        foreach (array_unique($topicTitles) as $topicTitle) {
            if (! isset($grouped[$level][$topicTitle])) {
                continue;
            }

            $pairs = [];
            foreach ($grouped[$level][$topicTitle] as $lemma => $count) {
                $pairs[] = [(string) $lemma, $count];
            }
            usort($pairs, static fn (array $a, array $b): int => [$b[1], $a[0]] <=> [$a[1], $b[0]]);
            $ordered[$level][$topicTitle] = $pairs;
        }
    }

    return $ordered;
};

if ($bucket === 'all') {
    $perBucket = [];
    foreach ($partBuckets as $name) {
        $perBucket[$name] = $group($lemmas['words'][$name] ?? []);
    }

    // level => topic => {nouns, verbs, adjectives, other_words}
    $output = [];
    foreach ($topicOrderByLevel as $level => $topicTitles) {
        $output[$level] = [];
        foreach (array_unique($topicTitles) as $topicTitle) {
            $types = [];
            foreach ($partBuckets as $name) {
                $types[$name] = $perBucket[$name][$level][$topicTitle] ?? [];
            }
            if (array_sum(array_map('count', $types)) > 0) {
                $output[$level][$topicTitle] = $types;
            }
        }
    }
} else {
    $output = $group($lemmas['words'][$bucket] ?? []);
}

$json = json_encode($output, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
// Keep every [lemma, count] pair on one line: ["valoda", 455],
$json = preg_replace('/\[\s+("(?:[^"\\\\]|\\\\.)*"),\s+(\d+)\s+\]/', '[$1, $2]', $json) ?? $json;

file_put_contents($outFile, $json . PHP_EOL);

$totalOut = 0;
$topicCount = 0;
foreach ($output as $topics) {
    $topicCount += count($topics);
    foreach ($topics as $list) {
        // `all` nests one list per bucket; a plain bucket is a single list.
        $totalOut += $bucket === 'all' ? array_sum(array_map('count', $list)) : count($list);
    }
}

fwrite(STDERR, sprintf(
    "Written %s: levels=%d topics=%d %s=%d missing_topic=%d zero_frequency=%d shared_surfaces=%d\n",
    $outFile,
    count($output),
    $topicCount,
    $bucket,
    $totalOut,
    count($missingTopic),
    $zeroFrequency,
    $sharedSurfaces,
));

if ($missingTopic !== []) {
    fwrite(STDERR, 'Lemmas with unresolved topic id: ' . implode(', ', $missingTopic) . "\n");
}
