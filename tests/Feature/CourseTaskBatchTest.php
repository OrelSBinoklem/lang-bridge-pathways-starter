<?php

namespace Tests\Feature;

use App\Models\LessonBlockVariant;
use App\Models\LessonPage;
use App\Services\TutorCategoryVocabularyContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CourseTaskBatchTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Http::fake();
        Schema::create('users', fn ($t) => $t->id());
        Schema::create('dictionary_categories', function ($t) {
            $t->id();
            $t->string('name');
        });
        Schema::create('course_groups', function ($t) {
            $t->id();
            $t->integer('dictionary_id');
            $t->integer('category_id');
            $t->string('level');
            $t->string('learn_lang');
        });
        foreach (range(1796, 1800) as $id) {
            DB::table('dictionary_categories')->insert(['id' => $id, 'name' => 'B2 theme '.$id]);
            DB::table('course_groups')->insert(['id' => $id, 'category_id' => $id, 'dictionary_id' => 20, 'level' => 'B2', 'learn_lang' => 'lv']);
        }
        (require database_path('migrations/2026_09_11_000002_create_lesson_pages_table.php'))->up();
        (require database_path('migrations/2026_09_11_000003_create_lesson_blocks_table.php'))->up();
        (require database_path('migrations/2026_09_11_000005_create_lesson_block_completions_table.php'))->up();
        (require database_path('migrations/2026_09_22_000001_add_course_skill_lesson_framework.php'))->up();
        $this->mock(TutorCategoryVocabularyContext::class, function ($mock) {
            foreach (range(1796, 1800) as $id) {
                $audit = json_decode(file_get_contents(resource_path("course/vocabulary-{$id}-b2.json")), true, 512, JSON_THROW_ON_ERROR);
                $mock->shouldReceive('build')->with($id, 20)->andReturn(['current_words' => array_map(fn ($wordId) => ['id' => $wordId], $audit['current_word_ids'])]);
            }
        });
    }

    public function test_dry_run_then_idempotent_b2_import_publishes_only_text_skills(): void
    {
        $args = ['--level' => ['B2']];
        $this->artisan('course:import-task-batch', $args)->assertExitCode(0);
        $this->assertSame(0, LessonPage::count());
        $this->artisan('course:import-task-batch', [...$args, '--write' => true, '--publish' => true])->assertExitCode(0);
        $this->assertSame(20, LessonPage::count());
        $this->assertSame(200, LessonBlockVariant::count());
        $this->assertSame(15, LessonPage::where('is_published', true)->count());
        $this->assertSame(175, LessonBlockVariant::where('is_published', true)->count());
        $this->assertSame(0, LessonPage::where('skill', 'listening')->where('is_published', true)->count());
        $snapshot = LessonBlockVariant::orderBy('id')->get()->map->getAttributes()->all();
        $this->travel(2)->minutes();
        $this->artisan('course:import-task-batch', [...$args, '--write' => true, '--publish' => true])->assertExitCode(0);
        $this->assertSame($snapshot, LessonBlockVariant::orderBy('id')->get()->map->getAttributes()->all());
        Http::assertNothingSent();
    }

    public function test_conflict_in_last_theme_rolls_back_publication_of_all_earlier_themes(): void
    {
        $args = ['--level' => ['B2']];
        $this->artisan('course:import-task-batch', [...$args, '--write' => true])->assertExitCode(0);
        $variant = LessonBlockVariant::whereHas('block.page', fn ($q) => $q->where('course_group_id', 1800)->where('skill', 'speaking'))->firstOrFail();
        $variant->update(['config' => ['instruction' => 'Manual editor content']]);
        $this->artisan('course:import-task-batch', [...$args, '--publish' => true])->assertExitCode(1);
        $this->assertSame(0, LessonPage::where('is_published', true)->count());
        $this->assertSame(0, LessonBlockVariant::where('is_published', true)->count());
        $this->assertSame(['instruction' => 'Manual editor content'], $variant->fresh()->config);
        Http::assertNothingSent();
    }
}
