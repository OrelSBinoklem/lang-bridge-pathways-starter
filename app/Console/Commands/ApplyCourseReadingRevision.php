<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Database\Connection;
use Illuminate\Database\QueryException;
use Illuminate\Support\ConfigurationUrlParser;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use App\Support\LessonBinaryTask;
use RuntimeException;
use stdClass;

class ApplyCourseReadingRevision extends Command
{
    protected $signature = 'course:apply-reading-revision {manifest} {--apply : Apply locally after complete validation and a private backup}';

    protected $description = 'Dry-run or atomically apply a complete local reading revision without changing identities or learner data';

    public static function canonicalJson(mixed $value): string
    {
        return PublishCourseListeningRevision::canonicalJson($value);
    }

    public static function fingerprint(mixed $value): string
    {
        return hash('sha256', self::canonicalJson($value));
    }

    public function handle(): int
    {
        try {
            $connection = DB::connection();
            if ($this->option('apply')) {
                $this->guardApply($connection);
            }
            $entries = $this->readManifest();
            $plan = $this->preflight($connection, $entries);
            $backup = null;
            if ($this->option('apply')) {
                $plan = $connection->transaction(function () use ($connection, $entries, &$backup): array {
                    $this->guardApply($connection);
                    $plan = $this->preflight($connection, $entries, true);
                    if ($plan['changed']) {
                        $backup = $this->archive($plan['changed']);
                        foreach ($plan['changed'] as $item) {
                            $entry = $entries[$item['variant_id']];
                            $updated = $connection->table('lesson_block_variants')->where('id', $entry->variant_id)->update([
                                'config' => self::canonicalJson($entry->config),
                                'title' => $entry->title,
                                'updated_at' => now(),
                            ]);
                            if ($updated !== 1) {
                                throw new RuntimeException('Variant update failed.');
                            }
                        }
                        // Read back within the transaction, including any database trigger effects.
                        foreach ($plan['changed'] as $item) {
                            $entry = $entries[$item['variant_id']];
                            $row = $connection->table('lesson_block_variants')->where('id', $entry->variant_id)->first(['title', 'config']);
                            if (! $row || $row->title !== $entry->title
                                || ! hash_equals($entry->after_sha256, self::fingerprint(json_decode($row->config, false, 512, JSON_THROW_ON_ERROR)))) {
                                throw new RuntimeException('After-state verification failed.');
                            }
                        }
                    }

                    return $plan;
                });
            }
            $this->info('changed='.count($plan['changed']).' kept='.$plan['kept'].' already_applied='.$plan['already_applied']
                .' dry_run='.($this->option('apply') ? 'no' : 'yes').($backup ? ' backup='.$backup : ''));

            return self::SUCCESS;
        } catch (QueryException $exception) {
            // SQL errors may include the entire config in their bindings.
            $this->error('Database operation failed (SQLSTATE '.($exception->errorInfo[0] ?? 'unknown').'). Transaction rolled back.');
        } catch (\JsonException $exception) {
            $this->error('Invalid JSON. No transaction changes committed.');
        } catch (RuntimeException $exception) {
            $this->error($exception->getMessage());
        } catch (\Throwable $exception) {
            $this->error('Reading revision failed ('.$exception::class.'). No transaction changes committed.');
        }

        return self::FAILURE;
    }

    protected function guardApply(Connection $connection): void
    {
        $environment = app()->environment();
        $configuredEnvironment = config('app.env');
        if ($environment === 'production' || $configuredEnvironment === 'production') {
            throw new RuntimeException('Production apply is forbidden.');
        }
        $configuration = $connection->getConfig();
        $configured = (new ConfigurationUrlParser)->parseConfiguration(
            config('database.connections.'.$connection->getName(), $configuration)
        );
        if ($environment === 'testing' && $configuredEnvironment === 'testing'
            && ($configuration['driver'] ?? null) === 'sqlite' && ($configuration['database'] ?? null) === ':memory:'
            && ($configured['driver'] ?? null) === 'sqlite' && ($configured['database'] ?? null) === ':memory:'
            && ! isset($configured['read']) && ! isset($configured['write'])
            && ! $connection->getDirectPdoConfig()) {
            return;
        }
        if ($environment !== 'local' || $configuredEnvironment !== 'local'
            || ! in_array($configuration['driver'] ?? null, ['mysql', 'mariadb'], true)) {
            throw new RuntimeException('Apply requires APP_ENV=local and a loopback MariaDB connection (testing permits only SQLite :memory:).');
        }
        // ConnectionFactory removes read/write options from getConfig(); inspect every configured endpoint too.
        $endpoints = [$configuration, $configured];
        foreach (['read', 'write'] as $type) {
            if (! isset($configured[$type])) {
                continue;
            }
            $choices = $configured[$type];
            if (! is_array($choices)) {
                throw new RuntimeException('Invalid database endpoint configuration.');
            }
            foreach (array_is_list($choices) && $choices ? $choices : [$choices] as $choice) {
                if (! is_array($choice) || ! empty($choice['url'])) {
                    throw new RuntimeException('Unsafe database endpoint override.');
                }
                $endpoints[] = array_merge($configured, $choice);
            }
        }
        if ($connection->getDirectPdoConfig()) {
            $endpoints[] = $connection->getDirectPdoConfig();
        }
        foreach ($endpoints as $settings) {
            if (! empty($settings['unix_socket']) || ! in_array($settings['driver'] ?? null, ['mysql', 'mariadb'], true)
                || ($settings['database'] ?? null) !== ($configuration['database'] ?? null)) {
                throw new RuntimeException('Unsafe local database connection.');
            }
            $hosts = (array) ($settings['host'] ?? $configuration['host'] ?? '');
            if (! $hosts) {
                throw new RuntimeException('Missing local database host.');
            }
            foreach ($hosts as $host) {
                if (! is_string($host) || ! $this->isLoopback($host)) {
                    throw new RuntimeException('Apply requires a loopback database host for every read/write connection.');
                }
            }
        }
    }

