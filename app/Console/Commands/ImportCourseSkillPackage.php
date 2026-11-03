<?php

namespace App\Console\Commands;

use App\Models\CourseGroup;
use App\Models\LessonPage;
use App\Services\TaskGeneration\CourseSkillDraft;
use App\Services\TutorCategoryVocabularyContext;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use RuntimeException;

class ImportCourseSkillPackage extends Command
{
    protected $signature = 'course:import-skill-package {file : Authored reading/writing/speaking JSON}
        {--write : Create missing drafts; never overwrite editor changes}
        {--publish : Publish only a complete package matching the authored source}';

    protected $description = 'Validate and import seven five-variant tasks without changing existing listening lessons';

    public function handle(CourseSkillDraft $builder, TutorCategoryVocabularyContext $vocabulary): int
    {
        try {
            $path = realpath($this->argument('file'));
            if (!$path || !is_file($path)) throw new RuntimeException('Package not found.');
            $draft = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
            $categoryId = $draft['category_id'] ?? null;
            $dictionaryId = $draft['dictionary_id'] ?? null;
            if (!is_int($categoryId) || $categoryId < 1 || !is_int($dictionaryId) || $dictionaryId < 1) throw new RuntimeException('Invalid category/dictionary ID.');
            $group = CourseGroup::where('category_id', $categoryId)->where('dictionary_id', $dictionaryId)->sole();
            if ($group->level !== ($draft['level'] ?? null) || $group->learn_lang !== 'lv') throw new RuntimeException('Course level/language mismatch.');
            $context = $vocabulary->build($categoryId, $dictionaryId);
            $builder->validate($draft, array_column($context['current_words'], 'id'));
            $pages = $builder->pages($draft);
            $statementCount = array_sum(array_map(fn ($variant) => count($variant['reading']['questions']), $draft['variants']));
            $this->info("Category {$categoryId}: 3 skills, 7 blocks, 35 variants, {$statementCount} reading statements. Listening is unchanged.");
            if (!$this->option('write') && !$this->option('publish')) return self::SUCCESS;

            DB::transaction(function () use ($pages, $group, $categoryId) {
                foreach ($pages as $skill => $source) {
                    $seed = "course-skill-package:{$categoryId}:{$skill}";
                    $page = LessonPage::where('seed_key', $seed)->lockForUpdate()->first();
                    if (!$page) {
                        if (!$this->option('write')) throw new RuntimeException('Import drafts with --write first.');
                        if ($group->lessonPages()->where('skill', $skill)->exists()) throw new RuntimeException("Existing {$skill} lesson found; review manually.");
                        $page = LessonPage::create([
                            'seed_key' => $seed, 'course_group_id' => $group->id, 'skill' => $skill,
                            'title' => $group->display_title.' - '.$source['title'], 'slug' => "course-{$categoryId}-{$skill}",
                            'level' => $group->level, 'learn_lang' => 'lv', 'status' => 'draft', 'is_published' => false,
                            'description' => 'Задания по теме; пять подготовленных вариантов каждого подзадания.',
                        ]);
                    }
                    if ((int) $page->course_group_id !== (int) $group->id || $page->skill !== $skill || $page->learn_lang !== 'lv' || $page->level !== $group->level) throw new RuntimeException('Lesson ownership changed; review manually.');
                    foreach ($source['blocks'] as $index => $sourceBlock) {
                        $block = $page->blocks()->firstOrCreate(['seed_key' => $seed.':'.$sourceBlock['key']], [
                            'type' => $skill, 'title' => $sourceBlock['title'], 'position' => ($index + 1) * 10,
                            'is_required' => $sourceBlock['is_required'], 'weight' => $sourceBlock['is_required'] ? 100 : 0,
                            'bot_prompt' => $sourceBlock['bot_prompt'], 'config' => [],
                        ]);
                        if ($block->type !== $skill || $block->bot_prompt !== $sourceBlock['bot_prompt']) throw new RuntimeException('Block type or tutor instructions were edited; no changes applied.');
                        foreach ($sourceBlock['variants'] as $offset => $sourceVariant) {
                            $variant = $block->variants()->firstOrCreate(['seed_key' => 'variant:'.($offset + 1)], [
                                'title' => 'Вариант '.($offset + 1).': '.$sourceVariant['title'],
                                'position' => ($offset + 1) * 10, 'config' => $sourceVariant['config'], 'is_published' => false,
                            ]);
                            if ($variant->config !== $sourceVariant['config']) throw new RuntimeException("Variant {$variant->id} was edited; no changes applied.");
                            if ($this->option('publish') && !$variant->is_published) $variant->update(['is_published' => true]);
                        }
                        if ($block->variants()->count() !== 5) throw new RuntimeException('Variant count changed; review manually.');
                    }
                    if ($page->blocks()->count() !== count($source['blocks'])) throw new RuntimeException('Block count changed; review manually.');
                    if ($this->option('publish') && (!$page->is_published || $page->status !== 'published')) $page->update(['is_published' => true, 'status' => 'published']);
                }
            });
            $this->info($this->option('publish') ? 'Package published in the configured database.' : 'Drafts imported. Existing content and progress preserved.');
            return self::SUCCESS;
        } catch (ValidationException $exception) {
            $this->error(implode(' ', $exception->validator->errors()->all()));
            return self::FAILURE;
        } catch (\JsonException|\RuntimeException $exception) {
            $this->error($exception->getMessage());
            return self::FAILURE;
        }
    }
}
