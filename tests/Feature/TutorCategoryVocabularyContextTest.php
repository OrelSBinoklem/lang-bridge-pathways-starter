<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\TutorCategoryVocabularyController;
use App\Services\TaskGeneration\UserVocabularyProgressContext;
use App\Services\TutorCategoryVocabularyContext;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TutorCategoryVocabularyContextTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('users', function ($table) {
            $table->id();
        });
        Schema::create('dictionaries', function ($table) {
            $table->id();
            $table->string('name')->nullable();
        });
        Schema::create('dictionary_categories', function ($table) {
            $table->id();
            $table->integer('dictionary_id');
            $table->integer('parent_id')->nullable();
            $table->string('name');
            $table->integer('order')->default(0);
        });
        Schema::create('dictionary_words', function ($table) {
            $table->id();
            $table->integer('dictionary_id');
            $table->string('word');
            $table->string('learn_lang')->default('lv');
            $table->boolean('is_phrase')->default(false);
            $table->string('translation_1')->nullable();
            $table->string('translation_2')->nullable();
            $table->string('translation_3')->nullable();
            $table->string('translation_input_variable')->nullable();
            $table->string('difficult_translation')->nullable();
            $table->text('info')->nullable();
            $table->string('type')->nullable();
            $table->string('gender')->nullable();
            $table->integer('order')->default(0);
        });
        Schema::create('dictionary_word_category', function ($table) {
            $table->integer('word_id');
            $table->integer('category_id');
        });
        Schema::create('user_dictionary_words', function ($table) {
            $table->id();
            $table->integer('user_id');
            $table->integer('dict_word_id');
            $table->integer('attempts')->default(0);
            $table->integer('correct_attempts')->default(0);
            $table->integer('attempts_revert')->default(0);
            $table->integer('correct_attempts_revert')->default(0);
        });
        (require database_path('migrations/2026_09_09_000002_create_course_steps.php'))->up();
        (require database_path('migrations/2026_09_11_000001_create_course_groups.php'))->up();

        DB::table('users')->insert(['id' => 99]);
        DB::table('dictionaries')->insert(['id' => 1, 'name' => 'Latvian']);
        DB::table('dictionary_categories')->insert([
            ['id' => 1, 'dictionary_id' => 1, 'parent_id' => null, 'name' => 'A1', 'order' => 1],
            ['id' => 2, 'dictionary_id' => 1, 'parent_id' => 1, 'name' => 'Greetings', 'order' => 2],
            ['id' => 3, 'dictionary_id' => 1, 'parent_id' => 2, 'name' => 'At a cafe', 'order' => 3],
            ['id' => 4, 'dictionary_id' => 1, 'parent_id' => 1, 'name' => 'Directions', 'order' => 4],
        ]);
        DB::table('dictionary_words')->insert([
            ['id' => 10, 'dictionary_id' => 1, 'word' => 'labdien', 'translation_1' => 'здравствуйте', 'order' => 1],
            ['id' => 11, 'dictionary_id' => 1, 'word' => 'kafija', 'translation_1' => 'кофе', 'order' => 2],
            ['id' => 12, 'dictionary_id' => 1, 'word' => 'kur', 'translation_1' => 'где', 'order' => 3],
            ['id' => 13, 'dictionary_id' => 1, 'word' => 'lūdzu', 'translation_1' => 'пожалуйста', 'order' => 4],
        ]);
        DB::table('dictionary_word_category')->insert([
            ['word_id' => 10, 'category_id' => 2],
            ['word_id' => 11, 'category_id' => 3],
            ['word_id' => 13, 'category_id' => 2],
            ['word_id' => 12, 'category_id' => 4],
            ['word_id' => 13, 'category_id' => 4],
        ]);
        DB::table('user_dictionary_words')->insert([
            ['user_id' => 99, 'dict_word_id' => 10, 'attempts' => 2, 'correct_attempts' => 2, 'attempts_revert' => 2, 'correct_attempts_revert' => 2],
            ['user_id' => 99, 'dict_word_id' => 11, 'attempts' => 1, 'correct_attempts' => 1, 'attempts_revert' => 0, 'correct_attempts_revert' => 0],
            ['user_id' => 99, 'dict_word_id' => 12, 'attempts' => 2, 'correct_attempts' => 2, 'attempts_revert' => 1, 'correct_attempts_revert' => 1],
            ['user_id' => 99, 'dict_word_id' => 13, 'attempts' => 1, 'correct_attempts' => 0, 'attempts_revert' => 1, 'correct_attempts_revert' => 1],
        ]);
        DB::table('course_groups')->insert([
            ['id' => 1, 'dictionary_id' => 1, 'category_id' => 2, 'level' => 'A1', 'learn_lang' => 'lv', 'position' => 1, 'is_published' => true],
            ['id' => 2, 'dictionary_id' => 1, 'category_id' => 4, 'level' => 'A1', 'learn_lang' => 'lv', 'position' => 2, 'is_published' => true],
        ]);
        DB::table('course_steps')->insert([
            ['id' => 1, 'title' => 'Greetings', 'level' => 'A1', 'kind' => 'category', 'learn_lang' => 'lv', 'dictionary_id' => 1, 'category_id' => 2, 'group_id' => 1, 'position' => 1, 'is_published' => true],
            ['id' => 2, 'title' => 'Directions', 'level' => 'A1', 'kind' => 'category', 'learn_lang' => 'lv', 'dictionary_id' => 1, 'category_id' => 4, 'group_id' => 2, 'position' => 1, 'is_published' => true],
        ]);
    }

    public function test_it_returns_prior_course_vocabulary_and_current_category_words(): void
    {
        $request = Request::create('/api/tutor/category-vocabulary?category_id=4&dictionary_id=1');
        $response = (new TutorCategoryVocabularyController)->index($request, new TutorCategoryVocabularyContext());
        $data = $response->getData(true)['data'];

        $this->assertSame('course', $data['sequence_source']);
        $this->assertSame(['A1', 'Directions'], $data['current_category']['path']);
        $this->assertSame([2], array_column($data['previous_categories'], 'id'));
        $this->assertSame([10, 11, 13], array_column($data['prior_words'], 'id'));
        $this->assertSame([12, 13], array_column($data['current_words'], 'id'));
        $this->assertSame([13], $data['current_word_ids_seen_before']);
        $this->assertSame(1, $data['counts']['current_words_seen_before']);
    }

    public function test_task_generator_progress_distinguishes_started_and_fully_learned_words(): void
    {
        $data = (new UserVocabularyProgressContext)->build(99, 1);

        $this->assertSame(4, $data['counts']['words_with_score']);
        $this->assertSame(1, $data['counts']['learned_words']);
        $this->assertSame([10], array_column($data['learned_words'], 'id'));
        $this->assertSame([10, 11, 12, 13], array_column($data['words_with_score'], 'id'));
        $this->assertTrue($data['words_with_score'][0]['progress']['is_fully_learned']);
        $this->assertFalse($data['words_with_score'][2]['progress']['is_fully_learned']);

        $categoryData = (new UserVocabularyProgressContext)->build(99, 1, 4);
        $this->assertSame([12, 13], array_column($categoryData['words_with_score'], 'id'));
        $this->assertSame([], $categoryData['learned_words']);
    }

    public function test_learned_categories_include_descendants_but_not_empty_categories_or_other_users(): void
    {
        $service = new UserVocabularyProgressContext;
        $this->assertSame([], $service->build(99, 1)['learned_categories']);
        DB::table('user_dictionary_words')->where('user_id', 99)->whereIn('dict_word_id', [11, 13])
            ->update(['correct_attempts' => 2, 'correct_attempts_revert' => 2]);
        DB::table('dictionary_categories')->insert(['id' => 5, 'dictionary_id' => 1, 'name' => 'Empty']);
        DB::table('dictionary_word_category')->insert(['word_id' => 10, 'category_id' => 3]);
        $this->assertSame([2, 3], array_column($service->build(99, 1)['learned_categories'], 'id'));
        $this->assertSame(3, $service->build(99, 1)['learned_categories'][0]['unique_words']);
        DB::table('users')->insert(['id' => 100]);
        $this->assertSame([], $service->build(100, 1)['learned_words']);
        $this->assertSame([], $service->build(100, 1)['learned_categories']);
    }

    public function test_context_cli_requires_explicit_personal_or_shared_mode(): void
    {
        $this->artisan('task-generator:context', ['category_id' => 4])->assertExitCode(2);
        $this->artisan('task-generator:context', ['category_id' => 4, '--shared' => true, '--user_id' => 99])->assertExitCode(2);
        $this->artisan('task-generator:context', ['category_id' => 4, '--shared' => true, '--compact' => true,
            '--elaipa-level' => 'A1', '--elaipa-topic' => '3. Pilsētā un laukos'])->assertExitCode(0);
    }

    public function test_listening_import_is_dry_by_default_idempotent_and_preserves_editor_changes(): void
    {
        (require database_path('migrations/2026_09_11_000002_create_lesson_pages_table.php'))->up();
        (require database_path('migrations/2026_09_11_000003_create_lesson_blocks_table.php'))->up();
        (require database_path('migrations/2026_09_11_000005_create_lesson_block_completions_table.php'))->up();
        (require database_path('migrations/2026_09_22_000001_add_course_skill_lesson_framework.php'))->up();
        DB::table('dictionaries')->insert(['id' => 20, 'name' => 'Course']);
        DB::table('dictionary_categories')->insert(['id' => 1765, 'dictionary_id' => 20, 'name' => 'Town']);
        DB::table('course_groups')->insert(['id' => 9, 'dictionary_id' => 20, 'category_id' => 1765, 'level' => 'A1', 'learn_lang' => 'lv']);
        foreach (range(73148, 73173) as $id) {
            DB::table('dictionary_words')->insert(['id' => $id, 'dictionary_id' => 20, 'word' => 'word'.$id]);
            DB::table('dictionary_word_category')->insert(['word_id' => $id, 'category_id' => 1765]);
        }
        $args = ['file' => resource_path('course/listening-1765-a1.json')];
        $this->artisan('course:import-listening', $args)->assertExitCode(0);
        $this->assertSame(0, \App\Models\LessonPage::count());
        $this->artisan('course:import-listening', [...$args, '--write' => true])->assertExitCode(0);
        $this->artisan('course:import-listening', [...$args, '--write' => true])->assertExitCode(0);
        $this->assertSame(1, \App\Models\LessonPage::count());
        $this->assertSame(5, \App\Models\LessonBlockVariant::count());
        \Illuminate\Support\Facades\Http::fake();
        $this->artisan('course:generate-listening-audio', ['--group' => 1765, '--max-characters' => 1,
            '--voice-a' => 'test-male', '--voice-b' => 'test-female'])->assertExitCode(1);
        \Illuminate\Support\Facades\Http::assertNothingSent();
        $this->artisan('course:import-listening', [...$args, '--publish' => true])->assertExitCode(1);
        $this->assertFalse(\App\Models\LessonPage::first()->is_published);
        $variant = \App\Models\LessonBlockVariant::first();
        $config = $variant->config;
        $config['transcript'] = 'Editor transcript';
        $variant->update(['config' => $config]);
        $this->artisan('course:import-listening', [...$args, '--write' => true])->assertExitCode(1);
        $this->assertSame('Editor transcript', $variant->fresh()->config['transcript']);
    }
}
