<?php

declare(strict_types=1);
use App\Services\ContentAudit\CourseContentAudit;
use App\Services\ContentAudit\LatvianLemmaResolver;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

// Reuses the administrator's lexical audit against a frozen, local vocabulary snapshot.
require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
DB::connection()->beforeExecuting(function ($sql): void {
    throw new RuntimeException('This snapshot audit must not query or modify a database.');
});
$options = getopt('', ['index:', 'baseline:', 'output:', 'candidates:']);
foreach (['index', 'baseline', 'output'] as $key) {
    if (empty($options[$key])) {
        throw new InvalidArgumentException('Required: --index --baseline --output; optional --candidates');
    }
}
$read = fn (string $file): array => json_decode(file_get_contents($file), true, 512, JSON_THROW_ON_ERROR);
$index = $read($options['index']);
$baseline = $read($options['baseline']);
$temporaryRoot = realpath(base_path('.tmp'));
$outputParent = realpath(dirname($options['output']));
if (! $temporaryRoot || ! $outputParent || ! str_starts_with(strtolower($outputParent.DIRECTORY_SEPARATOR), strtolower($temporaryRoot.DIRECTORY_SEPARATOR))) {
    throw new RuntimeException('Output must be inside the existing .tmp directory.');
}
if (file_exists($options['output'])) {
    throw new RuntimeException('Preserving existing output; select a new filename.');
}
$resolver = app(LatvianLemmaResolver::class);
if ($resolver->sourceMetadata()['sha256'] !== ($index['sources']['lemma']['sha256'] ?? null)) {
    throw new RuntimeException('Lemma source changed since the vocabulary snapshot.');
}
$candidates = [];
if (isset($options['candidates'])) {
    foreach (glob(rtrim($options['candidates'], '/\\').'/*/*.json') as $file) {
        $pack = $read($file);
        foreach ($pack['variants'] as $variant) {
            $key = $pack['category_id'].':'.$variant['seed_key'];
            if (isset($candidates[$key])) {
                throw new RuntimeException('Duplicate candidate '.$key);
            }
            $candidates[$key] = $variant;
        }
    }
    if (count($candidates) !== count($baseline)) {
        throw new RuntimeException('Candidate coverage differs from baseline.');
    }
}
$groups = array_column(array_values($index['groups']), null, 'category_id');
$audit = app(CourseContentAudit::class);
$compact = function (array $parts, int $groupId) use ($audit, $index): array {
    $result = $audit->analyze($parts, $index, $groupId, 'occurrences', 'corpus');
    $reviewWords = [];
    foreach ($result['words'] as $word) {
        if (in_array($word['bucket'], ['prior', 'current'], true) && ! $word['match']['review_required']) {
            continue;
        }
        $reviewWords[] = ['surface' => $word['surface'], 'count' => $word['count'], 'bucket' => $word['bucket'],
            'lemmas' => $word['match']['lemmas'], 'method' => $word['match']['method'],
            'review_required' => $word['match']['review_required'],
            'dictionary_topics' => array_values(array_unique(array_merge(...array_map(fn ($entry) => array_map(fn ($id) => $index['groups'][$id]['title'], array_keys($entry['db_groups'])), array_values($word['entries']))))),
            'elaipa_first_seen' => array_values(array_merge(...array_map(fn ($entry) => $entry['elaipa'], array_values($word['entries'])))),
        ];
    }

    return ['total_units' => $result['total'], 'unique_units' => $result['unique'], 'review_units' => $result['review'],
        'summary' => $result['summary'], 'review_words' => $reviewWords];
};
$rows = [];
$canonical = function ($value) use (&$canonical) {
    if (! is_array($value)) {
        return $value;
    }
    if (! array_is_list($value)) {
        ksort($value, SORT_STRING);
    }

    return array_map($canonical, $value);
};
foreach ($baseline as $source) {
    $category = $source['category_id'];
    $group = $groups[$category] ?? throw new RuntimeException('Missing group context '.$category);
    $key = $category.':'.$source['seed_key'];
    $config = isset($options['candidates']) ? ($candidates[$key]['config'] ?? throw new RuntimeException('Missing candidate '.$key)) : $source['content'];
    $speech = array_map(fn ($s) => ['label' => 'Speech', 'text' => $s['text']], $config['dialogue_segments']);
    $questions = array_map(fn ($q) => ['label' => 'Statement', 'text' => $q['statement']], $config['questions']);
    $rows[] = ['category_id' => $category, 'seed_key' => $source['seed_key'], 'level' => $group['level'], 'topic' => $group['title'],
        'config_sha256' => hash('sha256', json_encode($canonical($config), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_LINE_TERMINATORS | JSON_THROW_ON_ERROR)),
        'elaipa_topic' => $index['group_topics'][$group['id']] ?? null,
        'speech' => $compact($speech, $group['id']), 'statements' => $compact($questions, $group['id'])];
}
$report = ['schema_version' => 1, 'created_at' => date(DATE_ATOM), 'database_access' => false,
    'index_revision' => $index['revision'], 'baseline_sha256' => hash_file('sha256', $options['baseline']),
    'source' => isset($options['candidates']) ? 'revision_candidates' : 'published_baseline',
    'sources' => $index['sources'], 'unmapped_groups' => $index['unmapped_groups'],
    'limitations' => ['Lexical occurrences include phrase units; percentages are not a CEFR or difficulty score.',
        'Corpus-form matches can be ambiguous. Names and unseen inflections inflate unmatched counts.',
        'E-Laipa exports first_seen, not every topic membership. Corpus-only does not prove prior teaching.',
        'The existing corpus bucket may include lemma-index entries without an explicit topic; inspect review_words.',
        'Uses a local dictionary snapshot and a separately captured published text baseline; no personal mastery claims.'],
    'variants' => $rows];
$handle = fopen($options['output'], 'x');
if (! $handle) {
    throw new RuntimeException('Cannot create output.');
}
fwrite($handle, json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
fclose($handle);
echo count($rows).' variants audited; no database access, no audio generation.'.PHP_EOL;
