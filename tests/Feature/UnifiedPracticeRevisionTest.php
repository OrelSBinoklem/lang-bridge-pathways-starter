<?php

namespace Tests\Feature;

use App\Console\Commands\PublishCourseListeningRevision as Canon;
use App\Http\Controllers\Api\LessonController;
use App\Models\LessonPage;
use App\Services\LessonProgressService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class UnifiedPracticeRevisionTest extends TestCase
{
    private string $manifest;

    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('users', fn ($t) => $t->id());
        Schema::create('course_groups', fn ($t) => $t->id());
        foreach (['2026_09_11_000002_create_lesson_pages_table','2026_09_11_000003_create_lesson_blocks_table',
            '2026_09_22_000001_add_course_skill_lesson_framework','2026_10_13_000002_add_practice_variant_archive'] as $migration) {
            (require database_path('migrations/'.$migration.'.php'))->up();
        }
        \Illuminate\Support\Facades\DB::table('course_groups')->insert(['id' => 9]);
        $this->manifest = '.tmp/unified-practice-test-'.Str::uuid().'.json';
    }

    protected function tearDown(): void
    {
        if (isset($this->manifest) && is_file(base_path($this->manifest))) unlink(base_path($this->manifest));
        parent::tearDown();
    }

    private function variant(string $skill, string $kind): \App\Models\LessonBlockVariant
    {
        $page = LessonPage::create(['title'=>$skill,'slug'=>$skill,'skill'=>$skill,'course_group_id'=>9,
            'learn_lang'=>'lv','level'=>'A1','status'=>'published','is_published'=>true]);
        $block = $page->blocks()->create(['type'=>$skill,'position'=>0]);
        return $block->variants()->create(['position'=>0,'is_published'=>true,'config'=>[
            'task_kind'=>$kind,'instruction'=>'Обсудите экскурсии и выберите подходящую.', 'audio_url'=>'/unchanged.mp3',
            'questions'=>array_map(fn ($n) => ['statement'=>'Jautājums '.$n,'correct'=>$n % 2 === 0], range(1,8)),
        ]]);
    }

    private function entry($variant, array $set): array
    {
        return ['variant_id'=>$variant->id,'block_id'=>$variant->block->id,'page_slug'=>$variant->block->page->slug,
            'before_sha256'=>hash('sha256',Canon::canonicalJson($variant->config)), 'set'=>$set,
            'after_sha256'=>hash('sha256',Canon::canonicalJson(array_replace($variant->config,$set)))];
    }

    private function pack(array $entries): void
    {
        file_put_contents(base_path($this->manifest), json_encode(['schema_version'=>1,'entries'=>$entries],JSON_THROW_ON_ERROR));
    }

    public function test_question_revision_is_dry_by_default_idempotent_and_preserves_audio_and_goals_instruction(): void
    {
        $reading = $this->variant('reading','reading_binary');
        $speaking = $this->variant('speaking','roleplay');
        $before = $speaking->config;
        $this->pack([$this->entry($reading,['questions'=>array_slice($reading->config['questions'],0,6)]),
            $this->entry($speaking,['goals'=>['Расспросите об экскурсиях.','Обсудите подходящий вариант.']])]);
        $this->artisan('course:revise-practice-tasks', ['manifest'=>$this->manifest])->assertSuccessful();
        $this->assertCount(8,$reading->fresh()->config['questions']);
        $this->artisan('course:revise-practice-tasks', ['manifest'=>$this->manifest,'--apply'=>true])->assertSuccessful();
        $this->assertCount(6,$reading->fresh()->config['questions']);
        $this->assertSame('/unchanged.mp3',$reading->fresh()->config['audio_url']);
        $this->assertSame($before['instruction'],$speaking->fresh()->config['instruction']);
        $this->assertCount(2,$speaking->fresh()->config['goals']);
        $this->artisan('course:revise-practice-tasks', ['manifest'=>$this->manifest,'--apply'=>true])->assertSuccessful();
        $this->assertDatabaseCount('lesson_block_attempts',0);
    }

    public function test_drift_on_later_entry_prevents_any_write(): void
    {
        $reading = $this->variant('reading','reading_binary');
        $speaking = $this->variant('speaking','roleplay');
        $entry = $this->entry($speaking,['goals'=>['Обсудите экскурсии.']]);
        $entry['before_sha256'] = str_repeat('0',64);
        $this->pack([$this->entry($reading,['questions'=>array_slice($reading->config['questions'],0,6)]),$entry]);
        $this->artisan('course:revise-practice-tasks', ['manifest'=>$this->manifest,'--apply'=>true])->assertFailed();
        $this->assertCount(8,$reading->fresh()->config['questions']);
        $this->assertArrayNotHasKey('goals',$speaking->fresh()->config);
    }

    public function test_retired_speaking_cannot_be_completed_through_old_url(): void
    {
        $variant = $this->variant('speaking','question_formation');
        try {
            (new LessonController(new LessonProgressService))->completeBlock(Request::create('/unused','POST'),$variant->block);
            $this->fail('Retired task was accepted.');
        } catch (HttpException $error) {
            $this->assertSame(404,$error->getStatusCode());
        }
    }
}
