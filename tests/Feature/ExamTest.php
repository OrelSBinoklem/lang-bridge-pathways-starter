<?php

namespace Tests\Feature;

use App\Models\{CourseExam, ExamAttempt, ExamVariant, User};
use App\Services\Exams\{ExamAi, ExamDefinition, ExamGrader, ExamSession};
use Illuminate\Support\Facades\{DB, Schema};
use Tests\TestCase;

class ExamTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::create('users', function ($t) { $t->id(); $t->string('name'); });
        (require database_path('migrations/2026_09_25_000001_create_app_settings_table.php'))->up();
        (require database_path('migrations/2026_09_26_000001_create_course_exams.php'))->up();
        (require database_path('migrations/2026_10_03_000001_create_exam_variant_archives.php'))->up();
        (require database_path('migrations/2026_09_26_000002_limit_exam_grading_retries.php'))->up();
        DB::table('users')->insert([['id'=>1,'name'=>'Test Student'],['id'=>2,'name'=>'Other Student']]);
    }

    private function content(): array
    {
        return ['level'=>'A1','title'=>'Test','sections'=>array_map(fn ($skill,$i)=>[
            'skill'=>$skill,'seconds'=>1200,'tasks'=>[['id'=>'t'.$i,'title'=>'Test','questions'=>[
                ['id'=>'q'.$i,'type'=>'choice','prompt'=>'Pick','points'=>15,'options'=>[['id'=>'a','text'=>'A'],['id'=>'b','text'=>'B']],'correct'=>'a','explanation'=>'The correct answer is A.'],
            ]]],
        ], ExamDefinition::SKILLS, range(0,3))];
    }

    private function attempt(array $changes=[]): ExamAttempt
    {
        $exam=CourseExam::create(['level'=>'A1','title'=>'A1','is_published'=>true]);
        $variant=ExamVariant::create(['course_exam_id'=>$exam->id,'position'=>1,'title'=>'One','content'=>$this->content()]);
        return ExamAttempt::create($changes+['user_id'=>1,'course_exam_id'=>$exam->id,'exam_variant_id'=>$variant->id,'student_name'=>'Test Student',
            'snapshot'=>$this->content(),'answers'=>[],'playbacks'=>[],'started_at'=>now(),'deadline_at'=>now()->addMinutes(20),'cooldown_hours'=>20]);
    }

    public function test_all_five_authored_variants_have_four_sections_and_15_points_each(): void
    {
        $variants=require resource_path('course/exams/a1.php');
        $this->assertCount(5,$variants);
        foreach($variants as $variant) {
            app(ExamDefinition::class)->validate($variant);
            foreach($variant['sections'] as $section) $this->assertEquals(15,array_sum(array_column(app(ExamDefinition::class)->questions($section),'points')));
            $this->assertSame([1200,1200,1200,600],array_column($variant['sections'],'seconds'));
            foreach($variant['sections'][0]['tasks'] as $task) foreach($task['segments'] as $segment) $this->assertContains($segment['speaker'],['male','female']);
        }
    }

    public function test_grouped_reading_payload_hides_keys_and_retains_canonical_answers_and_review(): void
    {
        foreach (['A2' => 3, 'B2' => 4] as $level => $groupCount) {
            $pack = json_decode(file_get_contents(resource_path('course/exams/revisions/2026-10-03-'.strtolower($level).'-reading.json')), true, flags: JSON_THROW_ON_ERROR);
            $snapshot = $this->content();
            $snapshot['level'] = $level;
            $snapshot['sections'][1] = $pack['variants'][0]['replace_sections']['reading'];
            $attempt = $this->attempt(['snapshot' => $snapshot, 'section_index' => 1]);
            $attempt->exam()->update(['level' => $level]);
            $service = app(ExamSession::class);
            $taskIndex = $level === 'A2' ? 1 : 2;
            $question = $snapshot['sections'][1]['tasks'][$taskIndex]['questions'][0];
            $service->save($attempt, 1, [$question['id'] => $question['correct']], false);
            $payload = $service->payload($attempt);
            $task = $payload['sections'][0]['tasks'][$taskIndex];
            $this->assertCount($groupCount, $task['reading_groups']);
            foreach ($task['reading_groups'] as $group) {
                $this->assertSame(['title','announcements','question_ids'], array_keys($group));
                $this->assertCount(4, $group['announcements']);
                $this->assertCount(2, $group['question_ids']);
            }
            foreach ($task['questions'] as $q) {
                $this->assertArrayNotHasKey('correct', $q);
                $this->assertArrayNotHasKey('explanation', $q);
                $this->assertArrayNotHasKey('explanation_translations', $q);
            }
            $this->assertSame($question['correct'], $payload['answers'][$question['id']]['text']);
            $this->assertSame($snapshot, $attempt->fresh()->snapshot);
            $attempt->update(['status' => 'completed']);
            $review = $service->payload($attempt)['sections'][1]['tasks'][$taskIndex];
            $this->assertSame($task['reading_groups'], $review['reading_groups']);
            $this->assertSame($task['questions'][0]['options'], $review['questions'][0]['options']);
            $this->assertSame($question['correct'], $review['questions'][0]['correct']);
            $this->assertSame($snapshot, $attempt->fresh()->snapshot);
        }
    }

    public function test_catalog_reports_durations_from_published_variant_without_exposing_tasks(): void
    {
        $exam=CourseExam::create(['level'=>'A1','title'=>'A1','is_published'=>true]);
        $draft=$this->content();
        $published=$this->content();
        $published['sections'][1]['seconds']=1800;
        $this->assertNotNull(ExamVariant::create(['course_exam_id'=>$exam->id,'position'=>1,'title'=>'Draft','content'=>$draft]));
        $variant=ExamVariant::create(['course_exam_id'=>$exam->id,'position'=>2,'title'=>'Published','content'=>$published]);
        DB::table('exam_variants')->where('id',$variant->id)->update(['is_published'=>true]);

        $user=\Mockery::mock(User::class)->makePartial();
        $user->id=1;
        $user->shouldReceive('isFrontendAdmin')->andReturn(false);
        $request=\Illuminate\Http\Request::create('/api/exams');
        $request->setUserResolver(fn()=>$user);
        $data=app(\App\Http\Controllers\Api\ExamController::class)->index($request)->getData(true)['data'][0];

        $this->assertTrue($data['available']);
        $this->assertSame(['listening'=>1200,'reading'=>1800,'writing'=>1200,'speaking'=>1200],$data['durations']);
        $this->assertArrayNotHasKey('sections',$data);
    }

    public function test_browser_absence_does_not_pause_timer(): void
    {
        $attempt=$this->attempt();
        $start=$attempt->started_at;
        $this->travel(45)->minutes();
        app(ExamSession::class)->advanceClock($attempt);
        $this->assertSame(2,$attempt->section_index);
        $this->assertTrue($attempt->deadline_at->equalTo($start->addMinutes(60)));
        $this->travel(40)->minutes();
        app(ExamSession::class)->advanceClock($attempt);
        $this->assertSame('pending',$attempt->status);
        $this->assertTrue($attempt->submitted_at->equalTo($start->addMinutes(80)));
        $this->assertTrue($attempt->next_attempt_at->equalTo($start->addMinutes(80)->addHours(20)));
    }

    public function test_only_current_section_and_no_answer_key_are_returned(): void
    {
        $payload=app(ExamSession::class)->payload($this->attempt());
        $this->assertCount(1,$payload['sections']);
        $q=$payload['sections'][0]['tasks'][0]['questions'][0];
        $this->assertArrayNotHasKey('correct',$q);
        $this->assertArrayNotHasKey('explanation',$q);
        $this->assertArrayNotHasKey('explanation_translations',$q);
    }

    public function test_audio_generation_metadata_is_not_exposed_in_running_or_completed_payload(): void
    {
        $snapshot = $this->content();
        $snapshot['sections'][0]['tasks'][0]['audio_generation'] = ['version' => 2, 'sha256' => 'private-recipe'];
        $attempt = $this->attempt(['snapshot' => $snapshot]);
        $service = app(ExamSession::class);
        $this->assertArrayNotHasKey('audio_generation', $service->payload($attempt)['sections'][0]['tasks'][0]);
        $attempt->update(['status' => 'completed']);
        $this->assertArrayNotHasKey('audio_generation', $service->payload($attempt)['sections'][0]['tasks'][0]);
        $this->assertSame($snapshot, $attempt->fresh()->snapshot);
    }

    public function test_json_comment_translations_are_private_until_completion_and_preserved_in_review(): void
    {
        $snapshot = $this->content();
        $snapshot['sections'][0]['tasks'][0]['questions'][0]['explanation_translations'] = ['ru' => 'Наш комментарий.', 'uk' => 'Наш коментар.'];
        $attempt = $this->attempt(['snapshot' => $snapshot]);
        $service = app(ExamSession::class);
        $this->assertArrayNotHasKey('explanation_translations', $service->payload($attempt)['sections'][0]['tasks'][0]['questions'][0]);
        $attempt->update(['status' => 'completed']);
        $this->assertSame(['ru' => 'Наш комментарий.', 'uk' => 'Наш коментар.'], $service->payload($attempt)['sections'][0]['tasks'][0]['questions'][0]['explanation_translations']);
    }

    public function test_all_authored_exam_comments_have_both_translations(): void
    {
        $translations=require resource_path('course/exams/comment-translations.php');
        foreach (['a1','a2','b1','b2'] as $level) {
            $variants=require resource_path('course/exams/'.$level.'.php');
            foreach ($variants as $variant) foreach ($variant['sections'] as $section) foreach ($section['tasks'] as $task) foreach ($task['questions'] as $question) {
                $source=$question['explanation'] ?? '';
                if ($source === '') continue;
                $this->assertNotEmpty($translations[$source]['ru'] ?? null, $level.': missing Russian translation for '.$question['id']);
                $this->assertNotEmpty($translations[$source]['uk'] ?? null, $level.': missing Ukrainian translation for '.$question['id']);
            }
        }
    }

    public function test_completed_attempt_includes_comment_translation_without_regrading(): void
    {
        $attempt=$this->attempt(['status'=>'completed']);
        $snapshot=$attempt->snapshot;
        $snapshot['sections'][0]['tasks'][0]['questions'][0]['explanation']='Cikos rīt sākas nodarbība? Deviņos. Bet šodien tā sākas desmitos.';
        $attempt->update(['snapshot'=>$snapshot]);
        $payload=app(ExamSession::class)->payload($attempt->fresh());
        $question=$payload['sections'][0]['tasks'][0]['questions'][0];
        $this->assertSame('Во сколько завтра начинается занятие? В девять. А сегодня оно начинается в десять.', $question['explanation_translations']['ru']);
        $this->assertSame('О котрій завтра починається заняття? О дев’ятій. А сьогодні воно починається о десятій.', $question['explanation_translations']['uk']);
    }

    public function test_another_user_cannot_read_or_change_attempt(): void
    {
        $attempt=$this->attempt();
        $this->expectException(\Illuminate\Database\Eloquent\ModelNotFoundException::class);
        app(ExamSession::class)->locked($attempt->id,2,fn($a)=>$a);
    }

    public function test_late_answers_are_not_accepted_and_prior_sections_cannot_be_changed(): void
    {
        $attempt=$this->attempt(); $sessions=app(ExamSession::class);
        $this->travel(21)->minutes();
        $sessions->locked($attempt->id,1,fn($a)=>$sessions->save($a,0,['q0'=>'a'],true));
        $this->assertSame([],$attempt->fresh()->answers);
        $this->assertSame(1,$attempt->fresh()->section_index);
    }

    public function test_saving_cannot_reset_deadline_or_inject_speaking_transcript(): void
    {
        $attempt=$this->attempt(); $deadline=$attempt->deadline_at;
        $this->travel(5)->minutes();
        app(ExamSession::class)->save($attempt,0,['q0'=>'a','q1'=>'a'],false);
        $this->assertTrue($attempt->deadline_at->equalTo($deadline));
        $this->assertSame(['q0'=>['text'=>'a']],$attempt->answers);
    }

    public function test_one_failed_skill_fails_whole_exam_despite_75_percent(): void
    {
        $attempt=$this->attempt(['status'=>'pending','answers'=>['q0'=>['text'=>'a'],'q1'=>['text'=>'a'],'q2'=>['text'=>'a'],'q3'=>['text'=>'b']]]);
        app(ExamGrader::class)->grade($attempt->id); $attempt->refresh();
        $this->assertSame('completed',$attempt->status);
        $this->assertEquals(75,$attempt->score);
        $this->assertFalse($attempt->passed);
        $this->assertCount(4,$attempt->results);
        $this->assertEquals(0,$attempt->results[3]['points']);
    }

    public function test_completed_attempt_is_not_regraded_and_preserves_snapshot(): void
    {
        $attempt=$this->attempt(['status'=>'pending','answers'=>[]]);
        app(ExamGrader::class)->grade($attempt->id);
        $before=$attempt->fresh()->results;
        $variant=$attempt->variant; $content=$variant->content; $content['sections'][0]['tasks'][0]['questions'][0]['prompt']='Changed';
        $variant->update(['content'=>$content]);
        app(ExamGrader::class)->grade($attempt->id);
        $this->assertSame($before,$attempt->fresh()->results);
        $this->assertSame('Pick',$attempt->fresh()->snapshot['sections'][0]['tasks'][0]['questions'][0]['prompt']);
    }

    public function test_cooldown_prevents_new_attempt_and_audio_retention_defaults_off(): void
    {
        $attempt=$this->attempt(['status'=>'completed','next_attempt_at'=>now()->addHours(20)]);
        $this->assertSame(20,ExamSession::cooldownHours());
        $this->assertFalse(ExamSession::retainAudio());
        $this->expectException(\Illuminate\Validation\ValidationException::class);
        app(ExamSession::class)->start(User::findOrFail(1),$attempt->exam);
    }

    public function test_duplicate_question_ids_are_rejected(): void
    {
        $content=$this->content(); $content['sections'][1]['tasks'][0]['questions'][0]['id']='q0';
        $this->expectException(\Illuminate\Validation\ValidationException::class);
        app(ExamDefinition::class)->validate($content);
    }

    public function test_audio_cannot_be_played_a_third_time_and_counts_survive_reload(): void
    {
        \Illuminate\Support\Facades\Storage::fake('local');
        \Illuminate\Support\Facades\Storage::disk('local')->put('exams/test.mp3', 'test-audio');
        $attempt=$this->attempt(); $snapshot=$attempt->snapshot;
        $snapshot['sections'][0]['tasks'][0]+=['audio_path'=>'exams/test.mp3','audio_seconds'=>1];
        $attempt->update(['snapshot'=>$snapshot]);
        $request=\Illuminate\Http\Request::create('/api/exam-attempts/'.$attempt->id.'/audio','POST',['task_id'=>'t0']);
        $request->setUserResolver(fn()=>User::findOrFail(1));
        $controller=app(\App\Http\Controllers\Api\ExamController::class);
        $controller->audio($request,$attempt->id); $this->travel(2)->seconds();
        $controller->audio($request,$attempt->id); $this->travel(2)->seconds();
        $this->assertSame(2,$attempt->fresh()->playbacks['t0']['count']);
        $this->expectException(\Symfony\Component\HttpKernel\Exception\HttpException::class);
        $controller->audio($request,$attempt->id);
    }

    public function test_failed_ai_does_not_mark_a_student_failed_and_has_a_retry_cap(): void
    {
        $attempt=$this->attempt(['status'=>'pending','answers'=>['q2'=>['text'=>'Labdien!']]]);
        $snapshot=$attempt->snapshot;
        $snapshot['sections'][2]['tasks'][0]['questions'][0]['type']='essay';
        $snapshot['sections'][2]['tasks'][0]['questions'][0]['rubric']='Assess.';
        $attempt->update(['snapshot'=>$snapshot]);
        $ai=\Mockery::mock(ExamAi::class);
        $ai->shouldReceive('assess')->times(3)->andThrow(new \RuntimeException('Provider unavailable'));
        $grader=new ExamGrader(app(ExamDefinition::class),$ai);
        for($i=0;$i<4;$i++) $grader->grade($attempt->id);
        $attempt->refresh();
        $this->assertSame('pending',$attempt->status);
        $this->assertNull($attempt->passed);
        $this->assertNull($attempt->score);
        $this->assertSame(3,$attempt->grading_tries);
    }

    public function test_structured_ai_feedback_is_saved_and_returned_in_completed_history(): void
    {
        $attempt=$this->attempt(['status'=>'pending','answers'=>['q2'=>['text'=>'Es dzīvoju Rīga.']]]);
        $snapshot=$attempt->snapshot;
        $snapshot['sections'][2]['tasks'][0]['questions'][0]['type']='essay';
        $snapshot['sections'][2]['tasks'][0]['questions'][0]['rubric']='Assess grammar.';
        $attempt->update(['snapshot'=>$snapshot]);
        $errors=[['original'=>'Rīga','correction'=>'Rīgā','explanation'=>'Местный падеж.']];
        $ai=\Mockery::mock(ExamAi::class);
        $ai->shouldReceive('assess')->once()->andReturn(['q2'=>['points'=>10,'feedback'=>'Исправьте падеж.','example'=>'Es dzīvoju Rīgā.','errors'=>$errors,'recommendation'=>'Повторите падежи.']]);
        (new ExamGrader(app(ExamDefinition::class),$ai))->grade($attempt->id);
        $payload=app(ExamSession::class)->payload($attempt->fresh());
        $this->assertSame('completed',$payload['status']);
        $this->assertSame($errors,$payload['results'][2]['answers']['q2']['errors']);
        $this->assertSame('Повторите падежи.',$payload['results'][2]['answers']['q2']['recommendation']);
    }

    public function test_recording_retention_can_be_enabled_explicitly(): void
    {
        \App\Models\AppSetting::create(['key'=>'exam_retain_audio','value'=>'1']);
        $this->assertTrue(ExamSession::retainAudio());
    }

    public function test_speech_is_transcribed_without_persistent_audio_when_retention_is_off(): void
    {
        \Illuminate\Support\Facades\Storage::fake('local');
        $attempt=$this->attempt(['section_index'=>3]);
        $snapshot=$attempt->snapshot;
        $snapshot['sections'][3]['tasks'][0]['questions'][0]['type']='speaking';
        $attempt->update(['snapshot'=>$snapshot]);
        $request=\Illuminate\Http\Request::create('/speech','POST',['question_id'=>'q3','audio'=>base64_encode(str_repeat('x',1000)),'mime'=>'audio/webm']);
        $request->setUserResolver(fn()=>User::findOrFail(1));
        $ai=\Mockery::mock(ExamAi::class);
        $candidates=[['id'=>'primary','model'=>'test-auto','language'=>'auto','ok'=>true,'text'=>'Es dzīvoju Rīgā.'],['id'=>'secondary','model'=>'test-lv','language'=>'lv','ok'=>true,'text'=>'Es dzīvoju Rīgā.']];
        $ai->shouldReceive('transcribe')->once()->andReturn(['text'=>'Es dzīvoju Rīgā.','source'=>'speech','transcription_selected'=>'primary','transcript_candidates'=>$candidates]);
        app(\App\Http\Controllers\Api\ExamController::class)->speech($request,$attempt->id,$ai,app(ExamDefinition::class));
        $this->assertSame('speech',$attempt->fresh()->answers['q3']['source']);
        $this->assertSame('Es dzīvoju Rīgā.',$attempt->fresh()->answers['q3']['text']);
        $this->assertSame($candidates,$attempt->fresh()->answers['q3']['transcript_candidates']);
        $this->assertSame(0,DB::table('exam_recordings')->count());
        $this->assertSame([],\Illuminate\Support\Facades\Storage::disk('local')->allFiles());
    }

    public function test_speech_failure_is_not_misgraded_as_an_empty_student_answer(): void
    {
        $attempt=$this->attempt(['status'=>'pending','answers'=>['q3'=>['processing_error'=>true]]]);
        app(ExamGrader::class)->grade($attempt->id);
        $this->assertSame('pending',$attempt->fresh()->status);
        $this->assertNull($attempt->fresh()->score);
    }

    public function test_grader_receives_both_recognitions_without_merging_or_rewriting_answer(): void
    {
        $candidates=[['id'=>'primary','model'=>'test-auto','language'=>'auto','ok'=>true,'text'=>'Es iet.'],['id'=>'secondary','model'=>'test-lv','language'=>'lv','ok'=>true,'text'=>'Es eju.']];
        $attempt=$this->attempt(['status'=>'pending','answers'=>['q3'=>['text'=>'Es iet.','source'=>'speech','transcript_candidates'=>$candidates]]]);
        $snapshot=$attempt->snapshot;
        $snapshot['sections'][3]['tasks'][0]['questions'][0]['type']='speaking';
        $snapshot['sections'][3]['tasks'][0]['questions'][0]['rubric']='Assess transcript conservatively.';
        $attempt->update(['snapshot'=>$snapshot]);
        $ai=\Mockery::mock(ExamAi::class);
        $ai->shouldReceive('assess')->once()->withArgs(fn($items,$level)=>$level==='A1' && $items[0]['answer']==='Es iet.' && $items[0]['transcript_candidates']===$candidates)
            ->andReturn(['q3'=>['points'=>15,'feedback'=>'Варианты распознавания расходятся.','example'=>'','errors'=>[],'recommendation'=>'']]);
        (new ExamGrader(app(ExamDefinition::class),$ai))->grade($attempt->id);
        $this->assertSame('completed',$attempt->fresh()->status);
        $this->assertSame('Es iet.',$attempt->fresh()->answers['q3']['text']);
        $payload=app(ExamSession::class)->payload($attempt->fresh());
        $this->assertSame($candidates,$payload['answers']['q3']['transcript_candidates']);
    }

    public function test_active_transcription_does_not_consume_grading_retries(): void
    {
        $attempt=$this->attempt(['status'=>'pending','answers'=>['q3'=>['processing'=>'upload-token']]]);
        app(ExamGrader::class)->grade($attempt->id);
        $this->assertSame('pending',$attempt->fresh()->status);
        $this->assertSame(0,$attempt->fresh()->grading_tries);
    }

    public function test_subscription_expiry_does_not_consume_grading_retries(): void
    {
        $attempt = $this->attempt(['status' => 'pending', 'answers' => ['q2' => ['text' => 'Test answer']]]);
        $snapshot = $attempt->snapshot;
        $snapshot['sections'][2]['tasks'][0]['questions'][0]['type'] = 'essay';
        $snapshot['sections'][2]['tasks'][0]['questions'][0]['rubric'] = 'Assess answer.';
        $attempt->update(['snapshot' => $snapshot]);
        $ai = \Mockery::mock(ExamAi::class);
        $ai->shouldReceive('assess')->once()->andThrow(new \Illuminate\Http\Exceptions\HttpResponseException(
            response()->json(['code' => 'subscription_required'], 402),
        ));
        (new ExamGrader(app(ExamDefinition::class), $ai))->grade($attempt->id);
        $this->assertSame('pending', $attempt->fresh()->status);
        $this->assertSame('subscription_required', $attempt->fresh()->grading_error);
        $this->assertSame(0, $attempt->fresh()->grading_tries);
        $this->assertSame('Test answer', $attempt->fresh()->answers['q2']['text']);
    }

    public function test_exhausted_retries_do_not_block_the_grading_queue(): void
    {
        $failed=$this->attempt(['status'=>'pending','grading_tries'=>3,'updated_at'=>now()->subMinutes(2)]);
        for($i=0;$i<20;$i++) {
            $copy=$failed->replicate();
            $copy->updated_at=now()->subMinutes(2);
            $copy->save();
        }
        $ready=$failed->replicate();
        $ready->grading_tries=0;
        $ready->updated_at=now()->subMinutes(2);
        $ready->save();
        $this->artisan('exams:maintain')->assertSuccessful();
        $this->assertSame('completed',$ready->fresh()->status);
        $this->assertSame(3,$failed->fresh()->grading_tries);
    }
}
