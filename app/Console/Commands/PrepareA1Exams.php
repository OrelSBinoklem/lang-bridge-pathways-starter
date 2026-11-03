<?php

namespace App\Console\Commands;

use App\Models\{CourseExam, ExamVariant};
use Dotenv\Dotenv;
use Illuminate\Console\Command;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\{DB, Http, Storage};
use Symfony\Component\Process\Process;

class PrepareA1Exams extends Command
{
    protected $signature = 'exams:prepare-a1 {--write} {--generate} {--publish} {--max-characters=20000}';
    protected $description = 'Import five original A1 exams without overwriting edits; optionally generate shared ElevenLabs audio';

    protected function examLevel(): string { return 'A1'; }

    public function handle(): int
    {
        $level = $this->examLevel();
        if (!in_array($level, ['A1','A2','B1','B2'], true)) { $this->error('Choose A1, A2, B1 or B2.'); return self::FAILURE; }
        $source = require resource_path('course/exams/'.strtolower($level).'.php');
        foreach ($source as $variant) app(\App\Services\Exams\ExamDefinition::class)->validate($variant);
        $this->info($level.': '.count($source).' variants; section minutes: '.implode('/',array_map(fn($s)=>$s['seconds']/60,$source[0]['sections'])));
        $spoken = 0;
        foreach ($source as $variant) foreach ($variant['sections'][0]['tasks'] as $task) foreach ($task['segments'] as $segment) $spoken += mb_strlen($segment['text']);
        $this->info('Source spoken characters: '.$spoken.'. Dry run never writes or calls a provider.');
        if (!$this->option('write') && !$this->option('generate') && !$this->option('publish')) return self::SUCCESS;
        foreach (['A1','A2','B1','B2'] as $shellLevel) CourseExam::firstOrCreate(['level'=>$shellLevel,'learn_lang'=>'lv'], ['title'=>'Итоговый экзамен '.$shellLevel]);
        $exam=CourseExam::where('level',$level)->where('learn_lang','lv')->firstOrFail();
        foreach ($source as $index=>$variant) ExamVariant::firstOrCreate(['course_exam_id'=>$exam->id,'position'=>$index+1], ['title'=>$variant['title'],'content'=>$variant]);
        $variants=$exam->variants()->get();
        $voices=['male'=>'SqGJaEOnW97EMDTsC4pw','female'=>'Z7lsHmuN8xVOHr7J4AO0'];
        $pending=[]; $characters=0;
        foreach ($variants as $variant) foreach ($variant->content['sections'][0]['tasks'] as $index=>$task) {
            if (!empty($task['audio_path'])) continue;
            $inputs=[];
            foreach ($task['segments'] ?? [] as $segment) {
                if (!isset($voices[$segment['speaker'] ?? '']) || empty($segment['text'])) { $this->error('Invalid speaker or empty segment.'); return self::FAILURE; }
                $inputs[]=['voice_id'=>$voices[$segment['speaker']],'text'=>$segment['text']];
            }
            if (!$inputs) { $this->error('No dialogue segments.'); return self::FAILURE; }
            $count=array_sum(array_map(fn($input)=>mb_strlen($input['text']),$inputs));
            if ($count>5000) { $this->error('A dialogue exceeds 5000 characters.'); return self::FAILURE; }
            $hash=hash('sha256',json_encode(['eleven_v3','lv',$inputs],JSON_UNESCAPED_UNICODE));
            $path='exams/'.strtolower($level).'/'.$hash.'.mp3';
            if (!Storage::disk('local')->exists($path)) $characters+=$count;
            $pending[]=compact('variant','index','inputs','path');
        }
        $this->info(count($pending).' audio assets pending; '.$characters.' new spoken characters.');
        if ($this->option('generate') && $characters>(int)$this->option('max-characters')) { $this->error('Budget exceeded; no API calls.'); return self::FAILURE; }
        if ($this->option('generate')) {
            $env=Dotenv::createArrayBacked(base_path('tools/tutor-gateway'))->safeLoad();
            $key=$env['ELEVENLABS_API_KEY'] ?? '';
            if (!$key) { $this->error('ElevenLabs key not configured.'); return self::FAILURE; }
            foreach ($pending as $item) {
                if (!Storage::disk('local')->exists($item['path'])) {
                    try {
                        $response=Http::withHeaders(['xi-api-key'=>$key])->accept('audio/mpeg')->timeout(180)
                            ->post('https://api.elevenlabs.io/v1/text-to-dialogue?output_format=mp3_44100_128', ['inputs'=>$item['inputs'],'model_id'=>'eleven_v3','language_code'=>'lv']);
                    } catch (ConnectionException) {
                        $this->error('ElevenLabs connection interrupted. Saved audio is retained; no automatic paid retry. The failed request may have been billed.');
                        return self::FAILURE;
                    }
                    if (!$response->successful() || strlen($response->body())<1000) { $this->error('ElevenLabs HTTP '.$response->status().'; stopped without retrying paid requests.'); return self::FAILURE; }
                    if (!Storage::disk('local')->put($item['path'],$response->body())) { $this->error('Audio write failed.'); return self::FAILURE; }
                }
                $process=new Process(['ffprobe','-v','error','-show_entries','format=duration','-of','default=noprint_wrappers=1:nokey=1',Storage::disk('local')->path($item['path'])]);
                $process->mustRun();
                $duration=(float)trim($process->getOutput());
                if ($duration<=0) { $this->error('Invalid MP3.'); return self::FAILURE; }
                $variant=$item['variant']->fresh(); $content=$variant->content;
                $content['sections'][0]['tasks'][$item['index']]['audio_path']=$item['path'];
                $content['sections'][0]['tasks'][$item['index']]['audio_seconds']=$duration;
                $variant->update(['content'=>$content]);
                $this->info('Variant '.$variant->position.', task '.($item['index']+1).': '.round($duration,1).' seconds.');
            }
        }
        if ($this->option('publish')) {
            $ready = $exam->variants()->get();
            foreach ($ready as $variant) app(\App\Services\Exams\ExamDefinition::class)->validate($variant->content, true);
            DB::transaction(function () use ($ready, $exam) {
                foreach ($ready as $variant) $variant->update(['is_published'=>true]);
                $exam->update(['is_published'=>true]);
            });
            $this->info($level.' published in the current database. Other levels unchanged.');
        }
        return self::SUCCESS;
    }
}
