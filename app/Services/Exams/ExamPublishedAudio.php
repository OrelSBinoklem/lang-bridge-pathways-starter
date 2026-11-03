<?php

namespace App\Services\Exams;

use Illuminate\Support\Facades\Storage;
use RuntimeException;

class ExamPublishedAudio
{
    public function textHash(array $item): string
    {
        $text = isset($item['segments']) ? array_column($item['segments'], 'text') : [$item['prompt'] ?? ''];
        return hash('sha256', json_encode($text, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    }

    public function verify(array $item): void
    {
        $metadata = $item['audio_generation'] ?? [];
        $path = $item['audio_path'] ?? '';
        if (($metadata['version'] ?? null) !== 3 || ($metadata['provider'] ?? null) !== 'google'
            || ($metadata['model'] ?? null) !== 'gemini-3.8-flash-tts'
            || !preg_match('~^exams/gemini/([a-f0-9]{64})\.mp3$~', $path, $match)
            || ($metadata['bytes_sha256'] ?? null) !== $match[1]
            || ($metadata['text_sha256'] ?? null) !== $this->textHash($item)
            || !Storage::disk('local')->exists($path)) {
            throw new RuntimeException('Gemini audio differs from its verified text or asset.');
        }
        $duration = $item['audio_seconds'] ?? 0;
        if (!is_numeric($duration) || !is_finite((float) $duration) || $duration <= 0 || $duration > 7200) {
            throw new RuntimeException('Invalid Gemini audio duration.');
        }
        app(ExamAudioInspection::class)->verifyReceipt($path, (float) $duration);
        if (!hash_equals($metadata['bytes_sha256'], hash_file('sha256', Storage::disk('local')->path($path)))) {
            throw new RuntimeException('Gemini audio filename does not match its bytes.');
        }
    }
}
