<?php

namespace App\Console\Commands;

use App\Models\LessonPage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use RuntimeException;

class AttachPreparedListeningAudio extends Command
{
    protected $signature = 'course:attach-listening-audio {category : Course category ID} {manifest : Prepared audio JSON} {--write : Copy verified files and attach them to variants}';
    protected $description = 'Attach existing listening recordings when variant IDs differ across databases';

    public function handle(): int
    {
        try {
            $category = (string) $this->argument('category');
            if (!ctype_digit($category) || (int) $category < 1) throw new RuntimeException('Invalid category ID.');
            $manifestPath = realpath((string) $this->argument('manifest'));
            if (!$manifestPath) throw new RuntimeException('Audio manifest not found.');
            $manifest = json_decode(File::get($manifestPath), true, 512, JSON_THROW_ON_ERROR)[$category] ?? null;
            if (!is_array($manifest) || count($manifest) !== 5) throw new RuntimeException('Expected five audio entries.');

            $page = LessonPage::query()->where('slug', "course-{$category}-listening")->first();
            if (!$page || $page->skill !== 'listening' || (string) $page->courseGroup?->category_id !== $category) {
                throw new RuntimeException('Listening lesson does not belong to this category.');
            }
            $block = $page->blocks()->where('type', 'listening')->sole();
            $variants = $block->variants()->orderBy('position')->get();
            if ($variants->count() !== 5) throw new RuntimeException('Expected five listening variants.');

            $pending = [];
            foreach ($variants as $index => $variant) {
                $entry = $manifest['variant:'.($index + 1)] ?? null;
                $config = $variant->config ?? [];
                $audio = $entry['audio_generation'] ?? [];
                $voices = $audio['voice_ids'] ?? [];
                $hash = $audio['sha256'] ?? '';
                if ($variant->seed_key !== 'variant:'.($index + 1) || !is_array($entry)
                    || ($audio['provider'] ?? null) !== 'elevenlabs' || ($audio['language'] ?? null) !== 'lv'
                    || !is_string($hash) || !preg_match('/^[a-f0-9]{64}$/D', $hash)
                    || empty($voices['a']) || empty($voices['b']) || $voices['a'] === $voices['b']) {
                    throw new RuntimeException('Invalid variant/audio metadata at position '.($index + 1));
                }
                $inputs = [];
                foreach ($config['dialogue_segments'] ?? [] as $segment) {
                    $speaker = $segment['speaker'] ?? null;
                    if (!in_array($speaker, ['a', 'b'], true) || !is_string($segment['text'] ?? null)) {
                        throw new RuntimeException("Invalid dialogue in variant {$variant->id}.");
                    }
                    $inputs[] = ['text' => trim($segment['text']), 'voice_id' => $voices[$speaker]];
                }
                $expected = hash('sha256', json_encode([$audio['model'] ?? null, 'lv', $inputs], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
                if ($expected !== $hash || hash('sha256', $config['transcript'] ?? '') !== ($entry['transcript_sha256'] ?? null)) {
                    throw new RuntimeException("Recording does not match variant {$variant->id}.");
                }
                $sourceUrl = $entry['audio_url'] ?? '';
                $prefix = substr($hash, 0, 16);
                if (!is_string($sourceUrl) || !preg_match('#^/audio/course/listening/'.$category.'-[0-9]+-'.$prefix.'\.mp3$#D', $sourceUrl)) {
                    throw new RuntimeException("Invalid source path for variant {$variant->id}.");
                }
                $source = base_path('frontend/public'.$sourceUrl);
                $targetUrl = "/audio/course/listening/{$category}-{$variant->id}-{$prefix}.mp3";
                $target = base_path('frontend/public'.$targetUrl);
                $fileHash = $entry['file_sha256'] ?? null;
                if (!is_file($source) || filesize($source) < 1000 || hash_file('sha256', $source) !== $fileHash
                    || (is_file($target) && hash_file('sha256', $target) !== $fileHash)) {
                    throw new RuntimeException("Audio file is missing or changed for variant {$variant->id}.");
                }
                if (!empty($config['audio_url']) && $config['audio_url'] !== $targetUrl) {
                    throw new RuntimeException("Variant {$variant->id} has an editor-selected audio URL; preserving it.");
                }
                if (!empty($config['audio_generation']['sha256']) && $config['audio_generation']['sha256'] !== $hash) {
                    throw new RuntimeException("Variant {$variant->id} has different audio metadata; preserving it.");
                }
                $pending[] = compact('variant', 'config', 'audio', 'source', 'target', 'targetUrl');
            }

            $this->info('Verified: five dialogues, voice hashes, transcripts and MP3 checksums.');
            if (!$this->option('write')) return self::SUCCESS;
            foreach ($pending as $item) {
                if (!is_file($item['target'])) {
                    File::ensureDirectoryExists(dirname($item['target']));
                    if (!File::copy($item['source'], $item['target'])) throw new RuntimeException('Could not copy verified audio.');
                }
            }
            DB::transaction(function () use ($pending) {
                foreach ($pending as $item) {
                    $item['variant']->update(['config' => [
                        ...$item['config'], 'audio_url' => $item['targetUrl'], 'audio_generation' => $item['audio'],
                    ]]);
                }
            });
            $this->info('Attached five recordings to the current database IDs.');
            return self::SUCCESS;
        } catch (\JsonException|RuntimeException $exception) {
            $this->error($exception->getMessage());
            return self::FAILURE;
        }
    }
}
