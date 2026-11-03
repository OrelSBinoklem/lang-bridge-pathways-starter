<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\CourseController;
use App\Models\CourseStep;
use App\Models\LessonBlock;
use App\Models\LessonBlockCompletion;
use App\Models\LessonBlockProgress;
use App\Models\LessonPage;
use App\Services\CourseCatalog;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class CoursePathTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('users', fn ($t) => $t->id());
        Schema::create('dictionaries', function ($t) { $t->id(); $t->string('learn_lang'); });
        Schema::create('dictionary_categories', function ($t) { $t->id(); $t->integer('dictionary_id'); $t->integer('parent_id')->nullable(); $t->string('name'); $t->integer('order')->default(0); });
        Schema::create('dictionary_words', function ($t) { $t->id(); $t->integer('dictionary_id'); });
        Schema::create('dictionary_word_category', function ($t) { $t->integer('word_id'); $t->integer('category_id'); });
        Schema::create('user_dictionary_words', function ($t) { $t->integer('user_id'); $t->integer('dict_word_id'); $t->integer('correct_attempts'); $t->integer('correct_attempts_revert'); });
        (require database_path('migrations/2026_09_09_000002_create_course_steps.php'))->up();
        (require database_path('migrations/2026_09_11_000001_create_course_groups.php'))->up();
        (require database_path('migrations/2026_09_11_000004_add_custom_component_to_course_steps.php'))->up();
        (require database_path('migrations/2026_09_11_000002_create_lesson_pages_table.php'))->up();
        (require database_path('migrations/2026_09_11_000003_create_lesson_blocks_table.php'))->up();
        (require database_path('migrations/2026_09_11_000005_create_lesson_block_completions_table.php'))->up();
        (require database_path('migrations/2026_09_22_000001_add_course_skill_lesson_framework.php'))->up();
        (require database_path('migrations/2026_09_29_000001_create_lesson_block_responses_table.php'))->up();
        (require database_path('migrations/2026_10_01_000001_add_grammar_stage_references.php'))->up();
        DB::table('dictionaries')->insert(['id'=>1,'learn_lang'=>'lv']);
        foreach ([1=>null, 2=>1, 3=>2, 4=>3] as $id=>$parent) DB::table('dictionary_categories')->insert(['id'=>$id,'dictionary_id'=>1,'parent_id'=>$parent,'name'=>'Category '.$id]);
    }

    public function test_only_depth_two_and_three_categories_are_allowed(): void
    {
        $this->assertSame([2,3], array_keys(CourseCatalog::categoryOptions(1)));
        $this->expectException(ValidationException::class);
        CourseStep::create(['title'=>'Invalid','level'=>'A1','kind'=>'category','dictionary_id'=>1,'category_id'=>1]);
    }

    public function test_level_passes_at_eighty_percent_and_perfect_requires_all_categories(): void
    {
        for ($i = 10; $i < 15; ++$i) {
            DB::table('dictionary_categories')->insert(['id'=>$i,'dictionary_id'=>1,'parent_id'=>1,'name'=>'Category '.$i]);
            CourseStep::create(['title'=>'Words '.$i,'level'=>'A1','kind'=>'category','dictionary_id'=>1,'category_id'=>$i,'position'=>$i]);
            DB::table('dictionary_words')->insert(['id'=>$i,'dictionary_id'=>1]);
            DB::table('dictionary_word_category')->insert(['word_id'=>$i,'category_id'=>$i]);
            DB::table('user_dictionary_words')->insert(['user_id'=>5,'dict_word_id'=>$i,'correct_attempts'=>$i < 13 ? 2 : 0,'correct_attempts_revert'=>2]);
        }
        CourseStep::create(['title'=>'Next','level'=>'A2','kind'=>'grammar','grammar_table_id'=>'13']);
        $request = Request::create('/api/course');
        $request->setUserResolver(fn () => (object)['id'=>5]);
        $read = fn () => (new CourseController)->index($request)->getData(true)['data'];
        $this->assertSame('active', $read()[0]['status']);
        $this->assertSame('locked', $read()[1]['status']);
        DB::table('user_dictionary_words')->where('dict_word_id',13)->update(['correct_attempts'=>2]);
        $result = $read();
        $this->assertSame('completed', $result[0]['status']);
        $this->assertFalse($result[0]['perfect']);
        $this->assertSame('active', $result[1]['status']);
        $this->assertSame('active', $result[1]['steps'][0]['status']);
        DB::table('user_dictionary_words')->where('dict_word_id',14)->update(['correct_attempts'=>2]);
        $this->assertTrue($read()[0]['perfect']);
        $this->assertFalse($read()[1]['perfect']);
    }

    public function test_progress_includes_descendants_deduplicates_words_and_is_user_scoped(): void
    {
        CourseStep::create(['title'=>'Words','level'=>'A1','kind'=>'category','dictionary_id'=>1,'category_id'=>2,'position'=>10]);
        CourseStep::create(['title'=>'Alphabet','level'=>'A1','kind'=>'grammar','grammar_table_id'=>'0','position'=>20]);
        CourseStep::create(['title'=>'Next','level'=>'A2','kind'=>'grammar','grammar_table_id'=>'1']);
        DB::table('dictionary_words')->insert(['id'=>1,'dictionary_id'=>1]);
        DB::table('dictionary_word_category')->insert([['word_id'=>1,'category_id'=>2],['word_id'=>1,'category_id'=>3]]);
        DB::table('user_dictionary_words')->insert(['user_id'=>5,'dict_word_id'=>1,'correct_attempts'=>2,'correct_attempts_revert'=>2]);
        $request = Request::create('/api/course');
        $request->setUserResolver(fn () => (object)['id'=>5]);
        $result = (new CourseController)->index($request)->getData(true)['data'];
        $this->assertSame(1, $result[0]['steps'][0]['total_words']);
        $this->assertSame('completed', $result[0]['steps'][0]['status']);
        $this->assertSame('active', $result[0]['steps'][1]['status']);
        $this->assertSame('active', $result[1]['steps'][0]['status']);
        $request->setUserResolver(fn () => (object)['id'=>6]);
        $other = (new CourseController)->index($request)->getData(true)['data'];
        $this->assertSame(0, $other[0]['steps'][0]['learned_words']);
        $this->assertSame('locked', $other[1]['steps'][0]['status']);
    }

    public function test_grammar_import_is_idempotent_and_preserves_edits(): void
    {
        $this->artisan('course:seed-grammar')->assertSuccessful();
        $step = CourseStep::first();
        $step->update(['title'=>'Edited title']);
        $this->artisan('course:seed-grammar')->assertSuccessful();
        $this->assertSame(count(CourseCatalog::grammar()), CourseStep::count());
        $this->assertSame('Edited title', $step->fresh()->title);
    }

    public function test_category_import_only_adds_second_level_and_preserves_edits(): void
    {
        DB::table('dictionary_categories')->where('id', 1)->update(['name' => 'A1']);
        $this->artisan('course:seed-categories', ['dictionary' => 1])->assertSuccessful();
        $step = CourseStep::sole();
        $this->assertSame(2, (int) $step->category_id);
        $this->assertSame('A1', $step->level);
        $step->update(['title' => 'Edited', 'position' => 123, 'is_published' => false]);
        $this->artisan('course:seed-categories', ['dictionary' => 1])->assertSuccessful();
        $this->assertSame(1, CourseStep::count());
        $this->assertSame('Edited', $step->fresh()->title);
        $this->assertSame(123, $step->fresh()->position);
        $this->assertFalse($step->fresh()->is_published);
    }

    public function test_groups_control_order_visibility_and_keep_progress(): void
    {
        $later = \App\Models\CourseGroup::create(['title'=>'Later','level'=>'A1','position'=>20]);
        $first = \App\Models\CourseGroup::create(['dictionary_id'=>1,'category_id'=>2,'level'=>'A1','position'=>10]);
        $hidden = \App\Models\CourseGroup::create(['title'=>'Hidden','level'=>'A1','is_published'=>false]);
        CourseStep::create(['title'=>'Later','level'=>'A1','kind'=>'grammar','grammar_table_id'=>'0','group_id'=>$later->id,'position'=>1]);
        $words = CourseStep::create(['title'=>'Words','level'=>'A1','kind'=>'category','dictionary_id'=>1,'category_id'=>2,'group_id'=>$first->id,'position'=>100]);
        CourseStep::create(['title'=>'Hidden','level'=>'A1','kind'=>'grammar','grammar_table_id'=>'1','group_id'=>$hidden->id]);
        $result = (new CourseController)->index(Request::create('/api/course'))->getData(true)['data'][0];
        $this->assertSame(['Words','Later'], array_column($result['steps'], 'title'));
        $this->assertSame('Category 2', $result['groups'][0]['title']);
        $this->assertSame(1, $result['groups'][0]['total']);
        $first->update(['level'=>'A2']);
        $this->assertSame('A2', $words->fresh()->level);
        $first->delete();
        $this->assertNull($words->fresh()->group_id);
    }

    public function test_group_import_preserves_manual_moves_and_does_not_duplicate_grammar(): void
    {
        DB::table('dictionaries')->insert(['id'=>20,'learn_lang'=>'lv']);
        DB::table('dictionary_categories')->insert([
            ['id'=>1762,'dictionary_id'=>20,'parent_id'=>null,'name'=>'A1'],
            ['id'=>1763,'dictionary_id'=>20,'parent_id'=>1762,'name'=>'Hello'],
        ]);
        $this->artisan('course:seed-categories', ['dictionary'=>20])->assertSuccessful();
        $this->artisan('course:seed-grammar')->assertSuccessful();
        $this->artisan('course:seed-groups')->assertSuccessful();
        $grammar = CourseStep::where('seed_key','grammar:90')->firstOrFail();
        $this->assertNotNull($grammar->group_id);
        $grammar->update(['group_id'=>null,'title'=>'Edited']);
        $count = CourseStep::count();
        $this->artisan('course:seed-groups')->assertSuccessful();
        $this->artisan('course:seed-grammar')->assertSuccessful();
        $this->assertSame($count, CourseStep::count());
        $this->assertNull($grammar->fresh()->group_id);
        $this->assertSame('Edited', $grammar->fresh()->title);
    }

    public function test_course_skills_return_private_block_summary_without_changing_category_unlocks(): void
    {
        DB::table('users')->insert([['id' => 5], ['id' => 6]]);
        $group = \App\Models\CourseGroup::create(['title' => 'Навык', 'level' => 'A1', 'position' => 1]);
        $page = LessonPage::create(['course_group_id' => $group->id, 'skill' => 'listening', 'status' => 'published',
            'title' => 'Слушанье', 'slug' => 'listen-skill', 'level' => 'A1', 'is_published' => true]);
        $block = LessonBlock::create(['lesson_page_id' => $page->id, 'type' => 'listening', 'is_required' => true]);
        LessonBlockProgress::create(['user_id' => 5, 'lesson_block_id' => $block->id, 'best_score' => 90, 'best_rank' => 'gold']);
        LessonBlockCompletion::create(['user_id' => 5, 'lesson_block_id' => $block->id, 'completed_at' => now()]);

        $request = Request::create('/api/course');
        $request->setUserResolver(fn () => (object) ['id' => 5]);
        $mine = (new CourseController)->index($request)->getData(true)['data'][0];
        $this->assertSame([
            'completed' => true, 'passed' => 1, 'total' => 1, 'best_score' => 90, 'best_rank' => 'gold',
            'additional_variants' => 0,
            'practice_rounds' => [['passed' => 1, 'total' => 1], ['passed' => 0, 'total' => 1], ['passed' => 0, 'total' => 1]],
        ], $mine['groups'][0]['skills']['listening']['progress']);
        $this->assertSame('active', $mine['status']);

        $request->setUserResolver(fn () => (object) ['id' => 6]);
        $other = (new CourseController)->index($request)->getData(true)['data'][0];
        $this->assertFalse($other['groups'][0]['skills']['listening']['progress']['completed']);
        $this->assertNull($other['groups'][0]['skills']['listening']['progress']['best_score']);
        $this->assertSame(
            array_fill(0, 3, ['passed' => 0, 'total' => 1]),
            $other['groups'][0]['skills']['listening']['progress']['practice_rounds'],
        );
    }
}
