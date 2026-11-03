<?php

namespace App\Console\Commands;

use App\Models\CourseGroup;
use App\Models\LessonPage;
use App\Services\GrammarTask;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PrepareEnglishGrammar extends Command
{
    protected $signature = 'grammar:prepare-english {--apply : Add missing English exercises and course placements} {--dictionary=31}';
    protected $description = 'Validate English table exercises; create canonical stages and shared course references';

    public function handle(): int
    {
        $tables = collect();
        foreach (['a1', 'a2', 'b1', 'b2', 'forms', 'extensions'] as $file) {
            $tables = $tables->concat($this->read('english-grammar/'.$file.'.json'));
        }
        $tables = $tables->keyBy('id');
        $tasks = collect(array_merge($this->read('english-grammar/practice-a1-a2.json'), $this->read('english-grammar/practice-b1-b2.json')));
        if ($tasks->count() !== $tables->count() || $tasks->pluck('table_id')->unique()->count() !== $tables->count()
            || $tasks->pluck('table_id')->diff($tables->keys())->isNotEmpty()) {
            throw new \RuntimeException('English practice must cover every table exactly once.');
        }
        $questions = 0;
        foreach ($tasks as $task) {
            if (count($task['variants']) !== 3) throw new \RuntimeException('Expected three variants: '.$task['table_id']);
            $seen = [];
            $kind = $task['variants'][0]['config']['task_kind'];
            foreach ($task['variants'] as $variant) {
                GrammarTask::validate($variant['config']);
                if ($variant['config']['task_kind'] !== $kind || count($variant['config']['questions']) !== 6) {
                    throw new \RuntimeException('Expected six questions of the same kind: '.$task['table_id']);
                }
                foreach ($variant['config']['questions'] as $question) {
                    $prompt = GrammarTask::normalize($question['prompt']);
                    if (isset($seen[$prompt])) throw new \RuntimeException('Repeated question: '.$task['table_id']);
                    $seen[$prompt] = true;
                    $questions++;
                }
            }
        }
        $plan = $this->read('course/english-path.json');
        $this->info("Validated {$tasks->count()} tables, ".($tasks->count() * 3)." variants, $questions questions.");
        if (!$this->option('apply')) return self::SUCCESS;

        DB::transaction(function () use ($tables, $tasks, $plan) {
            foreach ($tasks as $task) {
                $table = $tables[$task['table_id']];
                $slug = 'grammar-'.$table['id'];
                $page = $this->page($slug, $table['title'], strtoupper($table['level']), $table['rule'], [$table['key']],
                    array_map(fn ($row) => ['text' => implode(' ', array_column($row['example'], 'text')), 'translation' => $row['translation']], $table['rows']));
                // Existing pages are administrator-owned. Never regenerate their content or restore removed stages.
                if (!$page->wasRecentlyCreated) continue;
                $block = $page->blocks()->create(['type' => 'grammar', 'title' => $task['title'], 'position' => 0,
                    'is_required' => true, 'weight' => 100, 'seed_key' => $slug.':practice']);
                foreach ($task['variants'] as $index => $variant) $block->variants()->create([
                    'title' => $variant['title'], 'config' => $variant['config'], 'position' => $index,
                    'is_published' => true, 'seed_key' => $block->seed_key.':'.($index + 1),
                ]);
            }
            foreach ($plan['levels'] as $level => $topics) foreach ($topics as $topic) {
                if (!$topic['grammar']) continue;
                $ids = $topic['grammar'];
                $sources = LessonPage::with('blocks', 'grammarTopic')->whereIn('slug', array_map(fn ($id) => 'grammar-'.$id, $ids))->get()->keyBy('slug');
                // Match the additive course seed identity, not a translated category title.
                $group = CourseGroup::where('learn_lang', 'en')->where('level', $level)
                    ->where('dictionary_id', (int) $this->option('dictionary'))
                    ->whereHas('category', fn ($q) => $q->where('name', $topic['category']))->firstOrFail();
                $slug = 'grammar-english-group-'.$group->category_id;
                $existing = LessonPage::where('seed_key', $slug)->first();
                if ($existing) continue;
                if ($group->lessonPages()->where('skill', 'grammar')->exists()) {
                    throw new \RuntimeException('Group already has administrator grammar content: '.$group->id);
                }
                foreach ($ids as $id) {
                    $source = $sources['grammar-'.$id] ?? null;
                    if (!$source || $source->learn_lang !== 'en' || $source->level !== $level
                        || !$source->is_published || $source->status !== 'published' || !$source->grammarTopic
                        || $source->blocks->whereNull('source_block_id')->where('type', 'grammar')->isEmpty()) {
                        throw new \RuntimeException('Source is unavailable; preserve admin changes: '.$id);
                    }
                }
                $selected = collect($ids)->map(fn ($id) => $sources['grammar-'.$id]);
                $page = $this->page($slug, $group->display_title.' — грамматика', $level,
                    $selected->map(fn ($p) => $p->grammarTopic->rule)->implode("\n\n"),
                    $selected->flatMap(fn ($p) => $p->grammarTopic->table_keys)->unique()->values()->all(), [], $group->id);
                if (!$page->wasRecentlyCreated) continue;
                $position = 0;
                foreach ($selected as $sourcePage) foreach ($sourcePage->blocks->whereNull('source_block_id')->where('type', 'grammar') as $source) {
                    $page->blocks()->create(['type' => 'grammar', 'title' => $source->title, 'source_block_id' => $source->id,
                        'position' => $position++, 'is_required' => true, 'weight' => 100, 'seed_key' => $slug.':'.$source->id]);
                }
            }
        });
        $this->info('English exercises and course references prepared. Existing content preserved.');
        return self::SUCCESS;
    }

    private function page(string $slug, string $title, string $level, string $rule, array $keys, array $examples, ?int $groupId = null): LessonPage
    {
        $page = LessonPage::firstOrCreate(['slug' => $slug], ['seed_key' => $slug, 'title' => $title, 'level' => $level,
            'learn_lang' => 'en', 'skill' => 'grammar', 'status' => 'published', 'is_published' => true, 'course_group_id' => $groupId]);
        if ($page->wasRecentlyCreated) $page->grammarTopic()->create(['rule' => $rule, 'table_keys' => $keys, 'examples' => $examples]);
        elseif ($page->learn_lang !== 'en' || $page->skill !== 'grammar' || $page->level !== $level || $page->seed_key !== $slug) {
            throw new \RuntimeException('English seed identity conflicts with existing page: '.$slug);
        }
        return $page;
    }

    private function read(string $path): array
    {
        return json_decode(file_get_contents(resource_path($path)), true, 512, JSON_THROW_ON_ERROR);
    }
}
