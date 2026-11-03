<?php

declare(strict_types=1);
use App\Services\ContentAudit\CourseVocabularyIndex;
use Illuminate\Contracts\Console\Kernel;
use Illuminate\Support\Facades\DB;

require dirname(__DIR__, 2).'/vendor/autoload.php';
$app = require dirname(__DIR__, 2).'/bootstrap/app.php';
$app->make(Kernel::class)->bootstrap();
$connection = DB::connection();
if (app()->environment() !== 'local' || ! str_starts_with(gethostbyname($connection->getConfig('host')), '127.')) {
    throw new RuntimeException('Only a local loopback database is permitted.');
}
$options = getopt('', ['name:']);
$name = $options['name'] ?? '';
if (! preg_match('/^[a-z0-9][a-z0-9_-]{1,100}$/', $name)) {
    throw new InvalidArgumentException('Usage: php tools/course/snapshot-listening-vocabulary.php --name=listening-audit-YYYYMMDD');
}
$temporaryRoot = realpath(base_path('.tmp'));
if (! $temporaryRoot || is_link(base_path('.tmp'))) {
    throw new RuntimeException('Expected a real .tmp directory.');
}
$out = $temporaryRoot.DIRECTORY_SEPARATOR.$name;
if (file_exists($out)) {
    throw new RuntimeException('Snapshot already exists; use a new name.');
}
$connection->beforeExecuting(function ($sql): void {
    if (! preg_match('/^\s*select\b/i', $sql)) {
        throw new RuntimeException('SELECT only.');
    }
});
$index = app(CourseVocabularyIndex::class)->build(20);
if (! mkdir($out, 0700)) {
    throw new RuntimeException('Cannot create snapshot directory.');
}
$save = function (string $filename, array $value) use ($out): void {
    $file = fopen($out.DIRECTORY_SEPARATOR.$filename, 'x');
    if (! $file) {
        throw new RuntimeException('Preserving existing output.');
    }
    fwrite($file, json_encode($value, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR));
    fclose($file);
};
$save('vocabulary-index.json', $index);
$topics = json_decode(file_get_contents(resource_path('external-sources/e-laipa/derived/e-laipa-a1-b2-all-words.json')), true, 512, JSON_THROW_ON_ERROR);
$groups = [];
foreach ($index['groups'] as $id => $group) {
    if (! $group['category_id']) {
        continue;
    }
    $groups[$group['category_id']] = $id;
    $current = $prior = $future = [];
    foreach ($index['entries'] as $lemma => $entry) {
        $positions = array_map(fn ($gid) => $index['groups'][$gid]['position'], array_keys($entry['db_groups']));
        if (isset($entry['db_groups'][$id])) {
            $current[] = $lemma;
        }
        if ($positions && min($positions) < $group['position']) {
            $prior[] = $lemma;
        }
        if ($positions && min($positions) > $group['position']) {
            $future[] = $lemma;
        }
    }
    $topicKey = $index['group_topics'][$id] ?? null;
    $topic = $topicKey ? substr($topicKey, strpos($topicKey, ':') + 1) : null;
    $save($group['category_id'].'-context.json', ['read_only' => true, 'group' => $group,
        'index_revision' => $index['revision'], 'current_dictionary_words' => $current,
        'previous_dictionary_words' => $prior, 'future_only_dictionary_words' => $future,
        'elaipa_topic' => $topic, 'elaipa_first_seen_words' => $topic ? ($topics[$group['level']][$topic] ?? []) : [],
        'limitations' => ['Assumed passive curriculum, not personal mastery.', 'E-Laipa topic is first_seen, not complete membership.', 'Exact DB entries; morphology requires separate audit.']]);
}
$save('snapshot-metadata.json', ['created_at' => date(DATE_ATOM), 'read_only' => true, 'dictionary_id' => 20,
    'index_revision' => $index['revision'], 'sources' => $index['sources'], 'group_by_category' => $groups,
    'unmapped_groups' => $index['unmapped_groups']]);
echo json_encode(['contexts' => count($groups), 'unmapped_groups' => $index['unmapped_groups']], JSON_UNESCAPED_UNICODE).PHP_EOL;
