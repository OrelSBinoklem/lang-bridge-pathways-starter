<?php

declare(strict_types=1);

use App\Services\ContentAudit\ElaipaTopicOccurrences;

require dirname(__DIR__, 2).'/vendor/autoload.php';

$root = dirname(__DIR__, 2);
$rawPath = $root.'/resources/external-sources/e-laipa/e-laipa-a1-b2.json';
$output = $argv[1] ?? $root.'/resources/external-sources/e-laipa/derived/e-laipa-topic-occurrences.json';
$cache = $root.'/.tmp/e-laipa-topic-pages-20261012';
if (! is_dir($cache)) {
    mkdir($cache, 0700, true);
}
$raw = json_decode(file_get_contents($rawPath), true, 512, JSON_THROW_ON_ERROR);
$topics = $queue = [];
foreach ($raw['levels'] as $level) {
    foreach ($level['topics'] as $topic) {
        $key = $level['key'].':'.$topic['title'];
        $topics[$key] = ['id' => $key, 'level' => $level['key'], 'topic' => $topic['title'], 'position' => count($topics), 'tasks_total' => count($topic['tasks']), 'tasks_counted' => 0, 'words' => []];
        foreach ($topic['tasks'] as $task) {
            $url = $task['source_url'];
            if (parse_url($url, PHP_URL_HOST) !== 'e-laipa.dzc.lv' || ! str_starts_with($url, 'https://')) {
                throw new RuntimeException('Unexpected source host');
            }
            $queue[] = ['id' => $task['id'], 'url' => $url, 'topic' => $key, 'attempt' => 0];
        }
    }
}
$total = count($queue);
$done = 0;
$consume = function (array $item, string $html) use (&$topics, &$done, $total): void {
    foreach (ElaipaTopicOccurrences::extract($html) as $surface => $count) {
        $topics[$item['topic']]['words'][$surface] = ($topics[$item['topic']]['words'][$surface] ?? 0) + $count;
    }
    $topics[$item['topic']]['tasks_counted']++;
    $done++;
    if ($done % 50 === 0 || $done === $total) {
        fwrite(STDERR, "Pages $done/$total\n");
    }
};
$pending = [];
foreach ($queue as $item) {
    $path = $cache.'/'.hash('sha256', $item['url']).'.html';
    if (is_file($path)) {
        $consume($item, file_get_contents($path));
    } else {
        $pending[] = $item;
    }
}
$multi = curl_multi_init();
$active = [];
$add = function (array $item) use ($multi, &$active): void {
    $item['attempt']++;
    $curl = curl_init($item['url']);
    curl_setopt_array($curl, [CURLOPT_RETURNTRANSFER => true, CURLOPT_CONNECTTIMEOUT => 10, CURLOPT_TIMEOUT => 30,
        CURLOPT_USERAGENT => 'LangBridge-Pathways/e-Laipa-public-lexical-index', CURLOPT_FOLLOWLOCATION => false]);
    curl_multi_add_handle($multi, $curl);
    $active[(int) $curl] = ['handle' => $curl, 'item' => $item];
};
$failures = [];
while ($pending || $active) {
    while (count($active) < 6 && $pending) {
        $add(array_shift($pending));
    }
    do {
        $status = curl_multi_exec($multi, $running);
    } while ($status === CURLM_CALL_MULTI_PERFORM);
    while ($info = curl_multi_info_read($multi)) {
        $curl = $info['handle'];
        $item = $active[(int) $curl]['item'];
        $html = curl_multi_getcontent($curl);
        $http = curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_multi_remove_handle($multi, $curl);
        unset($active[(int) $curl]);
        curl_close($curl);
        if ($info['result'] !== CURLE_OK || $http !== 200 || ! is_string($html) || ! str_contains($html, 'exe-container')) {
            if ($item['attempt'] < 3) {
                $pending[] = $item;
            } else {
                $failures[] = ['id' => $item['id'], 'status' => $http];
            }

            continue;
        }
        file_put_contents($cache.'/'.hash('sha256', $item['url']).'.html', $html);
        $consume($item, $html);
    }
    if ($active) {
        curl_multi_select($multi, 0.5);
    }
}
curl_multi_close($multi);
if ($failures) {
    throw new RuntimeException('Incomplete source: '.count($failures).' failed pages; examples: '.json_encode(array_slice($failures, 0, 5)));
}
foreach ($topics as &$topic) {
    ksort($topic['words']);
}
unset($topic);
$result = ['schema_version' => 1, 'generated_at' => gmdate('c'),
    'source' => ['path' => 'resources/external-sources/e-laipa/e-laipa-a1-b2.json', 'sha256' => hash_file('sha256', $rawPath)],
    'scope' => 'All word occurrences in visible public task markup, excluding titles, scripts, styles and audio. No audio transcripts or copied passages are stored.',
    'complete' => true, 'tasks_counted' => $done, 'topics' => $topics];
file_put_contents($output, json_encode($result, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)."\n");
fwrite(STDERR, 'Written lexical topic index: '.$done." pages\n");
