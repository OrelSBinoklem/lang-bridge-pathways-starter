<?php

declare(strict_types=1);

use App\Services\ContentAudit\CategoryLearningBalance;
use App\Services\ContentAudit\ElaipaTopicOccurrences;
use App\Services\ContentAudit\LatvianLemmaResolver;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
DB::connection()->beforeExecuting(function (): void {
    throw new RuntimeException('Frozen vocabulary audit must not access a database.');
});
$options = getopt('', ['index:', 'baseline:', 'candidates:', 'output:', 'lemmas:', 'topics:']);
foreach (['index', 'baseline', 'output'] as $key) {
    if (empty($options[$key])) {
        throw new InvalidArgumentException('Required: --index --baseline --output; optional --candidates');
    }
}
$read = fn (string $path): array => json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
$index = $read($options['index']);
$baseline = $read($options['baseline']);
$lemmaPath = $options['lemmas'] ?? resource_path('external-sources/e-laipa/derived/e-laipa-a1-b2-lemmas.json');
if (! is_file($lemmaPath) || hash_file('sha256', $lemmaPath) !== ($index['sources']['lemma']['sha256'] ?? null)) {
    throw new RuntimeException('Lemma source changed since the frozen snapshot.');
}
if (isset($options['lemmas'])) {
    app()->instance(LatvianLemmaResolver::class, new LatvianLemmaResolver($read($lemmaPath)));
}
$topicPath = $options['topics'] ?? resource_path('external-sources/e-laipa/derived/e-laipa-topic-occurrences.json');
if (isset($options['topics'])) {
    app()->instance(ElaipaTopicOccurrences::class, new ElaipaTopicOccurrences($read($topicPath)));
}
$root = realpath(base_path('.tmp'));
$parent = realpath(dirname($options['output']));
if (! $root || ! $parent || ! str_starts_with(strtolower($parent.DIRECTORY_SEPARATOR), strtolower($root.DIRECTORY_SEPARATOR))) {
    throw new RuntimeException('Output must stay inside an existing .tmp directory.');
}
if (file_exists($options['output'])) {
    throw new RuntimeException('Output exists; preserving prior report.');
}
$candidates = [];
if (isset($options['candidates'])) {
    foreach (glob(rtrim($options['candidates'], '/\\').'/*/*.json') as $file) {
        foreach ($read($file)['variants'] as $variant) {
            if (isset($candidates[$variant['variant_id']])) {
                throw new RuntimeException('Duplicate candidate');
            }
            $candidates[$variant['variant_id']] = $variant;
        }
    }
    if (count($candidates) !== count($baseline['variants'])) {
        throw new RuntimeException('Candidate coverage differs from frozen baseline.');
    }
}
$balance = app(CategoryLearningBalance::class);
$source = app(ElaipaTopicOccurrences::class)->source();
if (! ($source['complete'] ?? false)) {
    throw new RuntimeException('Complete E-Laipa topic-occurrence index is required.');
}
$groups = array_column(array_values($index['groups']), null, 'category_id');
$inventories = [];
$elaipa = [];
foreach ($groups as $category => $group) {
    $scope = [$category => true];
    foreach ($index['entries'] as $entry) {
        foreach ($entry['db'] as $word) {
            foreach ($word['categories'] as $child) {
                if ((int) $word['dictionary_id'] === 20 && in_array($category, $child['ancestors'], true)) {
                    $scope[$child['id']] = true;
                }
            }
        }
    }
    $inventories[$category] = $balance->inventory($index, 20, $scope, $group);
    $topicId = $index['group_topics'][$group['id']] ?? null;
    $elaipa[$category] = $balance->corpusInventory($source['topics'], $source['topics'][$topicId]['position'] ?? null);
}
$rows = [];
foreach ($baseline['variants'] as $row) {
    $config = isset($options['candidates']) ? ($candidates[$row['id']]['config'] ?? throw new RuntimeException('Missing candidate')) : $row['config'];
    $input = $balance->learnerText($config, false);
    $metric = $balance->measure($input, $inventories[$row['category_id']], $elaipa[$row['category_id']]);
    $body = ($config['task_kind'] ?? '') === 'lv_to_ru' ? ($config['source_text'] ?? '') : ($config['text'] ?? '');
    $bodyMetric = $balance->measure($body, $inventories[$row['category_id']], $elaipa[$row['category_id']]);
    $rows[] = ['variant_id' => $row['id'], 'category_id' => $row['category_id'], 'level' => $row['level'], 'task_kind' => $config['task_kind'] ?? null,
        'topic' => $groups[$row['category_id']]['title'], 'action' => $candidates[$row['id']]['action'] ?? 'baseline',
        'text_words' => $bodyMetric['total'], 'input_words' => $metric['total'], 'dictionary_percent' => $metric['dictionary_percent'],
        'whole_dictionary_percent' => $metric['whole_dictionary_percent'], 'combined_percent' => $metric['combined_percent'],
        'buckets' => $metric['buckets'], 'body_buckets' => $bodyMetric['buckets'],
        'uncovered' => array_values(array_filter($metric['words'], fn ($word) => in_array($word['bucket'], ['future', 'unmatched', 'ambiguous'], true)))];
}
$report = ['schema_version' => 1, 'created_at' => date(DATE_ATOM), 'source' => isset($options['candidates']) ? 'reading_revision_candidates' : 'published_baseline',
    'baseline_sha256' => hash_file('sha256', $options['baseline']), 'index_revision' => $index['revision'],
    'sources' => $index['sources'], 'elaipa_source' => app(ElaipaTopicOccurrences::class)->metadata(),
    'frozen_source_hashes' => ['lemmas' => hash_file('sha256', $lemmaPath), 'topic_occurrences' => hash_file('sha256', $topicPath)], 'variants' => $rows,
    'limitations' => ['Vocabulary is inferred curriculum, not known user mastery.', 'Morphology is approximate; names and unresolved inflections remain included.',
        'Low manual-dictionary coverage is not by itself a reason to rewrite.', 'E-Laipa full topic occurrences supplement current/prior lexical context.', 'No translations, private prompts or answer explanations enter the learner-facing denominator.']];
$handle = fopen($options['output'], 'x');
if (! $handle) {
    throw new RuntimeException('Cannot create report.');
}
fwrite($handle, json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
fclose($handle);
echo json_encode(['variants' => count($rows), 'database_access' => false, 'source' => $report['source']], JSON_UNESCAPED_UNICODE).PHP_EOL;
