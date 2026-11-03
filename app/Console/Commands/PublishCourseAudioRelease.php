<?php

namespace App\Console\Commands;

use App\Models\LessonPage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use RuntimeException;

class PublishCourseAudioRelease extends Command
{
    protected $signature = 'course:publish-audio-release {manifest} {--write : Replace audio only after verification and backup}';
    protected $description = 'Publish a verified course listening release without changing exercises or progress';

    public static function fingerprint(array $value): string
    {
        $sort = function (array $items) use (&$sort): array {
            if (!array_is_list($items)) ksort($items);
            foreach ($items as &$item) if (is_array($item)) $item = $sort($item);
            return $items;
        };
        return hash('sha256', json_encode($sort($value), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    }

    public static function content(array $config): array
    {
        unset($config['audio_url'], $config['audio_generation']);
        return $config;
    }

    public function handle(): int
    {
        try {
            $path = realpath((string) $this->argument('manifest'));
            if (!$path) throw new RuntimeException('Manifest not found.');
            $pack = json_decode(File::get($path), true, 512, JSON_THROW_ON_ERROR);
            if (($pack['schema_version'] ?? null) !== 1 || ($pack['scope'] ?? null) !== 'course_listening'
                || !preg_match('/^[a-z0-9-]{1,80}$/D', $pack['release'] ?? '') || empty($pack['items'])) {
                throw new RuntimeException('Invalid release manifest.');
            }
            $pending = [];
            $seen = [];
            // Lock and validate the entire release before changing any variant.
            DB::transaction(function () use ($pack, &$pending, &$seen) {
                foreach ($pack['items'] as $entry) {
                    $category = $entry['category_id'] ?? null;
                    $seed = $entry['seed_key'] ?? '';
                    if (!is_int($category) || $category < 1 || !preg_match('/^variant:[1-5]$/D', $seed)
                        || isset($seen[$category.':'.$seed])) throw new RuntimeException('Invalid or duplicate variant.');
                    $seen[$category.':'.$seed] = true;
                    $page = LessonPage::query()->where('slug', "course-{$category}-listening")->sole();
                    if ($page->skill !== 'listening' || $page->learn_lang !== 'lv'
                        || (int) $page->courseGroup?->category_id !== $category || $page->level !== $entry['level']) {
                        throw new RuntimeException("Wrong lesson for category {$category}.");
                    }
                    $block = $page->blocks()->where('type', 'listening')->sole();
                    $variant = $block->variants()->where('seed_key', $seed)->lockForUpdate()->sole();
                    $config = $variant->config ?? [];
                    if (self::fingerprint(self::content($config)) !== ($entry['content_sha256'] ?? null)) {
                        throw new RuntimeException("Content changed: category {$category}, {$seed}.");
                    }
                    $hash = $entry['file_sha256'] ?? '';
                    $url = $entry['audio_url'] ?? '';
                    if (!preg_match('/^[a-f0-9]{64}$/D', $hash)
                        || $url !== '/audio/course/listening/'.$pack['release'].'/'.$hash.'.mp3') {
                        throw new RuntimeException('Unsafe audio path.');
                    }
                    $file = base_path('frontend/public'.$url);
                    $root = realpath(base_path('frontend/public/audio/course/listening'));
                    $resolved = realpath($file);
                    if (!$root || !$resolved || !str_starts_with($resolved, $root.DIRECTORY_SEPARATOR)
                        || filesize($resolved) < 1000 || hash_file('sha256', $resolved) !== $hash) {
                        throw new RuntimeException("Missing or corrupt audio: category {$category}, {$seed}.");
                    }
                    $generation = $entry['audio_generation'] ?? [];
                    if (($generation['provider'] ?? null) !== 'google' || ($generation['model'] ?? null) !== 'gemini-3.8-flash-tts'
                        || ($generation['post_processing_speed'] ?? null) !== false || ($generation['file_sha256'] ?? null) !== $hash) {
                        throw new RuntimeException('Invalid generation metadata.');
                    }
                    $before = array_intersect_key($config, array_flip(['audio_url', 'audio_generation']));
                    $after = ['audio_url' => $url, 'audio_generation' => $generation];
                    if ($before == $after) continue;
                    if (self::fingerprint($before) !== ($entry['previous_audio_sha256'] ?? null)) {
                        throw new RuntimeException("Audio was edited: category {$category}, {$seed}.");
                    }
                    $pending[] = ['variant' => $variant, 'config' => $config, 'before' => $before, 'after' => $after];
                }
                $this->info('Verified '.count($seen).' variants; replacements: '.count($pending).'.');
                if (!$this->option('write') || !$pending) return;
                $directory = storage_path('app/private/course/audio-backups');
                File::ensureDirectoryExists($directory, 0700);
                $backup = $directory.'/'.$pack['release'].'-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(4)).'.json';
                $data = ['release' => $pack['release'], 'items' => array_map(fn ($item) => [
                    'variant_id' => $item['variant']->id, 'before' => $item['before'], 'after' => $item['after'],
                ], $pending)];
                $bytes = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
                $handle = fopen($backup, 'x');
                if (!$handle) throw new RuntimeException('Cannot create backup.');
                try {
                    if (fwrite($handle, $bytes) !== strlen($bytes) || !fflush($handle)) throw new RuntimeException('Backup write failed.');
                } finally { fclose($handle); }
                $this->info('Backup: '.$backup);
                foreach ($pending as $item) {
                    $item['variant']->update(['config' => [...$item['config'], ...$item['after']]]);
                }
            });
            $this->info($this->option('write') ? 'Audio release attached. Old files and learner progress preserved.' : 'Dry run only. No data changed.');
            return self::SUCCESS;
        } catch (\Throwable $exception) {
            $this->error($exception->getMessage());
            return self::FAILURE;
        }
    }
}