    private function isLoopback(string $host): bool
    {
        $literal = trim($host, '[]');
        if (filter_var($literal, FILTER_VALIDATE_IP) !== false) {
            return $literal === '::1' || (filter_var($literal, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) !== false && str_starts_with($literal, '127.'));
        }
        if (! preg_match('/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/iD', $host)) {
            return false;
        }
        $addresses = $this->resolveHost($host);
        if (! $addresses) {
            return false;
        }
        foreach ($addresses as $address) {
            if (filter_var($address, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4) === false || ! str_starts_with($address, '127.')) {
                return false;
            }
        }

        return true;
    }

    protected function resolveHost(string $host): array
    {
        // Use the system resolver so OSPanel/hosts-file aliases are respected.
        return gethostbynamel($host) ?: [];
    }

    private function readManifest(): array
    {
        $path = realpath((string) $this->argument('manifest'));
        $workspace = realpath(base_path());
        $allowed = false;
        foreach (['resources/course/reading-revisions', '.tmp'] as $relative) {
            $root = realpath(base_path($relative));
            if ($workspace && $root && $this->inside($root, $workspace) && $path && $this->inside($path, $root)) {
                $allowed = true;
            }
        }
        if (! $allowed || ! is_file($path) || strtolower(pathinfo($path, PATHINFO_EXTENSION)) !== 'json') {
            throw new RuntimeException('Manifest must be a JSON file inside workspace resources/course/reading-revisions/ or .tmp/.');
        }
        $bytes = file_get_contents($path);
        if ($bytes === false) {
            throw new RuntimeException('Cannot read manifest.');
        }
        $pack = json_decode($bytes, false, 512, JSON_THROW_ON_ERROR);
        if (! $pack instanceof stdClass || ! $this->hasKeys($pack, ['schema_version', 'scope', 'entries'])
            || $pack->schema_version !== 1 || $pack->scope !== 'course_reading_revision'
            || ! is_array($pack->entries) || ! $pack->entries) {
            throw new RuntimeException('Expected course_reading_revision schema 1 with a complete entries array.');
        }
        $entries = [];
        foreach ($pack->entries as $entry) {
            if (! $entry instanceof stdClass || ! $this->hasKeys($entry, [
                'variant_id', 'block_id', 'page_id', 'category_id', 'level', 'expected_config_sha256',
                'expected_title', 'after_sha256', 'title', 'config', 'action',
            ])) {
                throw new RuntimeException('Invalid manifest entry fields.');
            }
            foreach (['variant_id', 'block_id', 'page_id', 'category_id'] as $field) {
                if (! is_int($entry->$field) || $entry->$field < 1 || $entry->$field > 9007199254740991) {
                    throw new RuntimeException('Selector IDs must be positive JSON integers.');
                }
            }
            foreach (['expected_config_sha256', 'after_sha256'] as $field) {
                if (! is_string($entry->$field) || ! preg_match('/^[a-f0-9]{64}$/D', $entry->$field)) {
                    throw new RuntimeException('Invalid config SHA-256.');
                }
            }
            foreach (['title', 'expected_title'] as $field) {
                if ($entry->$field !== null && (! is_string($entry->$field) || mb_strlen($entry->$field) > 255)) {
                    throw new RuntimeException('Titles must be nullable strings of at most 255 characters.');
                }
            }
            if (! in_array($entry->level, ['A1', 'A2', 'B1', 'B2'], true)
                || ! in_array($entry->action, ['keep', 'questions_only', 'copyedit', 'rewrite'], true)
                || ! $entry->config instanceof stdClass || isset($entries[$entry->variant_id])) {
                throw new RuntimeException('Invalid level, action, config or duplicate variant ID.');
            }
            if (! hash_equals($entry->after_sha256, self::fingerprint($entry->config))) {
                throw new RuntimeException('After config fingerprint mismatch.');
            }
            if ($entry->action === 'keep' && ($entry->expected_config_sha256 !== $entry->after_sha256 || $entry->expected_title !== $entry->title)) {
                throw new RuntimeException('Keep must preserve the baseline config and title.');
            }
            $this->validateConfig($entry->config);
            $entries[$entry->variant_id] = $entry;
        }
        ksort($entries, SORT_NUMERIC);

        return $entries;
    }

