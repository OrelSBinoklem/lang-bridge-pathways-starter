<?php

namespace App\Console\Commands;

use App\Models\CourseGroup;
use App\Models\LessonPage;
use App\Services\GrammarTask;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class PrepareGrammarGroupLessons extends Command
{
    protected $signature = 'grammar:prepare-groups {--write : Create missing stages and group pages}
        {--category= : Import only this category} {--package=groups : Content package: groups, agreement, a1-pack-01..04, a2-pack-01..03, b1-pack-01..03 or b2-pack-01..02}
        {--append-stages : Add selected references to existing group pages without replacing content}';
    protected $description = 'Validate original grammar stages and compose group lessons without copying progress';

    public function handle(): int
    {
        $packages = ['groups' => 'grammar-group-pilots.json', 'agreement' => 'grammar-agreement-pilot.json',
            'a1-pack-01' => 'grammar-a1-pack-01.json', 'a1-pack-02' => 'grammar-a1-pack-02.json',
            'a1-pack-03' => 'grammar-a1-pack-03.json', 'a1-pack-04' => 'grammar-a1-pack-04.json',
            'a2-pack-01' => 'grammar-a2-pack-01.json', 'a2-pack-02' => 'grammar-a2-pack-02.json',
            'a2-pack-03' => 'grammar-a2-pack-03.json', 'b1-pack-01' => 'grammar-b1-pack-01.json',
            'b1-pack-02' => 'grammar-b1-pack-02.json', 'b1-pack-03' => 'grammar-b1-pack-03.json',
            'b2-pack-01' => 'grammar-b2-pack-01.json', 'b2-pack-02' => 'grammar-b2-pack-02.json'];
        $file = $packages[$this->option('package')] ?? null;
        if (!$file) { $this->error('Unknown grammar package.'); return self::FAILURE; }
        $data = json_decode(file_get_contents(resource_path('course/'.$file)), true, 512, JSON_THROW_ON_ERROR);
        $topics = collect($data['topics'])->keyBy('slug');
        $groups = collect($data['group_pages']);
        if ($category = $this->option('category')) {
            $groups = $groups->where('category_id', (int) $category)->values();
            if ($groups->isEmpty()) { $this->error('Unknown grammar group category.'); return self::FAILURE; }
            $topics = $topics->only($groups->flatMap(fn ($group) => array_column($this->selections($group), 'source_slug'))->all());
        }
        $variants = $questions = 0;
        foreach ($topics as $topic) {
            foreach ($topic['blocks'] as $block) {
                if (count($block['variants']) !== 5) throw new \RuntimeException('Expected five authored variants.');
                $unique = [];
                foreach ($block['variants'] as $variant) {
                    GrammarTask::validate($variant['config']);
                    $unique[] = json_encode($variant['config'], JSON_THROW_ON_ERROR);
                    $variants++;
                    $questions += count($variant['config']['questions']);
                }
                if (count(array_unique($unique)) !== 5) throw new \RuntimeException('Repeated grammar variants.');
            }
        }
        foreach ($groups as $group) {
            $seen = [];
            foreach ($this->selections($group) as $selection) {
                $topic = $topics->get($selection['source_slug']);
                $stages = $selection['stages'];
                if (!$topic || !$stages || array_diff($stages, array_column($topic['blocks'], 'key'))
                    || count(array_unique($stages)) !== count($stages) || array_intersect($seen, $stages)) {
                    throw new \RuntimeException('Invalid grammar stage selection.');
                }
                $seen = array_merge($seen, $stages);
            }
        }
        $this->info("Validated: {$topics->count()} source topics, $variants variants, $questions questions, {$groups->count()} group pages.");
        if (!$this->option('write')) return self::SUCCESS;

        DB::transaction(function () use ($topics, $groups) {
            foreach ($topics as $topic) {
                $page = $this->createPage($topic);
                if (!$page->wasRecentlyCreated) { $this->line("Preserved: {$page->slug}"); continue; }
                foreach ($topic['blocks'] as $position => $source) {
                    $block = $page->blocks()->create([
                        'type' => 'grammar', 'title' => $source['title'], 'position' => $position,
                        'is_required' => true, 'weight' => 100, 'seed_key' => $page->slug.'-'.$source['key'],
                    ]);
                    foreach ($source['variants'] as $index => $variant) $block->variants()->create([
                        'title' => $variant['title'], 'config' => $variant['config'], 'position' => $index,
                        'is_published' => true, 'seed_key' => $block->seed_key.'-'.($index + 1),
                    ]);
                }
                $this->line("Created source: {$page->slug}");
            }
            foreach ($groups as $group) {
                $courseGroup = CourseGroup::where('seed_key', $group['course_group_seed_key'])->firstOrFail();
                $existing = LessonPage::where('slug', $group['slug'])->first();
                if ($existing) {
                    if ($this->option('append-stages')) {
                        foreach ($this->selections($group) as $selection) {
                            $sourcePage = LessonPage::where('slug', $selection['source_slug'])->firstOrFail();
                            $this->appendStages($existing, $sourcePage, $selection['stages'], $courseGroup);
                        }
                    }
                    $this->line("Preserved: {$existing->slug}");
                    continue;
                }
                if ($courseGroup->lessonPages()->where('skill', 'grammar')->exists()) {
                    throw new \RuntimeException("Group already has an admin grammar page: {$courseGroup->id}");
                }
                $selections = $this->selections($group);
                $sourcePages = collect($selections)->map(fn ($selection) => LessonPage::with('grammarTopic')
                    ->where('slug', $selection['source_slug'])->where('skill', 'grammar')
                    ->where('status', 'published')->where('is_published', true)->firstOrFail());
                if ($sourcePages->contains(fn ($source) => !$source->grammarTopic)) throw new \RuntimeException('Source grammar topic missing.');
                $sourceTopics = $sourcePages->map->grammarTopic;
                $page = $this->createPage([
                    'slug' => $group['slug'], 'title' => $group['title'], 'level' => $courseGroup->level,
                    'description' => null, 'rule' => $sourceTopics->pluck('rule')->implode("\n\n"),
                    'examples' => $sourceTopics->flatMap(fn ($topic) => $topic->examples ?? [])->all(),
                    'table_keys' => $sourceTopics->flatMap(fn ($topic) => $topic->table_keys ?? [])->unique()->values()->all(),
                ], $courseGroup->id);
                foreach ($selections as $index => $selection) {
                    $this->appendStages($page, $sourcePages[$index], $selection['stages'], $courseGroup);
                }
                $this->line("Created group page: {$page->slug}");
            }
        });
        return self::SUCCESS;
    }

    private function createPage(array $topic, ?int $groupId = null): LessonPage
    {
        $page = LessonPage::firstOrCreate(['slug' => $topic['slug']], [
            'title' => $topic['title'], 'description' => $topic['description'], 'level' => $topic['level'],
            'learn_lang' => 'lv', 'skill' => 'grammar', 'status' => 'published', 'is_published' => true,
            'seed_key' => $topic['slug'], 'course_group_id' => $groupId,
        ]);
        if ($page->wasRecentlyCreated) $page->grammarTopic()->create(array_intersect_key($topic, array_flip(['rule', 'examples', 'table_keys'])));
        return $page;
    }

    private function selections(array $group): array
    {
        $sources = $group['sources'] ?? [['source_slug' => $group['source_slug'], 'stages' => $group['stages']]];
        if (!$sources || !array_is_list($sources)) throw new \RuntimeException('Invalid grammar sources.');
        return $sources;
    }

    private function appendStages(LessonPage $page, LessonPage $sourcePage, array $keys, CourseGroup $group): void
    {
        if ($page->course_group_id !== $group->id || $page->skill !== 'grammar' || $sourcePage->skill !== 'grammar'
            || $page->learn_lang !== $sourcePage->learn_lang || $page->level !== $sourcePage->level
            || $sourcePage->status !== 'published' || !$sourcePage->is_published
            || !$page->grammarTopic || !$sourcePage->grammarTopic) {
            throw new \RuntimeException('Existing page is not a compatible grammar group page.');
        }
        // Append references only: never rewrite existing titles, variants, rules or progress.
        foreach ($keys as $key) {
            $source = $sourcePage->blocks()->where('seed_key', $sourcePage->slug.'-'.$key)->firstOrFail();
            if ($source->source_block_id || !$source->variants()->where('is_published', true)->exists()) {
                throw new \RuntimeException('Source stage must be canonical and published.');
            }
            $seedKey = $page->slug.'-'.$key;
            $sameKey = $page->blocks()->where('seed_key', $seedKey)->first();
            if ($sameKey && $sameKey->source_block_id !== $source->id) {
                throw new \RuntimeException('Existing stage seed key belongs to another block.');
            }
            if ($page->blocks()->where('source_block_id', $source->id)->exists()) continue;
            $position = $page->blocks()->max('position');
            $page->blocks()->create([
                'type' => 'grammar', 'title' => $source->title, 'source_block_id' => $source->id,
                'is_required' => true, 'weight' => 100, 'position' => $position === null ? 0 : $position + 1,
                'seed_key' => $seedKey,
            ]);
            $this->line("Appended stage: {$page->slug} / $key");
        }
        $page->grammarTopic->update(['table_keys' => array_values(array_unique(array_merge(
            $page->grammarTopic->table_keys ?? [], $sourcePage->grammarTopic->table_keys ?? [],
        )))]);
    }
}
