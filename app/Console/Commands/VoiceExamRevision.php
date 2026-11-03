<?php

namespace App\Console\Commands;

use App\Services\Exams\{ExamAudioInspection, ExamAudioRecipe, ExamRevision};
use Dotenv\Dotenv;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\{File, Http, Log, Storage};
use RuntimeException;

class VoiceExamRevision extends Command
{
    protected $signature = 'exams:voice-revision {pack : Reviewed listening-only JSON revision}
        {--generate : Paid shared audio generation; does not edit or publish the database}
        {--max-characters=0 : Explicit maximum uncached input characters}
        {--output= : Prepared JSON under the repository .tmp directory}';
    protected $description = 'Preflight and voice a guarded listening revision without changing live exam definitions';

    public function handle(ExamAudioRecipe $recipes, ExamRevision $revision, ExamAudioInspection $inspection): int
    {
        $phase = 'preflight';
        try {
            $pack = json_decode(file_get_contents($this->argument('pack')), true, flags: JSON_THROW_ON_ERROR);
            if (count(array_unique(array_column($pack['variants'] ?? [], 'level'))) !== 1) {
                throw new RuntimeException('Voice one level per revision pack.');
            }
            foreach ($pack['variants'] ?? [] as $entry) {
                if (array_keys($entry['replace_sections'] ?? []) !== ['listening'] || !empty($entry['question_changes'])) {
                    throw new RuntimeException('Only listening section replacements may be voiced by this command.');
                }
            }
            $revision->previewAudioDraft($pack);
            $pending = [];
            $characters = 0;
            foreach ($pack['variants'] as $v => &$entry) {
                foreach ($entry['replace_sections']['listening']['tasks'] as $t => &$task) {
                    if (!empty($task['audio_path']) && !isset($task['audio_generation'])) {
                        throw new RuntimeException('Editor-supplied or legacy audio must not be overwritten.');
                    }
                    $recipe = $recipes->build($entry['level'], $task);
                    $task['segments'] = $recipe['segments'];
                    $pending[$recipe['sha256']] = $recipe;
                }
                unset($task);
            }
            unset($entry);
            // Count a shared recipe once, even if multiple tasks reference it.
            $characters = array_sum(array_map(fn ($r) => Storage::disk('local')->exists($r['path']) ? 0 : $r['characters'], $pending));
            $this->info(count($pending).' distinct audio recipes; '.$characters.' uncached input characters.');
            if (!$this->option('generate')) {
                $this->info('Dry run: no files, database writes or provider requests.');
                return self::SUCCESS;
            }
            $budget = (string) $this->option('max-characters');
            if (!ctype_digit($budget) || (int) $budget < 1) throw new RuntimeException('Explicit character budget missing; no provider requests.');
            $directory = config('services.elevenlabs.exam_audio_workspace', base_path('.tmp/exam-audio-revisions'));
            $tmpRoot = str_replace('\\', '/', realpath(base_path('.tmp')) ?: '');
            $tmpPrefix = (PHP_OS_FAMILY === 'Windows' ? strtolower($tmpRoot) : $tmpRoot).'/';
            $parent = str_replace('\\', '/', realpath(dirname($directory)) ?: '');
            if (!$tmpRoot || !$parent || in_array(basename(str_replace('\\', '/', $directory)), ['.', '..'], true)
                || !str_starts_with((PHP_OS_FAMILY === 'Windows' ? strtolower($parent) : $parent).'/', $tmpPrefix)) {
                throw new RuntimeException('Audio workspace must stay inside repository .tmp.');
            }
            File::ensureDirectoryExists($directory);
            $directory = str_replace('\\', '/', realpath($directory) ?: '');
            if (!$directory || !str_starts_with((PHP_OS_FAMILY === 'Windows' ? strtolower($directory) : $directory).'/', $tmpPrefix)) {
                throw new RuntimeException('Audio workspace must stay inside repository .tmp.');
            }
            $output = $this->option('output') ?: $directory.'/'.hash('sha256', json_encode($pack, JSON_THROW_ON_ERROR)).'-ready.json';
            $outputDirectory = realpath(dirname($output));
            $root = realpath(base_path('.tmp'));
            if (!$outputDirectory || !str_starts_with(strtolower(str_replace('\\', '/', $outputDirectory)).'/', strtolower(str_replace('\\', '/', $root)).'/')) {
                throw new RuntimeException('Output must be inside the existing repository .tmp directory.');
            }
            $output = $outputDirectory.'/'.basename($output);
            if (realpath($output) === realpath($this->argument('pack'))) throw new RuntimeException('Do not overwrite the authored source.');
            $lock = fopen($directory.'/generation.lock', 'c');
            if (!$lock) throw new RuntimeException('Cannot open filesystem generation lock.');
            if (!flock($lock, LOCK_EX | LOCK_NB)) { fclose($lock); throw new RuntimeException('Another exam audio generation is active.'); }
            try {
                $characters = array_sum(array_map(fn ($r) => Storage::disk('local')->exists($r['path']) ? 0 : $r['characters'], $pending));
                if ($characters > (int) $budget) throw new RuntimeException('Explicit character budget exceeded; no provider requests.');
                // Preflight every recipe before any billable request, including uncertain prior requests.
                foreach ($pending as $recipe) {
                    $marker = $directory.'/'.$recipe['sha256'].'.request.json';
                    if (!Storage::disk('local')->exists($recipe['path']) && is_file($marker)) {
                        throw new RuntimeException('Unresolved previous paid request '.$recipe['sha256'].'. Verify provider history before retrying; no automatic retry.');
                    }
                }
                $inspection->preflight();
                $durations = [];
                foreach ($pending as $recipe) if (Storage::disk('local')->exists($recipe['path'])) {
                    $durations[$recipe['sha256']] = $inspection->inspect(Storage::disk('local')->path($recipe['path']));
                }
                $key = '';
                if ($characters > 0) {
                    $envPath = base_path('tools/tutor-gateway/.env');
                    $env = File::exists($envPath) ? Dotenv::parse(File::get($envPath)) : [];
                    $key = $env['ELEVENLABS_API_KEY'] ?? '';
                    if (!$key) throw new RuntimeException('ElevenLabs key not configured.');
                    $subscription = Http::withHeaders(['xi-api-key' => $key])->timeout(30)->get('https://api.elevenlabs.io/v1/user/subscription');
                    $used = $subscription->json('character_count');
                    $limit = $subscription->json('character_limit');
                    if (!$subscription->successful() || !is_int($used) || !is_int($limit)) throw new RuntimeException('Cannot verify available credits; no TTS requests.');
                    $remaining = max(0, $limit - $used);
                    $this->info('Available included credits: '.$remaining.'. Conservative preflight: one credit per input character.');
                    if ($characters > $remaining) throw new RuntimeException('Included ElevenLabs credits are insufficient. Top up before continuing; automatic overage is not enabled by this command.');
                    $voiceIds = [];
                    foreach ($pending as $recipe) if (!Storage::disk('local')->exists($recipe['path'])) {
                        foreach ($recipe['request']['inputs'] as $input) $voiceIds[$input['voice_id']] = true;
                    }
                    foreach (array_keys($voiceIds) as $id) {
                        $response = Http::withHeaders(['xi-api-key' => $key])->timeout(30)->get('https://api.elevenlabs.io/v1/voices/'.rawurlencode($id));
                        if (!$response->successful() || $response->json('voice_id') !== $id) throw new RuntimeException('A selected voice is not available; no TTS requests.');
                    }
                }
                foreach ($pending as $recipe) {
                    $marker = $directory.'/'.$recipe['sha256'].'.request.json';
                    if (!Storage::disk('local')->exists($recipe['path'])) {
                        $requestState = json_encode(['sha256' => $recipe['sha256'], 'status' => 'request_started', 'at' => now()->toIso8601String()], JSON_THROW_ON_ERROR);
                        $handle = fopen($marker, 'x');
                        if (!$handle) throw new RuntimeException('Cannot exclusively claim the paid request; no request sent.');
                        try {
                            if (fwrite($handle, $requestState) !== strlen($requestState) || !fflush($handle)) throw new RuntimeException('Cannot record request state; no paid request sent.');
                        } finally { fclose($handle); }
                        $phase = 'paid_request';
                        $response = Http::withHeaders(['xi-api-key' => $key])->accept('audio/mpeg')->timeout(180)
                            ->post('https://api.elevenlabs.io/v1/text-to-dialogue?output_format=mp3_44100_128', $recipe['request']);
                        if (!$response->successful() || strlen($response->body()) < 1000) {
                            $quota = $response->json('detail.status') === 'quota_exceeded' ? ' Credits exhausted; top up.' : '';
                            throw new RuntimeException('ElevenLabs HTTP '.$response->status().'.'.$quota.' Stopped without retry; check billing before recovery.');
                        }
                        if (!Storage::disk('local')->put($recipe['path'], $response->body())) throw new RuntimeException('Audio write failed; paid response may have been billed.');
                    }
                    $phase = 'audio_verification';
                    $duration = $durations[$recipe['sha256']] ?? $inspection->inspect(Storage::disk('local')->path($recipe['path']));
                    $inspection->receipt($recipe['path'], $duration);
                    foreach ($pack['variants'] as &$entry) foreach ($entry['replace_sections']['listening']['tasks'] as &$task) {
                        if ($recipes->build($entry['level'], $task)['sha256'] !== $recipe['sha256']) continue;
                        $task['audio_path'] = $recipe['path'];
                        $task['audio_seconds'] = $duration;
                        $task['audio_generation'] = ['version' => 2, 'sha256' => $recipe['sha256']];
                    }
                    unset($entry, $task);
                    File::put($marker, json_encode(['sha256' => $recipe['sha256'], 'status' => 'decoded', 'seconds' => $duration], JSON_THROW_ON_ERROR));
                    $this->info(substr($recipe['sha256'], 0, 12).': decoded, '.round($duration, 1).' seconds.');
                }
                // The administrator may have edited the DB while generation was running.
                $revision->apply($pack);
                $temporary = $output.'.pending';
                if (File::put($temporary, json_encode($pack, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)) === false || !rename($temporary, $output)) {
                    throw new RuntimeException('Cannot write the prepared revision. Cached audio is retained.');
                }
                $this->info('Prepared JSON: '.$output.'. Database unchanged; editorial listening review is still required.');
            } finally {
                flock($lock, LOCK_UN);
                fclose($lock);
            }
            return self::SUCCESS;
        } catch (\Throwable $error) {
            Log::warning('Exam audio revision failed', ['phase' => $phase, 'exception' => get_class($error)]);
            // Provider exception messages may contain headers/credentials; never print them.
            $safe = $error instanceof RuntimeException && !$error instanceof \Illuminate\Http\Client\ConnectionException;
            $this->error($safe ? $error->getMessage() : 'Audio preparation failed. Saved assets are retained; inspect local diagnostics. No automatic paid retry.');
            return self::FAILURE;
        }
    }
}