    private function preflight(Connection $connection, array $entries, bool $lock = false): array
    {
        $query = $connection->table('lesson_block_variants as v')
            ->join('lesson_blocks as b', 'b.id', '=', 'v.lesson_block_id')
            ->join('lesson_pages as p', 'p.id', '=', 'b.lesson_page_id')
            ->join('course_groups as g', 'g.id', '=', 'p.course_group_id')
            ->where('g.dictionary_id', 20)->where('g.learn_lang', 'lv')->where('g.is_published', true)
            ->whereIn('g.level', ['A1', 'A2', 'B1', 'B2'])
            ->where('p.skill', 'reading')->where('p.learn_lang', 'lv')->where('p.is_published', true)
            ->where('p.status', 'published')->whereIn('p.level', ['A1', 'A2', 'B1', 'B2'])
            ->where('b.type', 'reading')->whereNull('b.source_block_id')->where('v.is_published', true)
            ->orderBy('v.id')
            ->select(['v.id', 'v.title', 'v.config', 'b.id as block_id', 'p.id as page_id',
                'g.category_id', 'g.level as group_level', 'p.level']);
        if ($lock) {
            $query->lockForUpdate();
        }
        $rows = $query->get();
        $ids = $rows->map(static fn ($row) => (int) $row->id)->all();
        if ($ids !== array_keys($entries)) {
            throw new RuntimeException('Manifest must match the exact complete published reading variant set; missing or unknown IDs.');
        }
        $plan = ['changed' => [], 'kept' => 0, 'already_applied' => 0];
        foreach ($rows as $row) {
            $entry = $entries[(int) $row->id];
            if ((int) $row->block_id !== $entry->block_id || (int) $row->page_id !== $entry->page_id
                || (int) $row->category_id !== $entry->category_id || $row->level !== $entry->level || $row->group_level !== $entry->level) {
                throw new RuntimeException('Reading ownership or level mismatch for variant '.$entry->variant_id.'.');
            }
            $current = json_decode($row->config, false, 512, JSON_THROW_ON_ERROR);
            if (! $current instanceof stdClass) {
                throw new RuntimeException('Invalid stored reading config for variant '.$entry->variant_id.'.');
            }
            $hash = self::fingerprint($current);
            $before = hash_equals($entry->expected_config_sha256, $hash) && $row->title === $entry->expected_title;
            $after = hash_equals($entry->after_sha256, $hash) && $row->title === $entry->title;
            if (! $before && ! $after) {
                throw new RuntimeException('Baseline/title conflict for variant '.$entry->variant_id.'.');
            }
            $this->validateAllowedChanges($current, $entry);
            if ($entry->action === 'keep') {
                $plan['kept']++;
            } elseif ($after) {
                $plan['already_applied']++;
            } else {
                $plan['changed'][] = ['variant_id' => $entry->variant_id, 'title' => $row->title, 'config' => $current, 'config_sha256' => $hash];
            }
        }

        return $plan;
    }

    private function validateAllowedChanges(stdClass $current, stdClass $entry): void
    {
        $kind = $current->task_kind ?? null;
        if (! in_array($kind, ['reading_binary', 'lv_to_ru'], true) || $kind !== $entry->config->task_kind) {
            throw new RuntimeException('Reading task_kind is immutable.');
        }
        $protectedBefore = (array) $current;
        $protectedAfter = (array) $entry->config;
        foreach ($kind === 'reading_binary' ? ['text', 'questions', 'assisted_questions'] : ['source_text', 'reference_translation'] as $field) {
            unset($protectedBefore[$field], $protectedAfter[$field]);
        }
        if (self::fingerprint((object) $protectedBefore) !== self::fingerprint((object) $protectedAfter)) {
            throw new RuntimeException('Unrelated reading config fields cannot be added, removed or changed.');
        }
        if ($entry->action === 'questions_only' && ($kind !== 'reading_binary' || ($current->text ?? null) !== $entry->config->text)) {
            throw new RuntimeException('Questions-only requires unchanged reading_binary text.');
        }
    }

