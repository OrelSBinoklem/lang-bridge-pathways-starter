<?php

use App\Console\Commands\ApplyCourseReadingRevision;
use App\Services\ContentAudit\CourseLearningLoad;
use Illuminate\Support\Facades\DB;

require __DIR__.'/../../vendor/autoload.php';
$app = require __DIR__.'/../../bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$arguments = getopt('', ['output:']);
$target = $arguments['output'] ?? '';
$root = realpath(base_path('.tmp'));
$directory = realpath(dirname($target));
if (! $root || ! $directory || ! str_starts_with(strtolower(str_replace('\\', '/', $directory)).'/', strtolower(str_replace('\\', '/', $root)).'/')
    || is_link(dirname($target)) || file_exists($target) || ! str_ends_with($target, '.json')) {
    throw new RuntimeException('Select a new JSON output in an existing workspace .tmp directory.');
}
DB::connection()->beforeExecuting(function ($sql) {
    if (! preg_match('/^\s*select\b/i', $sql)) {
        throw new RuntimeException('Audit is SELECT only.');
    }
});
$groups = DB::table('course_groups')->where('dictionary_id', 20)->where('learn_lang', 'lv')->where('is_published', true)
    ->whereIn('level', ['A1', 'A2', 'B1', 'B2'])->orderBy('position')->orderBy('id')->get()->map(fn ($row) => (array) $row)->all();
$byId = array_column($groups, null, 'id');
$variants = DB::table('lesson_block_variants as v')->join('lesson_blocks as b', 'b.id', '=', 'v.lesson_block_id')
    ->join('lesson_pages as p', 'p.id', '=', 'b.lesson_page_id')->whereIn('p.course_group_id', array_keys($byId))
    ->where('p.status', 'published')->where('p.is_published', true)->where('p.learn_lang', 'lv')
    ->whereIn('p.skill', ['reading', 'listening', 'writing', 'speaking'])->whereNull('b.source_block_id')->where('v.is_published', true)
    ->orderBy('v.id')->get(['v.id', 'v.title', 'v.seed_key', 'v.position', 'v.config', 'b.id as block_id', 'p.id as page_id',
        'p.slug', 'p.skill', 'p.course_group_id']);
$load = app(CourseLearningLoad::class);
$rows = [];
$reading = [];
foreach ($variants as $variant) {
    $group = $byId[$variant->course_group_id];
    $config = json_decode($variant->config, true, 512, JSON_THROW_ON_ERROR);
    $row = ['variant_id' => (int) $variant->id, 'block_id' => (int) $variant->block_id, 'category_id' => (int) $group['category_id'],
        'level' => $group['level'], 'skill' => $variant->skill, 'kind' => $config['task_kind'] ?? '', 'title' => $variant->title,
        'slug' => $variant->slug, 'config_sha256' => ApplyCourseReadingRevision::fingerprint(json_decode($variant->config, false, 512, JSON_THROW_ON_ERROR)),
        'learning_load' => $load->inspect($config, $variant->skill, $load->context($groups, $group))];
    $rows[] = $row;
    if ($variant->skill === 'reading') {
        $reading[] = ['id' => (int) $variant->id, 'block_id' => (int) $variant->block_id, 'page_id' => (int) $variant->page_id,
            'category_id' => (int) $group['category_id'], 'level' => $group['level'], 'title' => $variant->title,
            'seed_key' => $variant->seed_key, 'position' => (int) $variant->position, 'config' => $config, 'config_sha256' => $row['config_sha256']];
    }
}
$summary = ['variants' => count($rows), 'reading_variants' => count($reading), 'review_flags' => array_sum(array_map(fn ($row) => count($row['learning_load']['flags']), $rows)),
    'variants_with_flags' => count(array_filter($rows, fn ($row) => (bool) $row['learning_load']['flags'])), 'database_writes' => false,
    'personal_data_read' => false, 'exams_evaluated' => false, 'grammar_sequence_verified' => false];
$bytes = json_encode(['schema_version' => 1, 'source' => 'current_course_select_only', 'created_at' => gmdate('c'),
    'summary' => $summary, 'groups' => $groups, 'rows' => $rows, 'reading_baseline' => $reading], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR);
$handle = fopen($target, 'x');
if (! $handle || fwrite($handle, $bytes) !== strlen($bytes)) {
    throw new RuntimeException('Cannot save complete audit.');
}
fclose($handle);
echo json_encode($summary, JSON_THROW_ON_ERROR), "\n";
