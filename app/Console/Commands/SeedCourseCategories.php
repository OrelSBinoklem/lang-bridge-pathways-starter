<?php

namespace App\Console\Commands;

use App\Models\CourseStep;
use App\Models\Dictionary;
use App\Models\DictionaryCategory;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SeedCourseCategories extends Command
{
    protected $signature = 'course:seed-categories {dictionary=20}';
    protected $description = 'Add second-level course categories without overwriting existing steps';

    public function handle(): int
    {
        $dictionary = Dictionary::findOrFail((int) $this->argument('dictionary'));
        $categories = DictionaryCategory::where('dictionary_id', $dictionary->id)->orderBy('order')->orderBy('id')->get();
        $roots = $categories->whereNull('parent_id')->keyBy('id');
        $candidates = [];
        foreach ($categories as $category) {
            $root = $roots->get($category->parent_id);
            if ($root && preg_match('/\b(A1|A2|B1|B2)\b/i', $root->name, $matches)) {
                $candidates[] = [$category, strtoupper($matches[1])];
            }
        }
        if (!$candidates) {
            $this->error('No second-level categories under A1-B2 found. Nothing changed.');
            return self::FAILURE;
        }
        $created = DB::transaction(function () use ($candidates, $dictionary) {
            $created = 0;
            $positions = [];
            foreach ($candidates as [$category, $level]) {
                if (CourseStep::where('kind', 'category')->where('dictionary_id', $dictionary->id)->where('category_id', $category->id)->exists()) continue;
                $positions[$level] ??= (int) CourseStep::where('learn_lang', strtolower($dictionary->learn_lang))->where('level', $level)->max('position');
                $positions[$level] += 10;
                $step = CourseStep::firstOrCreate(['seed_key' => "category:{$dictionary->id}:{$category->id}"], [
                    'title' => $category->name, 'level' => $level, 'kind' => 'category',
                    'dictionary_id' => $dictionary->id, 'category_id' => $category->id,
                    'position' => $positions[$level], 'is_published' => true,
                ]);
                if ($step->wasRecentlyCreated) ++$created;
            }
            return $created;
        });
        $this->info("Created {$created} category steps.");
        return self::SUCCESS;
    }
}
