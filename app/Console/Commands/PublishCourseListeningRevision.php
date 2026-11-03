<?php

namespace App\Console\Commands;

use App\Models\CourseGroup;
use Illuminate\Console\Command;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;
use RuntimeException;
use stdClass;

class PublishCourseListeningRevision extends Command
{
    protected $signature = 'course:publish-listening-revision {manifest} {--apply : Apply the complete verified release after a private backup}';

    protected $description = 'Replace listening titles, content and audio atomically, preserving IDs and learner data';

    /** SHA-256 of JS JSON.stringify(canonical(value)); keep decoded JSON objects as objects. */
    public static function fingerprint(mixed $value): string
    {
        return hash('sha256', self::canonicalJson($value));
    }

    public static function canonicalJson(mixed $value): string
    {
        if (is_array($value) && array_is_list($value)) {
            return '['.implode(',', array_map(self::canonicalJson(...), $value)).']';
        }
        if (is_object($value) || is_array($value)) {
            $properties = (array) $value;
            $keys = array_map('strval', array_keys($properties));
            // JS enumerates integer-index properties first, even after lexical sorting.
            $isIndex = static fn (string $key): bool => preg_match('/^(0|[1-9][0-9]*)$/D', $key)
                && strlen($key) <= 10 && (int) $key < 4294967295;
            usort($keys, static function (string $a, string $b) use ($isIndex): int {
                $ai = $isIndex($a);
                $bi = $isIndex($b);
                if ($ai || $bi) {
                    return $ai && $bi ? (int) $a <=> (int) $b : ($ai ? -1 : 1);
                }

                return strcmp(mb_convert_encoding($a, 'UTF-16BE', 'UTF-8'), mb_convert_encoding($b, 'UTF-16BE', 'UTF-8'));
            });

            return '{'.implode(',', array_map(static fn ($key) => self::canonicalJson($key).':'.self::canonicalJson($properties[$key]), $keys)).'}';
        }
        if (is_int($value) && abs($value) > 9007199254740991) {
            throw new RuntimeException('JSON integer exceeds the interoperable safe range.');
        }
        $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_LINE_TERMINATORS | JSON_THROW_ON_ERROR);
        if (! is_float($value)) {
            return $encoded;
        }
        if ($value == 0.0) {
            return '0';
        }
        // PHP and JS use different thresholds for exponential notation.
        if (! str_contains($encoded, 'e')) {
            return $encoded;
        }
        [$mantissa, $exponent] = explode('e', $encoded);
        $exponent = (int) $exponent;
        $mantissa = str_ends_with($mantissa, '.0') ? substr($mantissa, 0, -2) : $mantissa;
        if (abs($value) >= 1e-6 && abs($value) < 1e21) {
            $negative = str_starts_with($mantissa, '-');
            $digits = str_replace(['-', '.'], '', $mantissa);
            $point = $exponent + 1;
            $decimal = $point <= 0 ? '0.'.str_repeat('0', -$point).$digits
                : ($point >= strlen($digits) ? $digits.str_repeat('0', $point - strlen($digits))
                    : substr($digits, 0, $point).'.'.substr($digits, $point));

            return ($negative ? '-' : '').$decimal;
        }

