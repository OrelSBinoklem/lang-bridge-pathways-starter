<?php

namespace Tests\Feature;

use App\Filament\Pages\ContentAudit;
use App\Filament\Widgets\ContentTopicChart;
use App\Models\DictionaryCategory;
use App\Models\LessonPage;
use App\Models\User;
use App\Http\Controllers\Api\Admin\CategoryVocabularyAuditController;
use Illuminate\Http\Request;
use App\Services\ContentAudit\AuthoredTextReference;
use App\Services\ContentAudit\CategoryVocabularyAudit;
use App\Services\ContentAudit\CourseContentAudit;
use App\Services\ContentAudit\CourseEditorialAudit;
use App\Services\ContentAudit\ElaipaTopicOccurrences;
use App\Services\TaskGeneration\CourseSkillDraft;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Livewire\Livewire;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class ContentAuditPageTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        config(['cache.stores.file' => ['driver' => 'array']]);
        Schema::create('users', fn ($t) => $t->id());
        Schema::create('course_groups', function ($t) {
            $t->id();
            $t->string('title');
            $t->string('level');
            $t->string('learn_lang');
            $t->integer('dictionary_id')->nullable();
            $t->integer('category_id')->nullable();
            $t->integer('position');
            $t->boolean('is_published');
        });
        Schema::create('dictionaries', function ($t) {
            $t->id();
            $t->string('name');
        });
        Schema::create('dictionary_categories', function ($t) {
            $t->id();
            $t->integer('dictionary_id');
            $t->integer('parent_id')->nullable();
            $t->string('name');
        });
        Schema::create('dictionary_words', function ($t) {
            $t->id();
            $t->integer('dictionary_id');
            $t->string('word');
            $t->string('learn_lang');
            $t->boolean('is_phrase')->default(false);
        });
        Schema::create('dictionary_word_category', function ($t) {
            $t->integer('word_id');
            $t->integer('category_id');
        });
        foreach (['2026_09_11_000002_create_lesson_pages_table', '2026_09_11_000003_create_lesson_blocks_table', '2026_09_22_000001_add_course_skill_lesson_framework', '2026_10_01_000001_add_grammar_stage_references'] as $migration) {
            (require database_path("migrations/$migration.php"))->up();
        }
        DB::table('dictionaries')->insert(['id' => 20, 'name' => 'Test']);
        DB::table('dictionary_categories')->insert([['id' => 40, 'dictionary_id' => 20, 'parent_id' => null, 'name' => 'A1'], ['id' => 41, 'dictionary_id' => 20, 'parent_id' => 40, 'name' => 'Tema'], ['id' => 42, 'dictionary_id' => 20, 'parent_id' => 41, 'name' => 'Child']]);
        DB::table('course_groups')->insert(['id' => 90, 'title' => 'Topic', 'level' => 'A1', 'learn_lang' => 'lv', 'dictionary_id' => 20, 'category_id' => 41, 'position' => 1, 'is_published' => true]);
        DB::table('dictionary_words')->insert(['id' => 1, 'dictionary_id' => 20, 'word' => 'darbs', 'learn_lang' => 'lv']);
        DB::table('dictionary_word_category')->insert(['word_id' => 1, 'category_id' => 42]);
        DB::table('users')->insert(['id' => 1]);
    }

    private function user(bool $admin): User
    {
        $user = \Mockery::mock(User::class)->makePartial();
        $user->id = 1;
        $user->name = 'Test admin';
        $user->shouldReceive('hasAnyRole')->andReturn($admin);
        $user->shouldReceive('canAccessPanel')->andReturn($admin);
        Auth::setUser($user);

        return $user;
    }

    private function fixture(): array
    {
        $page = LessonPage::create(['title' => 'Lexical test', 'slug' => 'audit-test', 'learn_lang' => 'lv', 'course_group_id' => 90, 'skill' => 'reading', 'level' => 'A1', 'status' => 'published', 'is_published' => true]);
        $block = $page->blocks()->create(['type' => 'reading', 'title' => 'Reading', 'position' => 0, 'config' => []]);
        $variant = $block->variants()->create(['title' => 'First', 'position' => 0, 'is_published' => true, 'config' => ['task_kind' => 'reading_binary', 'text' => 'Darbs darbā.']]);

        return [$page, $block, $variant];
    }

    public function test_report_reads_db_and_descendants_without_changing_content(): void
    {
        [$page,$block,$variant] = $this->fixture();
        $report = app(CourseContentAudit::class)->report($page->id, $block->id, $variant->id, null, 'body', 'occurrences', 'corpus');
        $this->assertSame(2, $report['total']);
        $this->assertSame('current', $report['words']['darbs']['bucket']);
        $this->assertSame('A1 / Tema / Child', $report['words']['darbs']['entries']['darbs']['db'][0]['categories'][0]['path']);
        $this->assertSame('Darbs darbā.', $variant->fresh()->config['text']);
        $block->update(['type' => 'words', 'config' => ['dictionary_id' => 20, 'category_id' => 41]]);
        $variant->delete();
        $this->assertSame(1, app(CourseContentAudit::class)->report($page->id, $block->id, null, null, 'body', 'occurrences', 'corpus')['total']);
    }

    public function test_index_is_invalidated_by_variant_content_even_with_unchanged_timestamp(): void
    {
        [$page,$block,$variant] = $this->fixture();
        $audit = app(CourseContentAudit::class);
        $first = $audit->report($page->id, $block->id, $variant->id, null, 'body', 'occurrences', 'corpus');
        DB::table('lesson_block_variants')->where('id', $variant->id)->update(['config' => json_encode(['text' => 'Darbs.'])]);
        $second = $audit->report($page->id, $block->id, $variant->id, null, 'body', 'occurrences', 'corpus');
        $this->assertNotSame($first['revision'], $second['revision']);
        $this->assertSame(1, $second['total']);
    }

    public function test_report_never_queries_user_progress_or_writes_database_records(): void
    {
        [$page,$block,$variant] = $this->fixture();
        $queries = [];
        DB::listen(function ($event) use (&$queries) {
            $queries[] = $event->sql;
        });
        app(CourseContentAudit::class)->report($page->id, $block->id, $variant->id, null, 'body', 'occurrences', 'corpus');
        $this->assertNotEmpty($queries);
        foreach ($queries as $sql) {
            $this->assertDoesNotMatchRegularExpression('/^(insert|update|delete|replace|alter|drop)\b/i', $sql);
            $this->assertDoesNotMatchRegularExpression('/user_dictionary_words|lesson_block_attempts|lesson_grammar_item_progress/', $sql);
        }
    }

    public function test_corpus_topic_mapping_uses_heading_not_snapshot_category_ids(): void
    {
        [$page,$block,$variant] = $this->fixture();
        DB::table('dictionary_words')->insert(['id' => 2, 'dictionary_id' => 20, 'word' => 'Prieks iepazīties!', 'learn_lang' => 'lv', 'is_phrase' => true]);
        DB::table('dictionary_word_category')->insert(['word_id' => 2, 'category_id' => 42]);
        $report = app(CourseContentAudit::class)->report($page->id, $block->id, $variant->id, null, 'body', 'occurrences', 'corpus');
        $this->assertSame(1, $report['mapped_topics']);
        $this->assertSame([], $report['unmapped_groups']);
    }

    public function test_student_cannot_access_page_or_widget_or_public_word_action(): void
    {
        $this->user(false);
        $this->assertFalse(ContentAudit::canAccess());
        Livewire::test(ContentAudit::class)->assertForbidden();
        Livewire::test(ContentTopicChart::class)->assertForbidden();
        try {
            (new ContentAudit)->selectWord('darbs');
            $this->fail('Unauthorized action succeeded');
        } catch (HttpException $exception) {
            $this->assertSame(403, $exception->getStatusCode());
        }
    }

    public function test_admin_page_renders_charts_and_clickable_word_details(): void
    {
        $this->user(true);
        [$page,$block,$variant] = $this->fixture();
        Livewire::test(ContentAudit::class, ['lesson' => $page->id, 'block' => $block->id, 'variant' => $variant->id])
            ->assertOk()->assertSee('Учебная последовательность')->assertSee('Откуда лексика')
            ->call('selectWord', 'darbs')->assertDispatched('open-modal', id: 'content-audit-word')->assertSee('A1 / Tema / Child');
    }

    public function test_authored_translation_reference_matches_full_saved_task_not_ids(): void
    {
        $draft = json_decode(file_get_contents(resource_path('course/skills-1765-a1.json')), true, 512, JSON_THROW_ON_ERROR);
        $config = (new CourseSkillDraft)->pages($draft)['writing']['blocks'][0]['variants'][0]['config'];
        $references = new AuthoredTextReference;
        $this->assertSame($draft['variants'][0]['writing_translation']['lv'], $references->find($config)['text']);
        $config['instruction'] .= ' Изменение администратора.';
        $this->assertNull($references->find($config));
    }

    public function test_variant_from_another_block_is_rejected(): void
    {
        [$page,$block] = $this->fixture();
        $other = $page->blocks()->create(['type' => 'reading', 'position' => 1]);
        $variant = $other->variants()->create(['position' => 0, 'config' => ['text' => 'Test']]);
        $this->expectException(HttpException::class);
        app(CourseContentAudit::class)->report($page->id, $block->id, $variant->id, null, 'body', 'occurrences', 'corpus');
    }

    public function test_category_audit_counts_unique_word_ids_and_only_requested_subtree(): void
    {
        DB::table('dictionary_words')->insert([
            ['id' => 2, 'dictionary_id' => 20, 'word' => 'Prieks iepazīties!', 'learn_lang' => 'lv'],
            ['id' => 3, 'dictionary_id' => 20, 'word' => 'valoda', 'learn_lang' => 'lv'],
            ['id' => 4, 'dictionary_id' => 20, 'word' => 'nezināmsxyz', 'learn_lang' => 'lv'],
            ['id' => 5, 'dictionary_id' => 20, 'word' => 'other', 'learn_lang' => 'en'],
        ]);
        DB::table('dictionary_word_category')->insert([
            ['word_id' => 2, 'category_id' => 42], ['word_id' => 3, 'category_id' => 41],
            ['word_id' => 3, 'category_id' => 42], ['word_id' => 4, 'category_id' => 42], ['word_id' => 5, 'category_id' => 40],
        ]);
        $audit = app(CategoryVocabularyAudit::class);
        $category = DictionaryCategory::findOrFail(41);
        $report = $audit->report($category);
        $this->assertSame('A1:1. Prieks iepazīties!', $report['automatic_topic']);
        $this->assertSame(4, $report['total']);
        $this->assertSame(4, array_sum(array_column($report['summary'], 'count')));
        $valoda = collect($report['words'])->firstWhere('id', 3);
        $this->assertSame('current', $valoda['status']);
        $this->assertSame('missing', collect($report['words'])->firstWhere('id', 4)['status']);
        $this->assertSame([3], array_column($audit->report($category, null, false)['words'], 'id'));
        $this->assertSame(4, $audit->report(DictionaryCategory::findOrFail(42))['total']);
        $this->assertSame('A1:1. Prieks iepazīties!', $audit->report(DictionaryCategory::findOrFail(42))['context']['id']);
    }

    public function test_category_audit_api_rejects_students_and_validates_topic(): void
    {
        $this->getJson('/api/admin/categories/41/vocabulary-audit')->assertUnauthorized();
        $this->actingAs($this->user(false))->getJson('/api/admin/categories/41/vocabulary-audit')->assertForbidden();
        $this->actingAs($this->user(true))->getJson('/api/admin/categories/41/vocabulary-audit?topic=missing')->assertUnprocessable();
        $this->getJson('/api/admin/categories/41/vocabulary-audit?mode=invalid')->assertUnprocessable();
        $this->getJson('/api/admin/categories/999/vocabulary-audit')->assertNotFound();
        $this->getJson('/api/admin/categories/41/vocabulary-audit')->assertOk()
            ->assertHeader('Cache-Control', 'no-store, private')->assertJsonPath('data.total', 1)->assertJsonPath('data.context', null);
        $this->getJson('/api/admin/categories/41/vocabulary-audit?descendants=bad')->assertUnprocessable();
        $this->getJson('/api/admin/categories/41/vocabulary-audit?topic='.rawurlencode('A1:1. Prieks iepazīties!'))
            ->assertOk()->assertJsonPath('data.context.id', 'A1:1. Prieks iepazīties!');
    }

    public function test_category_audit_does_not_read_progress_or_write_and_refreshes_after_word_change(): void
    {
        $audit = app(CategoryVocabularyAudit::class);
        $category = DictionaryCategory::findOrFail(42);
        $first = $audit->report($category, 'A1:1. Prieks iepazīties!');
        DB::table('dictionary_words')->where('id', 1)->update(['word' => 'valoda']);
        $queries = [];
        DB::listen(function ($event) use (&$queries) {
            $queries[] = $event->sql;
        });
        $second = $audit->report($category, 'A1:1. Prieks iepazīties!');
        $this->assertNotSame($first['revision'], $second['revision']);
        $this->assertSame('current', $second['words'][0]['status']);
        foreach ($queries as $sql) {
            $this->assertDoesNotMatchRegularExpression('/^(insert|update|delete|replace|alter|drop)\b/i', $sql);
            $this->assertDoesNotMatchRegularExpression('/user_dictionary_words|lesson_block_attempts|lesson_grammar_item_progress/', $sql);
        }
    }

    public function test_editorial_inventory_is_read_only_redacted_and_keeps_exact_record_locations(): void
    {
        [$page, $block, $variant] = $this->fixture();
        $variant->update(['config' => ['task_kind' => 'reading_binary', 'text' => 'Darbs nezināmsxyz.', 'tutor_prompt' => 'PRIVATE-DO-NOT-EXPORT']]);
        $queries = [];
        DB::listen(function ($event) use (&$queries) {
            $queries[] = $event->sql;
        });
        $report = app(CourseEditorialAudit::class)->report(20);
        $this->assertTrue($report['read_only']);
        $this->assertFalse($report['user_progress_included']);
        $this->assertFalse($report['external_requests']);
        $this->assertFalse($report['is_pedagogical_verdict']);
        $this->assertCount(1, $report['themes']);
        $theme = $report['themes'][0];
        $this->assertSame(1, $theme['dictionary_words']);
        $this->assertCount(1, $theme['dictionary_records']);
        $this->assertSame(1, $theme['dictionary_records'][0]['word_id']);
        $this->assertSame('darbs', $theme['dictionary_records'][0]['word']);
        $this->assertSame(1, array_sum($theme['dictionary_first_seen_distribution']));
        $record = $theme['records'][0];
        $this->assertSame($page->id, $record['lesson_id']);
        $this->assertSame($block->id, $record['placement_block_id']);
        $this->assertSame($variant->id, $record['variant_id']);
        $this->assertSame(2, $record['expanded']['units']);
        $this->assertContains('unknown_candidates', $record['flags']);
        $this->assertStringNotContainsString('PRIVATE-DO-NOT-EXPORT', json_encode($report));
        $this->assertStringContainsString('variant='.$variant->id, $record['audit_path']);
        $this->assertSame(64, strlen($record['config_sha256']));
        foreach ($queries as $sql) {
            $this->assertDoesNotMatchRegularExpression('/^(insert|update|delete|replace|alter|drop)\b/i', $sql);
            $this->assertDoesNotMatchRegularExpression('/user_dictionary_words|lesson_block_attempts|lesson_grammar_item_progress/', $sql);
        }
    }

    public function test_editorial_inventory_marks_missing_reference_instead_of_inventing_coverage(): void
    {
        [$page, $block, $variant] = $this->fixture();
        $variant->update(['config' => ['task_kind' => 'ru_to_lv', 'instruction' => 'Переведите новое задание без эталона.']]);
        $record = app(CourseEditorialAudit::class)->report(20, 90)['themes'][0]['records'][0];
        $this->assertSame(0, $record['expanded']['units']);
        $this->assertContains('no_latvian_authored_text', $record['flags']);
        $this->assertContains('missing_translation_reference', $record['flags']);
        $this->assertNull($record['reference_source']);
    }

    public function test_editorial_inventory_rejects_unknown_group_and_unsafe_output_name(): void
    {
        $this->artisan('course:audit-content', ['--name' => '../unsafe'])->assertFailed();
        $this->expectException(ValidationException::class);
        app(CourseEditorialAudit::class)->report(20, 999);
    }

    public function test_reverse_topic_audit_excludes_prior_dictionary_words_and_exposes_future_and_missing(): void
    {
        $this->app->instance(ElaipaTopicOccurrences::class,
            new ElaipaTopicOccurrences(['complete' => true, 'tasks_counted' => 3,
                'topics' => ['A1:1. Prieks iepazīties!' => ['position' => 0, 'words' => ['darbs' => 2, 'valoda' => 3, 'unseenxyz' => 1]]]]));
        DB::table('dictionary_categories')->insert([
            ['id' => 43, 'dictionary_id' => 20, 'parent_id' => 40, 'name' => 'Prior'],
            ['id' => 44, 'dictionary_id' => 20, 'parent_id' => 40, 'name' => 'Future'],
        ]);
        DB::table('course_groups')->insert([
            ['id' => 89, 'title' => 'Prior', 'level' => 'A1', 'learn_lang' => 'lv', 'dictionary_id' => 20, 'category_id' => 43, 'position' => 0, 'is_published' => true],
            ['id' => 91, 'title' => 'Future', 'level' => 'A2', 'learn_lang' => 'lv', 'dictionary_id' => 20, 'category_id' => 44, 'position' => 0, 'is_published' => true],
        ]);
        DB::table('dictionary_word_category')->where('word_id', 1)->update(['category_id' => 43]);
        DB::table('dictionary_words')->insert(['id' => 2, 'dictionary_id' => 20, 'word' => 'valoda', 'learn_lang' => 'lv']);
        DB::table('dictionary_word_category')->insert(['word_id' => 2, 'category_id' => 44]);
        $balance = app(CategoryVocabularyAudit::class)->report(DictionaryCategory::findOrFail(41), 'A1:1. Prieks iepazīties!')['learning_balance'];
        $this->assertSame('topic_occurrences', $balance['source_basis']);
        $this->assertSame(2, $balance['reverse']['missing_before_and_now']);
        $words = collect($balance['reverse']['words'])->keyBy('word');
        $this->assertSame('previous', $words['darbs']['status']);
        $this->assertSame('future', $words['valoda']['status']);
        $this->assertSame('missing', $words['unseenxyz']['status']);
    }

    public function test_reviewed_topic_mapping_takes_priority_over_an_ordinary_word_matching_another_heading(): void
    {
        DB::table('course_groups')->where('id', 90)->update(['level' => 'B1']);
        DB::table('dictionary_categories')->where('id', 41)->update(['name' => '2. Среди своих']);
        DB::table('dictionary_words')->insert([
            ['id' => 2, 'dictionary_id' => 20, 'word' => 'Starp savējiem', 'learn_lang' => 'lv'],
            ['id' => 3, 'dictionary_id' => 20, 'word' => 'dzīvesvieta', 'learn_lang' => 'lv'],
        ]);
        DB::table('dictionary_word_category')->insert([['word_id' => 2, 'category_id' => 42], ['word_id' => 3, 'category_id' => 42]]);
        $report = app(CategoryVocabularyAudit::class)->report(DictionaryCategory::findOrFail(41));
        $this->assertSame('B1:2. Starp savējiem', $report['automatic_topic']);
        $this->assertTrue($report['learning_balance']['topic_available']);
    }

    public function test_skill_comparisons_keep_all_variants_and_measure_questions_instead_of_hypothetical_answers(): void
    {
        $this->app->instance(ElaipaTopicOccurrences::class,
            new ElaipaTopicOccurrences(['complete' => true, 'tasks_counted' => 1,
                'topics' => ['A1:1. Prieks iepazīties!' => ['position' => 0, 'words' => ['darbs' => 2, 'esmu' => 2]]]]));
        [$page, $block] = $this->fixture();
        for ($i = 1; $i < 5; $i++) {
            $block->variants()->create(['position' => $i, 'is_published' => true, 'config' => ['text' => 'Darbs esmu.', 'questions' => [['statement' => 'Darbs?', 'options' => ['Jā', 'Nē']]]]]);
        }
        $writing = LessonPage::create(['title' => 'Write', 'slug' => 'audit-writing', 'learn_lang' => 'lv', 'course_group_id' => 90, 'skill' => 'writing', 'level' => 'A1', 'status' => 'published', 'is_published' => true]);
        $writing->blocks()->create(['type' => 'writing', 'position' => 0, 'config' => ['prompt' => 'Darbs.']]);
        $writing->blocks()->create(['type' => 'writing', 'position' => 1, 'config' => ['task_kind' => 'ru_to_lv', 'instruction' => 'Ответь: Darbs esmu?', 'reference_translation' => 'SECRET-REFERENCE', 'tutor_prompt' => 'PRIVATE-NEVER-EXPORT']]);
        $report = app(CategoryVocabularyAudit::class)->report(DictionaryCategory::findOrFail(41), 'A1:1. Prieks iepazīties!');
        $balance = $report['learning_balance'];
        $this->assertSame([1, 2, 3, 4, 5], array_column($balance['comparisons']['receptive']['rows'], 'variant'));
        $this->assertCount(2, $balance['comparisons']['productive']['rows']);
        $free = $balance['comparisons']['productive']['rows'][0];
        $this->assertSame('input', $free['scope']);
        $this->assertSame(1, $free['metric']['total']);
        $this->assertSame(100.0, $free['metric']['combined_percent']);
        $this->assertSame(0, $balance['comparisons']['productive']['without_text']);
        $this->assertSame(100.0, $balance['comparisons']['productive']['rows'][1]['metric']['combined_percent']);
        $this->assertStringNotContainsString('PRIVATE-NEVER-EXPORT', json_encode($report));
        $this->assertStringNotContainsString('SECRET-REFERENCE', json_encode($balance));
        $this->assertSame(100.0, $balance['comparisons']['productive']['rows'][0]['metric']['whole_dictionary_percent']);
    }

    public function test_word_inspector_returns_all_dictionary_matches_and_real_topic_occurrences(): void
    {
        $this->app->instance(ElaipaTopicOccurrences::class, new ElaipaTopicOccurrences(['complete' => true, 'topics' => [
            'A1:1. Prieks iepazīties!' => ['level' => 'A1', 'topic' => '1. Prieks iepazīties!', 'position' => 0, 'words' => ['darbs' => 2]],
            'A1:2. No visas pasaules' => ['level' => 'A1', 'topic' => '2. No visas pasaules', 'position' => 1, 'words' => ['darbā' => 3]],
        ]]));
        for ($i = 2; $i <= 7; $i++) {
            DB::table('dictionary_words')->insert(['id' => $i, 'dictionary_id' => 20, 'word' => 'darbs', 'learn_lang' => 'lv']);
        }
        $inspection = app(CategoryVocabularyAudit::class)->inspectWord(DictionaryCategory::findOrFail(41), 'Darbā', 'A1:1. Prieks iepazīties!');
        $this->assertCount(7, $inspection['matches']);
        $this->assertSame(['current', 'future'], array_column($inspection['topics'], 'relation'));
        $this->assertSame([2, 3], array_column($inspection['topics'], 'frequency'));
        $this->assertSame('darbā', $inspection['word']);
        $this->assertSame('A1 / Tema / Child', collect($inspection['categories'])->firstWhere('id', 42)['path']);
        $empty = app(CategoryVocabularyAudit::class)->inspectWord(DictionaryCategory::findOrFail(41), 'unseenxyz');
        $this->assertSame([], $empty['matches']);
        $this->assertSame([], $empty['topics']);
    }

    private function placementRequest(array $data, bool $admin = true): Request
    {
        $request = Request::create('/api/admin/categories/41/vocabulary-audit/placement', 'POST', $data);
        $user = $this->user($admin);
        $request->setUserResolver(fn () => $user);

        return $request;
    }

    public function test_placement_moves_one_link_preserving_word_progress_translations_and_other_links(): void
    {
        Schema::create('user_dictionary_words', function ($t) { $t->integer('dict_word_id'); $t->integer('level'); });
        Schema::create('dictionary_word_translations', function ($t) { $t->integer('word_id'); $t->string('translation_1'); });
        DB::table('user_dictionary_words')->insert(['dict_word_id' => 1, 'level' => 4]);
        DB::table('dictionary_word_translations')->insert(['word_id' => 1, 'translation_1' => 'работа']);
        DB::table('dictionary_word_category')->insert(['word_id' => 1, 'category_id' => 40]);
        $wordBefore = DB::table('dictionary_words')->where('id', 1)->first();
        $response = app(CategoryVocabularyAuditController::class)->place($this->placementRequest([
            'word_id' => 1, 'source_category_id' => 42, 'target_category_id' => 41, 'mode' => 'move', 'expected_category_ids' => [42, 40],
        ]), DictionaryCategory::findOrFail(41));
        $this->assertSame(200, $response->getStatusCode());
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        $this->assertEquals($wordBefore, DB::table('dictionary_words')->where('id', 1)->first());
        $this->assertSame([40, 41], DB::table('dictionary_word_category')->where('word_id', 1)->orderBy('category_id')->pluck('category_id')->all());
        $this->assertSame(4, DB::table('user_dictionary_words')->value('level'));
        $this->assertSame('работа', DB::table('dictionary_word_translations')->value('translation_1'));
    }

    public function test_add_category_keeps_existing_links_and_is_idempotent(): void
    {
        $controller = app(CategoryVocabularyAuditController::class);
        $category = DictionaryCategory::findOrFail(41);
        foreach ([[42], [41, 42]] as $expected) {
            $controller->place($this->placementRequest(['word_id' => 1, 'target_category_id' => 41, 'mode' => 'add', 'expected_category_ids' => $expected]), $category);
        }
        $this->assertSame([41, 42], DB::table('dictionary_word_category')->orderBy('category_id')->pluck('category_id')->all());
    }

    public function test_placement_rejects_stale_links_without_mutation(): void
    {
        try {
            app(CategoryVocabularyAuditController::class)->place($this->placementRequest([
                'word_id' => 1, 'target_category_id' => 41, 'mode' => 'add', 'expected_category_ids' => [],
            ]), DictionaryCategory::findOrFail(41));
            $this->fail('Expected conflict');
        } catch (HttpException $error) {
            $this->assertSame(409, $error->getStatusCode());
        }
        $this->assertSame([42], DB::table('dictionary_word_category')->pluck('category_id')->all());
    }

    public function test_placement_rejects_cross_dictionary_targets_and_foreign_words(): void
    {
        DB::table('dictionary_categories')->insert(['id' => 99, 'dictionary_id' => 99, 'name' => 'Other']);
        DB::table('dictionary_words')->insert(['id' => 99, 'dictionary_id' => 99, 'word' => 'darbs', 'learn_lang' => 'lv']);
        foreach ([[1, 99, [42]], [99, 41, []]] as [$word, $target, $expected]) {
            try {
                app(CategoryVocabularyAuditController::class)->place($this->placementRequest([
                    'word_id' => $word, 'target_category_id' => $target, 'mode' => 'add', 'expected_category_ids' => $expected,
                ]), DictionaryCategory::findOrFail(41));
                $this->fail('Expected rejection');
            } catch (HttpException $error) {
                $this->assertSame(422, $error->getStatusCode());
            }
        }
        $this->assertSame([42], DB::table('dictionary_word_category')->pluck('category_id')->all());
    }

    public function test_word_inspection_and_placement_require_an_admin(): void
    {
        $controller = app(CategoryVocabularyAuditController::class);
        foreach (['word', 'place'] as $action) {
            try {
                $request = $this->placementRequest([], false);
                $category = DictionaryCategory::findOrFail(41);
                if ($action === 'word') $controller->word($request, $category, app(CategoryVocabularyAudit::class));
                else $controller->place($request, $category);
                $this->fail('Expected forbidden');
            } catch (HttpException $error) {
                $this->assertSame(403, $error->getStatusCode());
            }
        }
    }

    public function test_placement_rejects_missing_or_unrelated_move_source(): void
    {
        $controller = app(CategoryVocabularyAuditController::class);
        $category = DictionaryCategory::findOrFail(41);
        try {
            $controller->place($this->placementRequest(['word_id' => 1, 'target_category_id' => 41, 'mode' => 'move', 'expected_category_ids' => [42]]), $category);
            $this->fail('Expected validation error');
        } catch (ValidationException $error) {
            $this->assertArrayHasKey('source_category_id', $error->errors());
        }
        foreach ([40, 42] as $source) {
            try {
                $controller->place($this->placementRequest(['word_id' => 1, 'source_category_id' => $source, 'target_category_id' => $source === 42 ? 42 : 41,
                    'mode' => 'move', 'expected_category_ids' => [42]]), $category);
                $this->fail('Expected invalid source or identical target');
            } catch (HttpException $error) {
                $this->assertSame(422, $error->getStatusCode());
            }
        }
        $this->assertSame([42], DB::table('dictionary_word_category')->pluck('category_id')->all());
    }

    public function test_word_inspection_endpoint_validates_one_latin_word_and_keeps_response_private(): void
    {
        $controller = app(CategoryVocabularyAuditController::class);
        $category = DictionaryCategory::findOrFail(41);
        $request = $this->placementRequest(['word' => 'Darbā']);
        $response = $controller->word($request, $category, app(CategoryVocabularyAudit::class));
        $this->assertSame('darbā', $response->getData(true)['data']['word']);
        $this->assertStringContainsString('no-store', $response->headers->get('Cache-Control'));
        foreach (['Darbs darbā', '<script>', 'Русский'] as $word) {
            try {
                $controller->word($this->placementRequest(['word' => $word]), $category, app(CategoryVocabularyAudit::class));
                $this->fail('Expected word validation error');
            } catch (ValidationException $error) {
                $this->assertArrayHasKey('word', $error->errors());
            }
        }
    }
}
