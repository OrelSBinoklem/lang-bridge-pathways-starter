<?php

namespace App\Console\Commands;

use App\Models\CourseGroup;
use App\Models\CourseStep;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;

class SeedCourseGroups extends Command
{
    protected $signature = 'course:seed-groups';
    protected $description = 'Create author dictionary groups and assign existing steps once';
    public function handle(): int
    {
        // Explicit editorial mapping; only original seeded grammar is assigned, never admin-created steps.
        $mapping = json_decode(file_get_contents(resource_path('course/grammar-groups.json')), true, 512, JSON_THROW_ON_ERROR);
        DB::transaction(function () use ($mapping) {
            foreach (CourseStep::where('kind', 'category')->where('dictionary_id', 20)->orderBy('position')->get() as $step) {
                $group = CourseGroup::firstOrCreate(['seed_key' => 'category:20:'.$step->category_id], [
                    'dictionary_id' => 20, 'category_id' => $step->category_id, 'level' => $step->level,
                    'position' => $step->position, 'is_published' => true,
                ]);
                if ($group->wasRecentlyCreated && !$step->group_id) $step->update(['group_id' => $group->id, 'position' => 10]);
            }
            $intro = CourseGroup::firstOrCreate(['seed_key' => 'introduction:lv:A1'], [
                'title' => 'Введение', 'level' => 'A1', 'learn_lang' => 'lv', 'position' => 0, 'is_published' => true,
            ]);
            foreach ($mapping as $categoryId => $tableIds) {
                $group = $categoryId === 'intro' ? $intro : CourseGroup::where('seed_key', 'category:20:'.$categoryId)->first();
                if (!$group) continue;
                foreach ($tableIds as $index => $id) {
                    $step = CourseStep::where('seed_key', 'grammar:'.$id)->first();
                    // Marker makes repeated imports respect manual ungrouping as well as moves.
                    if (!$step || $step->group_id || $step->group_seeded || $step->level !== $group->level) continue;
                    $step->update(['group_id' => $group->id, 'position' => 20 + $index * 10, 'group_seeded' => true]);
                }
            }
        });
        $this->info('Course groups imported. Existing assignments preserved.');
        return self::SUCCESS;
    }
}