    private function validateConfig(stdClass $config): void
    {
        if (($config->task_kind ?? null) === 'lv_to_ru') {
            if (! $this->latvianText($config->source_text ?? null) || ! $this->nonemptyText($config->reference_translation ?? null)
                || ! preg_match('/\p{Cyrillic}/u', $config->reference_translation)) {
                throw new RuntimeException('Translation requires nonempty Latvian source and Russian reference.');
            }

            return;
        }
        if (($config->task_kind ?? null) !== 'reading_binary' || ! $this->latvianText($config->text ?? null)
            || ! is_array($config->questions ?? null) || ! array_is_list($config->questions)
            || count($config->questions) < LessonBinaryTask::MIN_QUESTIONS || count($config->questions) > LessonBinaryTask::MAX_QUESTIONS) {
            throw new RuntimeException('Reading binary requires nonempty Latvian text and three to ten questions.');
        }
        $statements = [];
        foreach ($config->questions as $question) {
            if (! $question instanceof stdClass || ! $this->hasKeys($question, ['statement', 'correct', 'explanation'])
                || ! $this->nonemptyText($question->statement) || ! is_bool($question->correct) || ! $this->nonemptyText($question->explanation)) {
                throw new RuntimeException('Questions require only a statement, boolean correct and nonempty explanation.');
            }
            $statements[] = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $question->statement)), 'UTF-8');
        }
        if (count(array_unique($statements)) !== count($config->questions)) {
            throw new RuntimeException('Reading statements must be distinct.');
        }
        if (property_exists($config, 'assisted_questions')) {
            if (! is_array($config->assisted_questions) || ! array_is_list($config->assisted_questions)
                || count($config->assisted_questions) !== count($config->questions)
                || array_filter($config->assisted_questions, fn ($text) => ! $this->nonemptyText($text))) {
                throw new RuntimeException('Assisted statements must match the normal question count and contain nonempty strings.');
            }
        }
    }

    private function nonemptyText(mixed $text): bool
    {
        return is_string($text) && preg_match('/\S/u', $text) === 1;
    }

    private function latvianText(mixed $text): bool
    {
        return $this->nonemptyText($text) && preg_match('/\p{Latin}/u', $text) === 1 && ! preg_match('/\p{Cyrillic}/u', $text);
    }

    private function hasKeys(stdClass $object, array $expected): bool
    {
        $actual = array_keys((array) $object);
        sort($actual);
        sort($expected);

        return $actual === $expected;
    }

    private function inside(string $path, string $root): bool
    {
        $normalize = static fn ($value) => rtrim(str_replace('\\', '/', $value), '/');
        $path = $normalize($path);
        $root = $normalize($root);
        if (PHP_OS_FAMILY === 'Windows') {
            $path = strtolower($path);
            $root = strtolower($root);
        }

        return str_starts_with($path, $root.'/');
    }

    /** Refuse symlinks in every ancestor, including the storage root itself. */
    private function privateDirectory(string $path): string
    {
        if (is_link($path)) {
            throw new RuntimeException('Symlink in private backup path.');
        }
        $parent = dirname($path);
        if ($parent !== $path) {
            $this->privateDirectory($parent);
        }
        if (! is_dir($path) && ! @mkdir($path, 0700)) {
            throw new RuntimeException('Cannot create private backup directory.');
        }
        $resolved = realpath($path);
        if ($resolved === false) {
            throw new RuntimeException('Cannot resolve private backup directory.');
        }
        foreach ([public_path(), base_path('frontend/public'), storage_path('app/public')] as $public) {
            $root = realpath($public);
            if ($root && ($resolved === $root || $this->inside($resolved, $root))) {
                throw new RuntimeException('Backup path cannot be inside public storage.');
            }
        }

        return $resolved;
    }

    protected function archive(array $rows): string
    {
        $mask = umask(0077);
        try {
            $relative = 'app/private/course/reading-revision-backups/'.gmdate('Ymd-His').'-'.Str::uuid().'/before.json';
            $directory = $this->privateDirectory(dirname(storage_path($relative)));
            $file = $directory.DIRECTORY_SEPARATOR.'before.json';
            $bytes = self::canonicalJson((object) ['schema_version' => 1, 'scope' => 'course_reading_revision_backup', 'entries' => $rows]);
            $handle = @fopen($file, 'x+b');
            if ($handle === false) {
                throw new RuntimeException('Cannot exclusively create private backup.');
            }
            try {
                if (! chmod($file, 0600)) {
                    throw new RuntimeException('Cannot restrict private backup permissions.');
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
                $stored = stream_get_contents($handle);
                if ($stored === false || ! hash_equals(hash('sha256', $bytes), hash('sha256', $stored))) {
                    throw new RuntimeException('Private backup verification failed.');
                }
            } finally {
                fclose($handle);
            }

            return $relative;
        } finally {
            umask($mask);
        }
    }
}
