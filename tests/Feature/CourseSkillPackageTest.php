<?php

namespace Tests\Feature;

use App\Models\LessonBlockVariant;
use App\Models\LessonPage;
use App\Services\TaskGeneration\CourseSkillDraft;
use App\Services\TutorCategoryVocabularyContext;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CourseSkillPackageTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
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
        DB::table('dictionary_categories')->insert(['id' => 1765, 'name' => '3. В городе и в деревне']);
        DB::table('course_groups')->insert(['id' => 9, 'category_id' => 1765, 'dictionary_id' => 20, 'level' => 'A1', 'learn_lang' => 'lv']);
        (require database_path('migrations/2026_09_11_000002_create_lesson_pages_table.php'))->up();
        (require database_path('migrations/2026_09_11_000003_create_lesson_blocks_table.php'))->up();
        (require database_path('migrations/2026_09_11_000005_create_lesson_block_completions_table.php'))->up();
        (require database_path('migrations/2026_09_22_000001_add_course_skill_lesson_framework.php'))->up();
        $this->mock(TutorCategoryVocabularyContext::class, function ($mock) {
            $mock->shouldReceive('build')->with(1765, 20)->andReturn(['current_words' => array_map(fn ($id) => ['id' => $id], range(73148, 73173))]);
        });
    }

    public function test_authored_package_covers_every_missing_task_with_five_variants(): void
    {
        $draft = json_decode(file_get_contents(resource_path('course/skills-1765-a1.json')), true, 512, JSON_THROW_ON_ERROR);
        $builder = new CourseSkillDraft;
        $builder->validate($draft, range(73148, 73173));
        $pages = $builder->pages($draft);
        $this->assertSame(['reading', 'writing', 'speaking'], array_keys($pages));
        $this->assertCount(2, $pages['reading']['blocks']);
        $this->assertCount(3, $pages['writing']['blocks']);
        $this->assertCount(2, $pages['speaking']['blocks']);
        foreach ($pages as $skill => $page) {
            foreach ($page['blocks'] as $block) {
                $this->assertCount(5, $block['variants']);
                if ($skill !== 'reading') {
                    $this->assertNotEmpty($block['bot_prompt']);
                    foreach ($block['variants'] as $variant) {
                        $this->assertNotEmpty($variant['config']['instruction']);
                        $this->assertNotEmpty($variant['config']['tutor_prompt']);
                    }
                }
            }
        }
        $draft['variants'][0]['reading']['questions'][0][1] = false;
        $this->expectException(\RuntimeException::class);
        $builder->validate($draft, range(73148, 73173));
    }

    public function test_short_authored_reading_is_valid_without_a_padding_minimum(): void
    {
        $draft = json_decode(file_get_contents(resource_path('course/skills-1765-a1.json')), true, 512, JSON_THROW_ON_ERROR);
        foreach ($draft['variants'] as &$variant) {
            $variant['reading']['text'] = 'Labdien! Mani sauc Anna.';
            $variant['reading']['questions'] = array_map(fn ($i) => ['Statement '.$i, $i % 2 === 0, 'Evidence'], range(0, 4));
        }
        unset($variant);
        $builder = new CourseSkillDraft;
        $builder->validate($draft, range(73148, 73173));
        $this->assertCount(5, $builder->pages($draft)['reading']['blocks'][0]['variants'][0]['config']['questions']);
    }

    public function test_import_preserves_listening_and_is_idempotent(): void
    {
        $listening = LessonPage::create(['title' => 'Existing listening', 'slug' => 'course-1765-listening', 'course_group_id' => 9, 'skill' => 'listening', 'status' => 'published', 'is_published' => true]);
        $block = $listening->blocks()->create(['type' => 'listening', 'position' => 10, 'config' => []]);
        $audio = $block->variants()->create(['position' => 10, 'config' => ['audio_url' => '/already-paid.mp3'], 'is_published' => true]);
        $snapshot = $audio->fresh()->getAttributes();
        $args = ['file' => resource_path('course/skills-1765-a1.json')];
        $this->artisan('course:import-skill-package', $args)->assertExitCode(0);
        $this->assertSame(1, LessonPage::count());
        $this->artisan('course:import-skill-package', [...$args, '--write' => true])->assertExitCode(0);
        $this->artisan('course:import-skill-package', [...$args, '--write' => true])->assertExitCode(0);
        $this->assertSame(4, LessonPage::count());
        $this->assertSame(36, LessonBlockVariant::count());
        $this->assertSame(1, LessonPage::where('is_published', true)->count());
        $this->artisan('course:import-skill-package', [...$args, '--publish' => true])->assertExitCode(0);
        $this->assertSame(4, LessonPage::where('is_published', true)->count());
        $this->assertSame(36, LessonBlockVariant::where('is_published', true)->count());
        $this->assertSame($snapshot, $audio->fresh()->getAttributes());
    }

    public function test_editor_conflict_rolls_back_the_entire_publication(): void
    {
        $args = ['file' => resource_path('course/skills-1765-a1.json')];
        $this->artisan('course:import-skill-package', [...$args, '--write' => true])->assertExitCode(0);
        $variant = LessonBlockVariant::whereHas('block', fn ($q) => $q->where('type', 'speaking'))->firstOrFail();
        $variant->update(['config' => ['instruction' => 'Editor content']]);
        $this->artisan('course:import-skill-package', [...$args, '--publish' => true])->assertExitCode(1);
        $this->assertSame(0, LessonPage::where('is_published', true)->count());
        $this->assertSame(0, LessonBlockVariant::where('is_published', true)->count());
        $this->assertSame(['instruction' => 'Editor content'], $variant->fresh()->config);
    }
}
