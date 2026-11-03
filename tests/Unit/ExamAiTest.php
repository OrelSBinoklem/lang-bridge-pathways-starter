<?php

namespace Tests\Unit;

use App\Services\Exams\ExamAi;
use Illuminate\Support\Facades\Http;
use RuntimeException;
use Tests\TestCase;

class ExamAiTest extends TestCase
{
    private function multipart($request): array
    {
        return array_column($request->data(), 'contents', 'name');
    }

    private function ai(): ExamAi
    {
        return new class extends ExamAi {
            public function settings(): array { return ['key'=>'test-only','model'=>'test-model','transcribe'=>'test-auto','transcribe_secondary'=>'test-lv']; }
        };
    }

    private function grade(array $changes = []): array
    {
        return $changes + ['id'=>'writing-1', 'points'=>2, 'feedback'=>'Исправьте падеж.',
            'example'=>'Es dzīvoju Rīgā.', 'recommendation'=>'Повторите местный падеж.',
            'errors'=>[['original'=>'Rīga','correction'=>'Rīgā','explanation'=>'Здесь нужен местный падеж.']]];
    }

    private function response(array $grade): void
    {
        Http::preventStrayRequests();
        Http::fake(['api.openai.com/v1/responses'=>Http::response(['status'=>'completed', 'output'=>[
            ['content'=>[['type'=>'output_text','text'=>json_encode(['answers'=>[$grade]],JSON_UNESCAPED_UNICODE)]]],
        ]])]);
    }

    private function items(): array
    {
        return [['id'=>'writing-1','maximum'=>5,'answer'=>'Es dzīvoju Rīga.','rubric'=>'Assess A2 grammar.']];
    }

    public function test_specific_errors_and_recommendation_survive_validation(): void
    {
        $this->response($this->grade());
        $result = $this->ai()->assess($this->items(), 'A2');
        $this->assertSame($this->grade(), $result['writing-1']);
        Http::assertSent(fn($request)=>$request['store'] === false && $request['text']['format']['strict'] === true
            && $request['model'] === 'test-model' && $request['reasoning']['effort'] === 'medium');
    }

    public function test_invented_student_quote_is_rejected(): void
    {
        $this->response($this->grade(['errors'=>[['original'=>'Never written','correction'=>'Correct','explanation'=>'Wrong quote']]]));
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Ungrounded exam feedback');
        $this->ai()->assess($this->items(), 'A2');
    }

    public function test_no_errors_is_valid_and_does_not_require_fake_mistakes(): void
    {
        $this->response($this->grade(['errors'=>[], 'points'=>5]));
        $this->assertSame([], $this->ai()->assess($this->items(), 'B2')['writing-1']['errors']);
    }

    public function test_score_cannot_exceed_the_question_maximum(): void
    {
        $this->response($this->grade(['points'=>6]));
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Invalid exam grade');
        $this->ai()->assess($this->items(), 'B1');
    }

    public function test_two_transcription_passes_preserve_raw_errors_and_language_hints(): void
    {
        Http::preventStrayRequests();
        Http::fake(fn($request)=>Http::response(['text'=>$this->multipart($request)['model'] === 'test-auto' ? 'Es iet uz darbu.' : 'Es eju uz darbu.']));
        $answer=$this->ai()->transcribe('test-audio','webm');
        $this->assertSame('Es iet uz darbu.',$answer['text']);
        $this->assertSame('primary',$answer['transcription_selected']);
        $this->assertSame(['Es iet uz darbu.','Es eju uz darbu.'],array_column($answer['transcript_candidates'],'text'));
        Http::assertSentCount(2);
        Http::assertSent(fn($r)=>$this->multipart($r)['model']==='test-auto' && !isset($this->multipart($r)['language']) && str_contains($this->multipart($r)['prompt'],'Do not translate, correct'));
        Http::assertSent(fn($r)=>$this->multipart($r)['model']==='test-lv' && $this->multipart($r)['language']==='lv');
    }

    public function test_primary_failure_uses_secondary_without_losing_failure_metadata(): void
    {
        Http::preventStrayRequests();
        Http::fake(fn($r)=>$this->multipart($r)['model']==='test-auto' ? Http::response(['error'=>'unavailable'],503) : Http::response(['text'=>'Es dzīvoju Rīga.']));
        $answer=$this->ai()->transcribe('test-audio','webm');
        $this->assertSame('secondary',$answer['transcription_selected']);
        $this->assertSame('Es dzīvoju Rīga.',$answer['text']);
        $this->assertFalse($answer['transcript_candidates'][0]['ok']);
        $this->assertSame('',$answer['transcript_candidates'][0]['text']);
        Http::assertSentCount(2);
    }

    public function test_secondary_connection_failure_does_not_discard_primary(): void
    {
        Http::preventStrayRequests();
        Http::fake(fn($r)=>$this->multipart($r)['model']==='test-lv' ? Http::failedConnection() : Http::response(['text'=>'Es strādā skolā.']));
        $answer=$this->ai()->transcribe('test-audio','webm');
        $this->assertSame('primary',$answer['transcription_selected']);
        $this->assertSame('Es strādā skolā.',$answer['text']);
        $this->assertFalse($answer['transcript_candidates'][1]['ok']);
    }

    public function test_empty_or_failed_transcriptions_do_not_become_a_zero_answer(): void
    {
        Http::preventStrayRequests();
        Http::fake(fn($r)=>$this->multipart($r)['model']==='test-auto' ? Http::response(['text'=>'   ']) : Http::response([],500));
        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Both exam transcription passes failed');
        $this->ai()->transcribe('test-audio','webm');
    }
}
