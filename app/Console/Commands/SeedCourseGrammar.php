<?php

namespace App\Console\Commands;

use App\Models\CourseStep;
use App\Services\CourseCatalog;
use Illuminate\Console\Command;

class SeedCourseGrammar extends Command
{
    protected $signature = 'course:seed-grammar';
    protected $description = 'Import grammar placeholders without overwriting edited course steps';
    public function handle(): int
    {
        $created = 0;
        foreach (CourseCatalog::grammar() as $index => $table) {
            $step = CourseStep::firstOrCreate(['seed_key' => 'grammar:'.$table['id']], [
                'title' => $table['title'], 'level' => in_array($table['level'], ['A1', 'A2', 'B1', 'B2']) ? $table['level'] : 'A1',
                'kind' => 'grammar', 'grammar_table_id' => $table['id'], 'learn_lang' => 'lv',
                'position' => ($index + 1) * 10, 'is_published' => true,
            ]);
            if ($step->wasRecentlyCreated) ++$created;
        }
        $this->info("Created {$created} grammar steps.");
        return self::SUCCESS;
    }
}
