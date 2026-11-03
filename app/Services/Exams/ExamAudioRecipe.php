<?php

namespace App\Services\Exams;

use InvalidArgumentException;

class ExamAudioRecipe
{
    public function build(string $level, array $task): array
    {
        if (!in_array($level, ['A1', 'A2', 'B1', 'B2'], true)) throw new InvalidArgumentException('Unknown audio level.');
        $catalog = json_decode(file_get_contents(resource_path('course/voice-previews/shortlist.json')), true, flags: JSON_THROW_ON_ERROR);
        $voices = array_column($catalog['candidates'], null, 'key');
        $inputs = [];
        $segments = $task['segments'] ?? [];
        if (!$segments || !is_array($segments)) throw new InvalidArgumentException('Speech segments are required.');
        foreach ($segments as &$segment) {
            $gender = $segment['speaker'] ?? '';
            $text = $segment['text'] ?? '';
            if (!in_array($gender, ['male', 'female'], true) || !is_string($text) || trim($text) === '' || preg_match('/[\[\]]/u', $text)) {
                throw new InvalidArgumentException('Use clean spoken text and an explicit speaker gender.');
            }
            $key = $segment['voice_key'] ?? $catalog['defaults'][$gender];
            $voice = $voices[$key] ?? null;
            if (!$voice || ($voice['gender'] ?? null) !== $gender || empty($voice['voice_id']) || ($voice['library_status'] ?? '') === 'preview_only') {
                throw new InvalidArgumentException('Voice must be saved in the library and match the speaker gender.');
            }
            $segment['voice_key'] = $key;
            $delivery = $segment['delivery'] ?? null;
            if ($delivery !== null && !in_array($delivery, ['calm', 'thoughtful', 'friendly'], true)) throw new InvalidArgumentException('Unsupported delivery tag.');
            $pace = $segment['pace'] ?? null;
            if ($pace !== null && $pace !== 'slow') throw new InvalidArgumentException('Unsupported speech pace.');
            $inputs[] = ['voice_id' => $voice['voice_id'], 'text' => ($pace === 'slow' ? '[slowly] ' : '').($delivery ? '['.$delivery.'] ' : '').trim($text)];
        }
        unset($segment);
        $transcript = implode("\n", array_map(fn ($s) => trim($s['text']), $segments));
        if (($task['transcript'] ?? '') !== $transcript) throw new InvalidArgumentException('Transcript must match clean speech segments.');
        $characters = array_sum(array_map(fn ($input) => mb_strlen($input['text']), $inputs));
        if ($characters > 5000) throw new InvalidArgumentException('A recording exceeds the 5000 character safety limit.');
        $request = ['model_id' => 'eleven_v3', 'language_code' => 'lv', 'inputs' => $inputs];
        $hash = hash('sha256', json_encode(['version' => 2, 'output_format' => 'mp3_44100_128', 'request' => $request], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));
        return ['request' => $request, 'sha256' => $hash, 'characters' => $characters, 'segments' => $segments,
            'path' => 'exams/shared/v2/'.$hash.'.mp3'];
    }
}
