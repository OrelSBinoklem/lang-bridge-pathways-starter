<?php

namespace App\Console\Commands;

use App\Models\CourseGroup;
use App\Models\LessonPage;
use App\Services\TaskGeneration\ListeningDraft;
use App\Services\TutorCategoryVocabularyContext;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ImportCourseListening extends Command
{
    protected $signature = 'course:import-listening {file : Authored JSON package}
        {--write : Create missing drafts, never overwrite existing content}
        {--publish : Publish matching drafts only after all five audio files exist}';

    protected $description = 'Validate and safely import a five-variant listening package';

    public function handle(ListeningDraft $validator, TutorCategoryVocabularyContext $vocabulary): int
    {
        try {
            $path = realpath($this->argument('file'));
            if (!$path || !is_file($path)) throw new RuntimeException('Package not found.');
            $draft = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
            $categoryId = $draft['category_id'] ?? 0;
            $dictionaryId = $draft['dictionary_id'] ?? 0;
            if (!is_int($categoryId) || $categoryId < 1 || !is_int($dictionaryId) || $dictionaryId < 1) throw new RuntimeException('Invalid category/dictionary ID.');
            $group = CourseGroup::where('category_id', $categoryId)->where('dictionary_id', $dictionaryId)->sole();
            if ($group->level !== ($draft['level'] ?? null) || $group->learn_lang !== 'lv') throw new RuntimeException('Course level/language mismatch.');
            $context = $vocabulary->build($categoryId, $dictionaryId);
            $validator->validate($draft, array_column($context['current_words'], 'id'));
            $characters = array_sum(array_map(fn ($v) => array_sum(array_map(fn ($s) => mb_strlen(trim($s[1])), $v['segments'])), $draft['variants']));
            $questionCount = array_sum(array_map(fn ($variant) => count($variant['questions']), $draft['variants']));
            $this->info("Category {$categoryId}: 5 variants, {$questionCount} questions, {$characters} spoken characters.");
            if (!$this->option('write') && !$this->option('publish')) return self::SUCCESS;

            DB::transaction(function () use ($draft, $group, $validator, $categoryId, $path) {
                $seed = "course-listening:{$categoryId}";
                $page = LessonPage::where('seed_key', $seed)->lockForUpdate()->first();
                if (!$page) {
                    if (!$this->option('write')) throw new RuntimeException('Import with --write before publishing.');
                    if ($group->lessonPages()->where('skill', 'listening')->exists()) throw new RuntimeException('This group already has a listening lesson; review it manually.');
                    $page = LessonPage::create([
                        'seed_key' => $seed, 'course_group_id' => $group->id,
                        'title' => $group->display_title.' - Слушанье: проверь, что услышал',
                        'slug' => "course-{$categoryId}-listening", 'skill' => 'listening',
                        'level' => $group->level, 'learn_lang' => 'lv', 'status' => 'draft', 'is_published' => false,
                        'description' => 'Пять диалогов по теме.',
                    ]);
                }
                if ((int) $page->course_group_id !== (int) $group->id || $page->skill !== 'listening') throw new RuntimeException('Existing lesson ownership changed; review manually.');
                $block = $page->blocks()->firstOrCreate(['seed_key' => $seed.':binary'], [
                    'type' => 'listening', 'title' => 'Пойми аудиотекст', 'position' => 10,
                    'is_required' => true, 'weight' => 100, 'config' => [],
                ]);
                if ($block->type !== 'listening' || $page->blocks()->count() !== 1) throw new RuntimeException('Lesson structure changed; review manually.');
                foreach ($draft['variants'] as $index => $source) {
                    $core = $validator->config($source);
                    $variant = $block->variants()->firstOrCreate(['seed_key' => 'variant:'.($index + 1)], [
                        'title' => 'Вариант '.($index + 1).': '.$source['title'], 'position' => ($index + 1) * 10,
                        'config' => [...$core, 'audio_url' => null, 'authoring' => ['source_sha256' => hash_file('sha256', $path), 'target_word_ids' => $source['target_word_ids']]],
                        'is_published' => false,
                    ]);
                    foreach ($core as $key => $value) {
                        if (($variant->config[$key] ?? null) !== $value) throw new RuntimeException("Variant {$variant->id} differs from the package; no editor content overwritten.");
                    }
                    if ($this->option('publish')) {
                        $url = $variant->config['audio_url'] ?? '';
                        if (!preg_match('#^/audio/course/listening/[0-9]+-[0-9]+-[a-f0-9]{16}\.mp3$#D', $url) || !is_file(base_path('frontend/public'.$url)) || filesize(base_path('frontend/public'.$url)) < 1000) throw new RuntimeException("Variant {$variant->id} has no verified local audio file.");
                        $audio = $variant->config['audio_generation'] ?? [];
                        $inputs = array_map(fn ($segment) => ['text' => trim($segment['text']), 'voice_id' => $audio['voice_ids'][$segment['speaker']] ?? null], $core['dialogue_segments']);
                        $hash = hash('sha256', json_encode([$audio['model'] ?? null, 'lv', $inputs], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
                        if (($audio['sha256'] ?? null) !== $hash || !str_ends_with($url, substr($hash, 0, 16).'.mp3')) throw new RuntimeException("Variant {$variant->id}: audio does not match current dialogue/voices.");
                        $variant->update(['is_published' => true]);
                    }
                }
                if ($block->variants()->count() !== 5) throw new RuntimeException('Existing variant count changed; review manually.');
                if ($this->option('publish')) $page->update(['status' => 'published', 'is_published' => true]);
                $this->info('Lesson: '.$page->slug);
            });
            $this->info($this->option('publish') ? 'Published in the configured database.' : 'Drafts imported; existing content preserved.');
            return self::SUCCESS;
        } catch (\JsonException|\RuntimeException $exception) {
            $this->error($exception->getMessage());
            return self::FAILURE;
        }
    }
}
