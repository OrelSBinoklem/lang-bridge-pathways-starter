<?php

namespace App\Services\Exams;

use RuntimeException;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

class ExamAudioInspection
{
    public function preflight(): void
    {
        foreach (['ffprobe', 'ffmpeg'] as $binary) (new Process([$binary, '-version']))->mustRun();
    }

    public function inspect(string $path): float
    {
        $probe = new Process(['ffprobe', '-v', 'error', '-show_entries', 'format=duration,format_name', '-of', 'json', $path]);
        $probe->mustRun();
        $format = json_decode($probe->getOutput(), true, flags: JSON_THROW_ON_ERROR)['format'] ?? [];
        $duration = is_numeric($format['duration'] ?? null) ? (float) $format['duration'] : 0;
        if (($format['format_name'] ?? null) !== 'mp3' || !is_finite($duration) || $duration <= 0 || $duration > 7200) throw new RuntimeException('Invalid MP3 format/duration. Retained file needs inspection, not paid retry.');
        (new Process(['ffmpeg', '-v', 'error', '-xerror', '-i', $path, '-f', 'null', '-']))->mustRun();
        return $duration;
    }

    public function receipt(string $relative, float $duration): void
    {
        $disk = Storage::disk('local');
        $checksum = hash_file('sha256', $disk->path($relative));
        if (!$checksum || !is_finite($duration) || $duration <= 0 || $duration > 7200) throw new RuntimeException('Invalid inspection receipt.');
        if (!$disk->put($relative.'.inspection.json', json_encode(['bytes_sha256' => $checksum, 'seconds' => $duration, 'strict_decode' => true], JSON_THROW_ON_ERROR))) {
            throw new RuntimeException('Inspection receipt write failed.');
        }
    }

    public function verifyReceipt(string $relative, float $duration): void
    {
        $disk = Storage::disk('local');
        if (!$disk->exists($relative.'.inspection.json')) throw new RuntimeException('Audio inspection receipt is missing.');
        $receipt = json_decode($disk->get($relative.'.inspection.json'), true, flags: JSON_THROW_ON_ERROR);
        $checksum = hash_file('sha256', $disk->path($relative));
        if (($receipt['strict_decode'] ?? null) !== true || !is_numeric($receipt['seconds'] ?? null)
            || !is_finite((float) $receipt['seconds']) || abs((float) $receipt['seconds'] - $duration) > 0.05
            || !is_string($receipt['bytes_sha256'] ?? null) || !$checksum || !hash_equals($receipt['bytes_sha256'], $checksum)) {
            throw new RuntimeException('Audio bytes or duration differ from strict inspection.');
        }
    }
}
