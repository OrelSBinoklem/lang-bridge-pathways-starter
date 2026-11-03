<?php

namespace App\Console\Commands;

use App\Models\LessonBlockVariant;
use Dotenv\Dotenv;
use Illuminate\Console\Command;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Http;

class GenerateCourseListeningAudio extends Command
{
    protected $signature = 'course:generate-listening-audio
        {--generate : Send prepared dialogues to ElevenLabs and save audio}
        {--regenerate : Explicitly replace previously generated audio; editor-supplied audio is always preserved}
        {--limit= : Process at most this many variants}
        {--group= : Restrict to one category ID; default is the original 1763/1764 pilots}
        {--max-characters= : Abort before requests if pending dialogue characters exceed this budget}
        {--voice-a= : Voice ID for speaker A; overrides the selected course default and local environment}
        {--voice-b= : Voice ID for speaker B; overrides the local environment}';

    protected $description = 'Preview or generate shared ElevenLabs v3 course dialogues with authored speaker casting';

    public function handle(): int
    {
        $groupId = $this->option('group');
        if ($groupId !== null && (!ctype_digit((string) $groupId) || (int) $groupId < 1)) {
            $this->error('--group must be a positive category ID.');
            return self::FAILURE;
        }
        $budget = $this->option('max-characters');
        if ($budget !== null && (!ctype_digit((string) $budget) || (int) $budget < 1)) {
            $this->error('--max-characters must be a positive integer.');
            return self::FAILURE;
        }

        $query = LessonBlockVariant::query()
            ->with('block.page.courseGroup')
            ->whereHas('block.page.courseGroup', fn ($query) => $query->whereIn('category_id', $groupId ? [(int) $groupId] : [1763, 1764]))
            ->whereHas('block', fn ($query) => $query->where('type', 'listening'))
            ->orderBy('id');
        $variants = $query->get()->filter(fn ($variant) => ($variant->config['task_kind'] ?? null) === 'listening');
        $limit = $this->option('limit');
        if ($limit !== null) {
            if (!ctype_digit((string) $limit) || (int) $limit < 1) {
                $this->error('--limit должен быть положительным числом.');
                return self::FAILURE;
            }
            $variants = $variants->take((int) $limit);
        }

        $settings = $this->settings();
        $settings['voice_a'] = trim((string) ($this->option('voice-a') ?: $settings['voice_a']));
        $settings['voice_b'] = trim((string) ($this->option('voice-b') ?: $settings['voice_b']));
        $isGenerating = (bool) $this->option('generate');
        if ($isGenerating && !$settings['key']) {
            $this->error('Для генерации нужен ELEVENLABS_API_KEY в tools/tutor-gateway/.env.');
            return self::FAILURE;
        }

        $pending = [];
        $characters = 0;
        foreach ($variants as $variant) {
            $config = $variant->config ?? [];
            $segments = $config['dialogue_segments'] ?? [];
            if (!$this->validSegments($segments)) {
                $this->warn("Вариант {$variant->id}: реплики не заполнены или голоса A/B отсутствуют.");
                continue;
            }
            if (!empty($config['audio_url']) && empty($config['audio_generation']['sha256'])) {
                $this->warn("Вариант {$variant->id}: установлен редакторский аудиофайл, пропускаю.");
                continue;
            }
            if (!empty($config['audio_url']) && !$this->option('regenerate')) {
                $this->line("Вариант {$variant->id}: готовая озвучка сохранена; для замены нужен --regenerate.");
                continue;
            }

            try {
                $voices = $this->voicesFor($config, $settings);
            } catch (\RuntimeException $error) {
                $this->error("Вариант {$variant->id}: ".$error->getMessage().' API-вызовы не отправлялись.');
                return self::FAILURE;
            }
            $inputs = array_map(fn ($segment) => [
                'text' => trim($segment['text']),
                'voice_id' => $voices[$segment['speaker']],
            ], $segments);
            $count = array_sum(array_map(fn ($input) => mb_strlen($input['text']), $inputs));
            if ($count > 2000) {
                $this->warn("Вариант {$variant->id}: {$count} символов, лимит диалога 2000.");
                continue;
            }

            $hash = hash('sha256', json_encode([$settings['model'], 'lv', $inputs], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
            $categoryId = $variant->block->page->courseGroup->category_id;
            $relative = "audio/course/listening/{$categoryId}-{$variant->id}-" . substr($hash, 0, 16) . '.mp3';
            $path = base_path("frontend/public/{$relative}");
            if (File::exists($path) && ($config['audio_generation']['sha256'] ?? null) === $hash) {
                $this->line("Вариант {$variant->id}: уже озвучен, пропускаю.");
                continue;
            }

            $pending[] = compact('variant', 'config', 'inputs', 'voices', 'count', 'hash', 'relative', 'path');
            $characters += $count;
            $this->line("Вариант {$variant->id}: {$count} символов, {$categoryId}, " . count($segments) . ' реплик.');
        }

        $this->info('К обработке: ' . count($pending) . " файлов, {$characters} символов. Стоимость зависит от тарифа ElevenLabs.");
        if ($budget !== null && $characters > (int) $budget) {
            $this->error('Character budget exceeded; no API requests sent.');
            return self::FAILURE;
        }
        if (!$isGenerating || !$pending) return self::SUCCESS;

        foreach ($pending as $item) {
            $variant = $item['variant'];
            if (!File::exists($item['path'])) {
                try {
                    $response = Http::withHeaders(['xi-api-key' => $settings['key']])
                        ->accept('audio/mpeg')
                        ->timeout(120)
                        ->post('https://api.elevenlabs.io/v1/text-to-dialogue?output_format=mp3_44100_128', [
                            'inputs' => $item['inputs'],
                            'model_id' => $settings['model'],
                            'language_code' => 'lv',
                        ]);
                } catch (ConnectionException) {
                    $this->error("Вариант {$variant->id}: соединение прервано, результат списания неизвестен. Генерация остановлена; проверьте ElevenLabs перед повтором.");
                    return self::FAILURE;
                }
                if (!$response->successful()) {
                    $this->error("Вариант {$variant->id}: ElevenLabs вернул HTTP {$response->status()}. Остальные файлы не отправлялись.");
                    if ($response->json('detail.status') === 'quota_exceeded') {
                        $this->warn('Лимит ElevenLabs исчерпан. Пополните баланс перед продолжением.');
                    }
                    return self::FAILURE;
                }
                $audio = $response->body();
                if (strlen($audio) < 1000) {
                    $this->error("Вариант {$variant->id}: получен пустой аудиофайл.");
                    return self::FAILURE;
                }
                File::ensureDirectoryExists(dirname($item['path']));
                if (File::put($item['path'], $audio) === false) {
                    $this->error("Вариант {$variant->id}: не удалось сохранить аудиофайл.");
                    return self::FAILURE;
                }
            }

            $transcript = implode("\n", array_map(
                fn ($segment) => strtoupper($segment['speaker']) . ': ' . trim($segment['text']),
                $item['config']['dialogue_segments'],
            ));
            $variant->update(['config' => [
                ...$item['config'],
                'audio_url' => '/' . str_replace('\\', '/', $item['relative']),
                'transcript' => $transcript,
                'audio_generation' => [
                    'provider' => 'elevenlabs',
                    'model' => $settings['model'],
                    'language' => 'lv',
                    'voice_ids' => $item['voices'],
                    'sha256' => $item['hash'],
                    'character_count' => $item['count'],
                    'generated_at' => now()->toIso8601String(),
                ],
            ]]);
            $this->info("Вариант {$variant->id}: файл сохранён.");
        }
        return self::SUCCESS;
    }

    private function validSegments(mixed $segments): bool
    {
        if (!is_array($segments) || count($segments) < 2) return false;
        $speakers = [];
        foreach ($segments as $segment) {
            if (!is_array($segment) || !in_array($segment['speaker'] ?? null, ['a', 'b'], true)
                || trim((string) ($segment['text'] ?? '')) === '') return false;
            $speakers[$segment['speaker']] = true;
        }
        return count($speakers) === 2;
    }

    /** @return array<string, mixed> */
    private function settings(): array
    {
        $path = base_path('tools/tutor-gateway/.env');
        $environment = File::exists($path) ? Dotenv::parse(File::get($path)) : [];
        $catalog = json_decode(File::get(resource_path('course/voice-previews/shortlist.json')), true, 512, JSON_THROW_ON_ERROR);
        $defaultMale = collect($catalog['candidates'])->firstWhere('key', $catalog['defaults']['male']);
        if (empty($defaultMale['voice_id'])) {
            throw new \RuntimeException('Selected course male voice must be saved in the ElevenLabs library before generation.');
        }
        return [
            'key' => trim((string) ($environment['ELEVENLABS_API_KEY'] ?? '')),
            'voice_a' => trim((string) $defaultMale['voice_id']),
            'voice_b' => trim((string) ($environment['ELEVENLABS_DIALOGUE_VOICE_B_ID'] ?? collect($catalog['candidates'])->firstWhere('key', $catalog['defaults']['female'])['voice_id'] ?? '')),
            'model' => 'eleven_v3',
            'defaults' => $catalog['defaults'],
            'candidates' => collect($catalog['candidates'])->keyBy('key')->all(),
        ];
    }

    /** Cast by character, not A/B position; explicit CLI choices remain editorial overrides. */
    private function voicesFor(array $config, array $settings): array
    {
        $profiles = $config['speaker_profiles'] ?? null;
        $voices = ['a' => $settings['voice_a'], 'b' => $settings['voice_b']];
        if ($profiles !== null) {
            $assigned = [];
            foreach (['a', 'b'] as $speaker) {
                $profile = $profiles[$speaker] ?? [];
                $gender = $profile['gender'] ?? null;
                if (!in_array($gender, ['male', 'female'], true)) throw new \RuntimeException('У персонажа не указан пол.');
                $override = trim((string) $this->option('voice-'.$speaker));
                if ($override) { $voices[$speaker] = $override; $assigned[$gender] = true; continue; }
                $key = $profile['voice_key'] ?? $settings['defaults'][isset($assigned[$gender])
                    ? ($gender === 'male' ? 'male_playful' : 'female_secondary') : $gender] ?? null;
                $candidate = $settings['candidates'][$key] ?? null;
                if (!$candidate || $candidate['gender'] !== $gender || empty($candidate['voice_id'])
                    || ($candidate['library_status'] ?? null) === 'preview_only') {
                    throw new \RuntimeException('Выбранный голос должен соответствовать полу и быть сохранён в библиотеке ElevenLabs.');
                }
                // Keep the configured female voice for legacy casting unless an explicit key is authored.
                $voices[$speaker] = $gender === 'female' && !isset($assigned[$gender]) && !isset($profile['voice_key'])
                    ? $settings['voice_b'] : $candidate['voice_id'];
                $assigned[$gender] = true;
            }
        }
        if (!$voices['a'] || !$voices['b'] || $voices['a'] === $voices['b']) {
            throw new \RuntimeException('Для двух персонажей нужны два разных сохранённых голоса.');
        }
        return $voices;
    }
}