        return $mantissa.'e'.($exponent >= 0 ? '+' : '').$exponent;
    }

    public function handle(): int
    {
        try {
            $path = realpath((string) $this->argument('manifest'));
            if (! $path || ! is_file($path)) {
                throw new RuntimeException('Release manifest not found.');
            }
            $pack = json_decode(file_get_contents($path), false, 512, JSON_THROW_ON_ERROR);
            $entries = $this->validateManifest($pack);
            $changed = DB::transaction(function () use ($pack, $entries): int {
                $rows = [];
                $pending = [];
                $verifiedAudio = [];
                // Lock ownership and all variants in category order before any write.
                foreach ($entries as $category => $variants) {
                    $group = CourseGroup::query()->where('category_id', $category)->lockForUpdate()->sole();
                    $page = $group->lessonPages()->where('skill', 'listening')->lockForUpdate()->sole();
                    if ($page->slug !== "course-{$category}-listening" || $page->learn_lang !== 'lv'
                        || $page->level !== $variants['variant:1']->level
                        || $group->learn_lang !== 'lv' || $group->level !== $page->level) {
                        throw new RuntimeException("Lesson ownership, language or level changed: {$category}.");
                    }
                    $block = $page->blocks()->lockForUpdate()->sole();
                    if ($block->type !== 'listening' || $block->source_block_id !== null) {
                        throw new RuntimeException("Listening block structure changed: {$category}.");
                    }
                    $stored = $block->variants()->lockForUpdate()->get();
                    if ($stored->count() !== 5 || $stored->pluck('seed_key')->unique()->count() !== 5) {
                        throw new RuntimeException("Variant scope changed: {$category}.");
                    }
                    foreach ($variants as $seed => $entry) {
                        $variant = $stored->firstWhere('seed_key', $seed);
                        if (! $variant) {
                            throw new RuntimeException("Missing variant: {$category}:{$seed}.");
                        }
                        $before = (object) [
                            'title' => $variant->getRawOriginal('title'),
                            'config' => json_decode($variant->getRawOriginal('config'), false, 512, JSON_THROW_ON_ERROR),
                        ];
                        if (! $before->config instanceof stdClass) {
                            throw new RuntimeException("Invalid stored config: {$category}:{$seed}.");
                        }
                        $beforeHash = self::fingerprint($before);
                        $applied = hash_equals($entry->after_sha256, $beforeHash);
                        if (! $applied && ! hash_equals($entry->expected_before_sha256, $beforeHash)) {
                            throw new RuntimeException("Title or full config changed: {$category}:{$seed}.");
                        }
                        $immutableBefore = (array) $before->config;
                        $immutableAfter = (array) $entry->after->config;
                        foreach (['dialogue_segments', 'speaker_profiles', 'transcript', 'questions', 'audio_url', 'audio_generation'] as $field) {
                            unset($immutableBefore[$field], $immutableAfter[$field]);
                        }
                        if (self::fingerprint((object) $immutableBefore) !== self::fingerprint((object) $immutableAfter)) {
                            throw new RuntimeException("Authoring or other protected config changed: {$category}:{$seed}.");
                        }
                        $audioKey = $entry->after->config->audio_url;
                        if (! isset($verifiedAudio[$audioKey])) {
                            $this->verifyAudio($entry);
                            $verifiedAudio[$audioKey] = true;
                        }
                        $rows[] = [
                            'category_id' => $category, 'seed_key' => $seed,
                            'lesson_page_id' => $page->id, 'lesson_block_id' => $block->id, 'variant_id' => $variant->id,
                            'before' => $before, 'before_sha256' => $beforeHash,
                            'after' => $entry->after, 'after_sha256' => $entry->after_sha256,
                            'already_applied' => $applied,
                        ];
                        if (! $applied) {
                            $pending[] = ['id' => $variant->id, 'after' => $entry->after];
                        }
                    }
                }
                $this->info('Verified 190 variants; replacements: '.count($pending).'.');
                if (! $this->option('apply') || ! $pending) {
                    return count($pending);
                }
                $backup = $this->archive($pack, $rows);
                $this->info('Private backup: '.$backup);
                foreach ($pending as $item) {
                    DB::table('lesson_block_variants')->where('id', $item['id'])->update([
                        'title' => $item['after']->title,
                        'config' => self::canonicalJson($item['after']->config),
                        'updated_at' => now(),
                    ]);
                }

                return count($pending);
            });
            $this->info(! $this->option('apply') ? 'Dry run only. No database or backup writes.'
                : ($changed ? 'Listening revision applied. IDs and learner data preserved.' : 'Release already applied; nothing changed.'));

            return self::SUCCESS;
        } catch (QueryException $exception) {
            // QueryException messages can contain complete private config bindings.
            $this->error('Database operation failed (SQLSTATE '.($exception->errorInfo[0] ?? 'unknown').'). Transaction rolled back.');
        } catch (RuntimeException|\JsonException $exception) {
            $this->error($exception->getMessage());
        } catch (\Throwable $exception) {
            $this->error('Release failed ('.$exception::class.'). No transaction changes committed.');
        }

        return self::FAILURE;
    }

    private function validateManifest(mixed $pack): array
    {
        if (! $pack instanceof stdClass || ($pack->schema_version ?? null) !== 1
            || ($pack->scope ?? null) !== 'course_listening_revision'
            || ! is_string($pack->release ?? null) || ! preg_match('/^[a-z0-9][a-z0-9-]{0,79}$/D', $pack->release)
            || ! is_array($pack->items ?? null) || count($pack->items) !== 190) {
            throw new RuntimeException('Expected a complete 190-variant course_listening_revision manifest (schema 1).');
        }
        $entries = [];
        foreach ($pack->items as $entry) {
            if (! $entry instanceof stdClass || ! is_int($entry->category_id ?? null)
                || $entry->category_id < 1763 || $entry->category_id > 1800
                || ! is_string($entry->seed_key ?? null) || ! preg_match('/^variant:[1-5]$/D', $entry->seed_key)) {
                throw new RuntimeException('Invalid category or seed scope.');
            }
            $category = $entry->category_id;
            $level = $category <= 1774 ? 'A1' : ($category <= 1785 ? 'A2' : ($category <= 1795 ? 'B1' : 'B2'));
            if (($entry->level ?? null) !== $level || isset($entries[$category][$entry->seed_key])) {
                throw new RuntimeException('Invalid level or duplicate category/seed scope.');
            }
            foreach (['expected_before_sha256', 'after_sha256', 'file_sha256'] as $field) {
                if (! is_string($entry->$field ?? null) || ! preg_match('/^[a-f0-9]{64}$/D', $entry->$field)) {
                    throw new RuntimeException("Missing or invalid {$field}.");
                }
            }
            $after = $entry->after ?? null;
            if (! $after instanceof stdClass || count(get_object_vars($after)) !== 2
                || ! is_string($after->title ?? null) || trim($after->title) === '' || mb_strlen($after->title) > 255
                || ! ($after->config ?? null) instanceof stdClass
                || ! hash_equals($entry->after_sha256, self::fingerprint($after))) {
                throw new RuntimeException('Invalid full after state or after fingerprint.');
            }
            $this->validateConfig($after->config);
            $url = $after->config->audio_url ?? null;
            if (! is_string($url) || ! preg_match('#^/audio/course/listening/[a-z0-9][a-z0-9-]{0,79}/'.preg_quote($entry->file_sha256, '#').'\.mp3$#D', $url)
                || ($entry->audio_mime ?? null) !== 'audio/mpeg') {
                throw new RuntimeException('Unsafe audio path or invalid declared MIME.');
            }
            $generation = $after->config->audio_generation ?? null;
            if (! $generation instanceof stdClass || ($generation->file_sha256 ?? null) !== $entry->file_sha256
                || ! is_string($generation->provider ?? null) || trim($generation->provider) === ''
                || ! is_string($generation->model ?? null) || trim($generation->model) === '') {
                throw new RuntimeException('Invalid audio generation metadata or file hash.');
            }
            $entries[$category][$entry->seed_key] = $entry;
        }
        ksort($entries);
        foreach ($entries as &$variants) {
            ksort($variants);
        }

        return $entries;
    }

    private function validateConfig(stdClass $config): void
    {
        if (($config->task_kind ?? null) !== 'listening' || ! is_array($config->dialogue_segments ?? null)
            || count($config->dialogue_segments) < 2 || ! ($config->speaker_profiles ?? null) instanceof stdClass
            || ! is_array($config->questions ?? null) || count($config->questions) !== 10) {
            throw new RuntimeException('Incomplete listening config.');
        }
        $transcript = [];
        $speakers = [];
        foreach ($config->dialogue_segments as $segment) {
            if (! $segment instanceof stdClass || ! in_array($segment->speaker ?? null, ['a', 'b'], true)
                || ! is_string($segment->text ?? null) || trim($segment->text) === '') {
                throw new RuntimeException('Invalid dialogue segment.');
            }
            $speakers[$segment->speaker] = true;
            $transcript[] = strtoupper($segment->speaker).': '.$segment->text;
        }
        if (count($speakers) !== 2 || ($config->transcript ?? null) !== implode("\n", $transcript)) {
            throw new RuntimeException('Transcript does not match both dialogue speakers.');
        }
        foreach (['a', 'b'] as $speaker) {
            $profile = $config->speaker_profiles->$speaker ?? null;
            if (! $profile instanceof stdClass || ! is_string($profile->name ?? null) || trim($profile->name) === ''
                || ! in_array($profile->gender ?? null, ['male', 'female'], true)) {
                throw new RuntimeException('Invalid speaker profile.');
            }
        }
        $statements = [];
        $true = 0;
        foreach ($config->questions as $question) {
            if (! $question instanceof stdClass || ! is_bool($question->correct ?? null)
                || ! is_string($question->statement ?? null) || trim($question->statement) === ''
                || ! is_string($question->explanation ?? null) || trim($question->explanation) === '') {
                throw new RuntimeException('Invalid listening statement, answer or explanation.');
            }
            $keys = array_keys(get_object_vars($question));
            sort($keys);
            if ($keys !== ['correct', 'explanation', 'statement']) {
                throw new RuntimeException('Runtime questions must contain only statement, correct and explanation; editorial fields would leak answers.');
            }
            $statements[] = trim($question->statement);
            $true += (int) $question->correct;
        }
        if (count(array_unique($statements)) !== 10 || $true !== 5) {
            throw new RuntimeException('Expected ten distinct statements with five true answers.');
        }
    }

    private function verifyAudio(stdClass $entry): void
    {
        $public = realpath(base_path('frontend/public'));
        $file = $public ? $public.str_replace('/', DIRECTORY_SEPARATOR, $entry->after->config->audio_url) : '';
        $root = $public ? $public.DIRECTORY_SEPARATOR.'audio'.DIRECTORY_SEPARATOR.'course'.DIRECTORY_SEPARATOR.'listening' : '';
        clearstatcache();
        $resolved = $file ? realpath($file) : false;
        if (! $resolved || realpath($root) !== $root || $resolved !== $file || ! is_file($resolved)
            || ! str_starts_with($resolved, $root.DIRECTORY_SEPARATOR) || filesize($resolved) < 1000
            || ! hash_equals($entry->file_sha256, hash_file('sha256', $resolved))) {
            throw new RuntimeException("Missing, unsafe or corrupt audio: {$entry->category_id}:{$entry->seed_key}.");
        }
        if ((new \finfo(FILEINFO_MIME_TYPE))->file($resolved) !== $entry->audio_mime) {
            throw new RuntimeException("Audio MIME mismatch: {$entry->category_id}:{$entry->seed_key}.");
        }
    }

    /** Archive the entire scope, including already-applied entries, before the first UPDATE. */
    protected function archive(stdClass $pack, array $rows): string
    {
        $oldMask = umask(0077);
        try {
            $directory = storage_path();
            if (! is_dir($directory) && ! mkdir($directory, 0700, true)) {
                throw new RuntimeException('Cannot create private backup storage.');
            }
            $directory = realpath($directory);
            foreach (['app', 'private', 'course', 'listening-revision-backups'] as $part) {
                $directory .= DIRECTORY_SEPARATOR.$part;
                if (is_link($directory)) {
                    throw new RuntimeException('Symlink in private backup directory.');
                }
                if (! is_dir($directory) && ! mkdir($directory, 0700)) {
                    throw new RuntimeException('Cannot create private backup directory.');
                }
            }
            $backup = $directory.DIRECTORY_SEPARATOR.$pack->release.'-'.gmdate('Ymd-His').'-'.bin2hex(random_bytes(8)).'.json';
            $bytes = self::canonicalJson((object) [
                'schema_version' => 1, 'release' => $pack->release, 'manifest_sha256' => self::fingerprint($pack),
                'created_at' => gmdate('c'), 'items' => $rows,
            ]);
            $handle = fopen($backup, 'x+b');
            if (! $handle) {
                throw new RuntimeException('Cannot create private backup file.');
            }
            try {
                if (! chmod($backup, 0600)) {
                    throw new RuntimeException('Cannot restrict backup file permissions.');
                }
                $offset = 0;
                while ($offset < strlen($bytes)) {
                    $written = fwrite($handle, substr($bytes, $offset));
                    if ($written === false || $written === 0) {
                        throw new RuntimeException('Private backup write failed.');
                    }
                    $offset += $written;
                }
                if (! fflush($handle) || ! fsync($handle)) {
                    throw new RuntimeException('Private backup flush failed.');
                }
                rewind($handle);
                if (! hash_equals(hash('sha256', $bytes), hash('sha256', stream_get_contents($handle)))) {
                    throw new RuntimeException('Private backup verification failed.');
                }
            } finally {
                fclose($handle);
            }

            return $backup;
        } finally {
            umask($oldMask);
        }
    }
}
