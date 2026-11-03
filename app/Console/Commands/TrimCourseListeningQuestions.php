<?php

namespace App\Console\Commands;

use App\Models\LessonBlock;
use App\Models\LessonBlockVariant;
use App\Models\LessonPage;
use App\Services\CoursePracticeVariants;
use Illuminate\Console\Command;
use Illuminate\Database\Connection;
use Illuminate\Support\Collection;
use Illuminate\Support\ConfigurationUrlParser;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use RuntimeException;
use stdClass;

class TrimCourseListeningQuestions extends Command
{
    protected const SKILL = 'listening';

    protected const TASK_KIND = 'listening';

    protected const MANIFEST_ROOT = 'resources/course/listening-revisions';

    protected const BACKUP_ROOT = '.tmp/listening-question-backups';

    protected const ALLOW_EXPLANATION_EVIDENCE = true;

    protected $signature = 'course:trim-listening-questions {manifest} {--apply : Apply after validation and a checked backup} {--production : Explicitly allow the verified production installation}';

    protected $description = 'Trim only questions of the complete active ordinary course listening scope; dry-run by default';

    public function handle(): int
    {
        try {
            $connection = DB::connection();
            if ($this->option('apply') || $this->option('production')) {
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
                            if ($connection->table('lesson_block_variants')->where('id', $item['variant_id'])->update([
                                'config' => PublishCourseListeningRevision::canonicalJson($this->deriveAfter($entries[$item['variant_id']])->config),
                                'updated_at' => now(),
                            ]) !== 1) {
                                throw new RuntimeException('Variant update failed.');
                            }
                        }
                        // Verify every active row again, including trigger effects and ownership.
                        $verified = $this->preflight($connection, $entries, true);
                        if ($verified['changed']) {
                            throw new RuntimeException('After-state verification failed.');
                        }
                    }

                    return $plan;
                });
            }
            $this->info('changed='.count($plan['changed']).' kept='.$plan['kept'].' already_applied='.$plan['already_applied']
                .' dry_run='.($this->option('apply') ? 'no' : 'yes').($backup ? ' backup='.$backup : ''));

            return self::SUCCESS;
        } catch (\Illuminate\Database\QueryException) {
            $this->error('Database operation failed. No transaction changes committed.');
        } catch (\JsonException) {
            $this->error('Invalid JSON. No transaction changes committed.');
        } catch (RuntimeException $exception) {
            // Only our own validation errors may be printed; database/file errors can contain private data.
            if ($exception::class === RuntimeException::class) {
                $this->error($exception->getMessage());
            } else {
                $this->error(ucfirst(static::SKILL).' trim failed. No transaction changes committed.');
            }
        } catch (\Throwable) {
            $this->error(ucfirst(static::SKILL).' trim failed. No transaction changes committed.');
        }

        return self::FAILURE;
    }

    protected function guardApply(Connection $connection): void
    {
        $environment = app()->environment();
        $production = (bool) $this->option('production');
        if ($production && ($environment !== 'production' || config('app.env') !== 'production'
            || parse_url((string) config('app.url'), PHP_URL_HOST) !== 'langbridge-pathways.com'
            || ! $this->isProductionPath())) {
            throw new RuntimeException('Production flag requires the expected production environment, application URL and installation path.');
        }
        $configuration = $connection->getConfig();
        $configured = (new ConfigurationUrlParser)->parseConfiguration(
            config('database.connections.'.$connection->getName(), $configuration)
        );
        if (! $production && $environment === 'testing' && config('app.env') === 'testing'
            && ($configuration['driver'] ?? null) === 'sqlite' && ($configuration['database'] ?? null) === ':memory:'
            && ($configured['driver'] ?? null) === 'sqlite' && ($configured['database'] ?? null) === ':memory:'
            && ! isset($configured['read']) && ! isset($configured['write']) && ! $connection->getDirectPdoConfig()) {
            return;
        }
        if ((! $production && ($environment !== 'local' || config('app.env') !== 'local'))
            || ! in_array($configuration['driver'] ?? null, ['mysql', 'mariadb'], true)) {
            throw new RuntimeException('Apply requires local loopback MySQL/MariaDB or explicit verified production; tests permit only SQLite :memory:.');
        }
        // The connection factory strips read/write settings; check the original endpoints as well.
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
                    throw new RuntimeException('Apply requires loopback hosts for every database endpoint.');
                }
            }
        }
    }

    protected function isProductionPath(): bool
    {
        $expected = '/var/www/langbridge-pathways.com/current';

        return rtrim(str_replace('\\', '/', base_path()), '/') === $expected
            && realpath(base_path()) !== false && realpath(base_path()) === realpath($expected);
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
        return gethostbynamel($host) ?: [];
    }

    private function readManifest(): array
    {
        $path = realpath((string) $this->argument('manifest'));
        $workspace = realpath(base_path());
        $allowed = false;
        foreach (['.tmp', static::MANIFEST_ROOT] as $relative) {
            $root = realpath(base_path($relative));
            if ($workspace && $root && $this->inside($root, $workspace) && $path && $this->inside($path, $root)) {
                $allowed = true;
            }
        }
        if (! $allowed || ! is_file($path) || strtolower(pathinfo($path, PATHINFO_EXTENSION)) !== 'json') {
            throw new RuntimeException('Manifest must be a JSON file inside workspace .tmp/ or '.static::MANIFEST_ROOT.'/.');
        }
        $bytes = @file_get_contents($path);
        if ($bytes === false) {
            throw new RuntimeException('Cannot read manifest.');
        }
        $pack = json_decode($bytes, false, 512, JSON_THROW_ON_ERROR);
        if (! $pack instanceof stdClass || ! $this->hasKeys($pack, ['schema_version', 'entries'])
            || $pack->schema_version !== 1 || ! is_array($pack->entries) || ! $pack->entries) {
            throw new RuntimeException('Expected schema_version 1 and a complete entries array.');
        }
        $entries = [];
        foreach ($pack->entries as $entry) {
            if (! $entry instanceof stdClass || ! $this->hasKeys($entry, [
                'level', 'category_id', 'page_id', 'page_slug', 'block_id', 'variant_id', 'seed_key',
                'before_sha256', 'before', 'keep', 'after_sha256',
                ...(property_exists($entry, 'explanation_evidence') ? ['explanation_evidence'] : []),
            ])) {
                throw new RuntimeException('Invalid manifest entry fields; client after config is forbidden.');
            }
            foreach (['category_id', 'page_id', 'block_id', 'variant_id'] as $field) {
                if (! is_int($entry->$field) || $entry->$field < 1 || $entry->$field > 9007199254740991) {
                    throw new RuntimeException('Selector IDs must be positive safe JSON integers.');
                }
            }
            foreach (['before_sha256', 'after_sha256'] as $field) {
                if (! is_string($entry->$field) || ! preg_match('/^[a-f0-9]{64}$/D', $entry->$field)) {
                    throw new RuntimeException('Invalid SHA-256.');
                }
            }
            if (! in_array($entry->level, ['A1', 'A2', 'B1', 'B2'], true)
                || ! is_string($entry->page_slug) || $entry->page_slug !== 'course-'.$entry->category_id.'-'.static::SKILL
                || ! is_string($entry->seed_key) || trim($entry->seed_key) === ''
                || isset($entries[$entry->variant_id]) || ! $entry->before instanceof stdClass
                || ! $this->hasKeys($entry->before, ['title', 'config']) || ! $entry->before->config instanceof stdClass
                || ($entry->before->title !== null && ! is_string($entry->before->title))) {
                throw new RuntimeException('Invalid '.static::SKILL.' scope, duplicate ID or before state.');
            }
            if (! hash_equals($entry->before_sha256, PublishCourseListeningRevision::fingerprint($entry->before))) {
                throw new RuntimeException('Before fingerprint mismatch.');
            }
            $after = $this->deriveAfter($entry);
            if (! hash_equals($entry->after_sha256, PublishCourseListeningRevision::fingerprint($after))) {
                throw new RuntimeException('After fingerprint mismatch.');
            }
            $entries[$entry->variant_id] = $entry;
        }
        ksort($entries, SORT_NUMERIC);

        return $entries;
    }

    private function deriveAfter(stdClass $entry): stdClass
    {
        $config = $entry->before->config;
        if (($config->task_kind ?? null) !== static::TASK_KIND || ! is_array($config->questions ?? null)
            || ! array_is_list($config->questions) || ! is_array($entry->keep) || ! array_is_list($entry->keep)
            || count($entry->keep) < 5 || count($entry->keep) > 10) {
            throw new RuntimeException(ucfirst(static::SKILL).' requires a questions array and 5 to 10 retained indices.');
        }
        if (property_exists($config, 'assisted_questions') && (! is_array($config->assisted_questions)
            || ! array_is_list($config->assisted_questions) || count($config->assisted_questions) !== count($config->questions))) {
            throw new RuntimeException('Assisted questions must be parallel to the original questions.');
        }
        $after = clone $entry->before;
        $after->config = clone $config;
        $after->config->questions = [];
        if (property_exists($config, 'assisted_questions')) {
            $after->config->assisted_questions = [];
        }
        $previous = 0;
        $answers = [];
        foreach ($entry->keep as $index) {
            if (! is_int($index) || $index <= $previous || $index > count($config->questions)) {
                throw new RuntimeException('Keep indices must be strictly increasing, unique and in range (1-based).');
            }
            $question = $config->questions[$index - 1];
            if (! $question instanceof stdClass || ! is_bool($question->correct ?? null)) {
                throw new RuntimeException('Retained questions must have boolean answers.');
            }
            $answers[$question->correct ? 1 : 0] = true;
            $after->config->questions[] = clone $question;
            if (property_exists($config, 'assisted_questions')) {
                $after->config->assisted_questions[] = $config->assisted_questions[$index - 1];
            }
            $previous = $index;
        }
        if (count($answers) !== 2) {
            throw new RuntimeException('Retained questions must include both true and false answers.');
        }
        if (property_exists($entry, 'explanation_evidence')) {
            if (! is_array($entry->explanation_evidence) || ! array_is_list($entry->explanation_evidence)) {
                throw new RuntimeException('Explanation evidence must be an array.');
            }
            if (! static::ALLOW_EXPLANATION_EVIDENCE && $entry->explanation_evidence !== []) {
                throw new RuntimeException('Explanation evidence changes are not authorized for '.static::SKILL.'.');
            }
            $sources = $this->evidenceSources($config);
            $seen = [];
            foreach ($entry->explanation_evidence as $evidence) {
                if (! $evidence instanceof stdClass || ! $this->hasKeys($evidence, ['index', 'quotes'])
                    || ! is_int($evidence->index) || ! in_array($evidence->index, $entry->keep, true)
                    || isset($seen[$evidence->index]) || ! is_array($evidence->quotes) || ! array_is_list($evidence->quotes)
                    || count($evidence->quotes) < 1 || count($evidence->quotes) > 3) {
                    throw new RuntimeException('Evidence requires unique retained indices and 1 to 3 quotes.');
                }
                foreach ($evidence->quotes as $quote) {
                    if (! is_string($quote) || preg_match('/\S/u', $quote) !== 1 || mb_strlen($quote) > 1000
                        || ! array_filter($sources, static fn (string $source): bool => str_contains($source, $quote))) {
                        throw new RuntimeException('Evidence quotes must be nonempty verbatim recording text of at most 1000 characters.');
                    }
                }
                $position = array_search($evidence->index, $entry->keep, true);
                $after->config->questions[$position]->explanation = $this->evidencePrefix().implode(' / ', $evidence->quotes);
                $seen[$evidence->index] = true;
            }
        }

        return $after;
    }

    protected function evidenceSources(stdClass $config): array
    {
        $sources = is_string($config->transcript ?? null) ? [$config->transcript] : [];
        foreach (is_array($config->dialogue_segments ?? null) ? $config->dialogue_segments : [] as $segment) {
            if ($segment instanceof stdClass && is_string($segment->text ?? null)) {
                $sources[] = $segment->text;
            }
        }

        return $sources;
    }

    protected function evidencePrefix(): string
    {
        return "Sarun\u{0101}: ";
    }

    protected function preflight(Connection $connection, array $entries, bool $lock = false): array
    {
        $groups = $connection->table('course_groups')->where('dictionary_id', 20)->where('learn_lang', 'lv')
            ->where('is_published', true)->whereIn('level', ['A1', 'A2', 'B1', 'B2'])->orderBy('id');
        $groups = ($lock ? $groups->lockForUpdate() : $groups)->get()->keyBy('id');
        $pages = LessonPage::on($connection->getName())->whereIn('course_group_id', $groups->keys())
            ->where('skill', static::SKILL)->where('learn_lang', 'lv')->where('is_published', true)
            ->where('status', 'published')->whereIn('level', ['A1', 'A2', 'B1', 'B2'])->orderBy('id');
        $pages = ($lock ? $pages->lockForUpdate() : $pages)->get()->keyBy('id');
        $blocks = LessonBlock::on($connection->getName())->whereIn('lesson_page_id', $pages->keys())
            ->where('type', static::SKILL)->whereNull('source_block_id')->orderBy('id');
        $blocks = ($lock ? $blocks->lockForUpdate() : $blocks)->get();
        $variants = LessonBlockVariant::on($connection->getName())->whereIn('lesson_block_id', $blocks->modelKeys())->orderBy('id');
        $variants = ($lock ? $variants->lockForUpdate() : $variants)->get()->groupBy('lesson_block_id');
        $active = [];
        $availability = app(CoursePracticeVariants::class);
        foreach ($blocks as $block) {
            $page = $pages[$block->lesson_page_id];
            $block->setRelation('page', $page);
            $block->setRelation('variants', $variants->get($block->id, collect()));
            $available = $availability->available($block);
            if (! $this->includesBlock($block, $available)) {
                continue;
            }
            foreach ($available as $variant) {
                $active[(int) $variant->id] = [$variant, $block, $page, $groups[$page->course_group_id]];
            }
        }
        ksort($active, SORT_NUMERIC);
        if (array_keys($active) !== array_keys($entries)) {
            throw new RuntimeException('Manifest must match the exact complete active '.static::SKILL.' variant scope.');
        }
        $plan = ['changed' => [], 'kept' => 0, 'already_applied' => 0];
        foreach ($active as $id => [$variant, $block, $page, $group]) {
            $entry = $entries[$id];
            if ((int) $block->id !== $entry->block_id || (int) $page->id !== $entry->page_id
                || (int) $group->category_id !== $entry->category_id || $page->level !== $entry->level
                || $group->level !== $entry->level || $page->slug !== $entry->page_slug || $variant->seed_key !== $entry->seed_key) {
                throw new RuntimeException('Ownership, category, level, slug or seed conflict for variant '.$id.'.');
            }
            $before = (object) ['title' => $variant->getRawOriginal('title'),
                'config' => json_decode($variant->getRawOriginal('config'), false, 512, JSON_THROW_ON_ERROR)];
            $hash = PublishCourseListeningRevision::fingerprint($before);
            if (! hash_equals($hash, $entry->before_sha256) && ! hash_equals($hash, $entry->after_sha256)) {
                throw new RuntimeException('Full title/config conflict for variant '.$id.'.');
            }
            if ($entry->before_sha256 === $entry->after_sha256) {
                $plan['kept']++;
            } elseif ($hash === $entry->after_sha256) {
                $plan['already_applied']++;
            } else {
                $plan['changed'][] = [
                    'variant_id' => $id, 'block_id' => $entry->block_id, 'page_id' => $entry->page_id,
                    'page_slug' => $entry->page_slug, 'category_id' => $entry->category_id,
                    'level' => $entry->level, 'seed_key' => $entry->seed_key, 'before' => $before,
                    'before_sha256' => $hash, 'after_sha256' => $entry->after_sha256,
                ];
            }
        }

        return $plan;
    }

    protected function includesBlock(LessonBlock $block, Collection $available): bool
    {
        return true;
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
        $path = rtrim(str_replace('\\', '/', $path), '/');
        $root = rtrim(str_replace('\\', '/', $root), '/');
        if (PHP_OS_FAMILY === 'Windows') {
            $path = strtolower($path);
            $root = strtolower($root);
        }

        return str_starts_with($path, $root.'/');
    }

    private function backupRoot(): string
    {
        $workspace = realpath(base_path());
        foreach (['.tmp', static::BACKUP_ROOT] as $relative) {
            $path = base_path($relative);
            if (is_link($path) || (! is_dir($path) && ! @mkdir($path, 0700))) {
                throw new RuntimeException('Cannot create private backup directory.');
            }
            $resolved = realpath($path);
            // Reject redirects/junctions as well as links; a backup must stay in this exact private tree.
            if (! $workspace || ! $resolved || ! $this->inside($resolved, $workspace)
                || ! $this->inside($resolved.'/before.json', $workspace.'/'.$relative)) {
                throw new RuntimeException('Unsafe private backup directory.');
            }
        }

        return $resolved;
    }

    protected function archive(array $rows): string
    {
        $mask = umask(0077);
        try {
            $root = $this->backupRoot();
            $uuid = (string) Str::uuid();
            $directory = $root.DIRECTORY_SEPARATOR.$uuid;
            if (! @mkdir($directory, 0700)) {
                throw new RuntimeException('Cannot exclusively create backup directory.');
            }
            $file = $directory.DIRECTORY_SEPARATOR.'before.json';
            $bytes = PublishCourseListeningRevision::canonicalJson((object) ['schema_version' => 1, 'entries' => $rows]);
            $handle = @fopen($file, 'x+b');
            if ($handle === false) {
                throw new RuntimeException('Cannot exclusively create backup.');
            }
            try {
                if (! @chmod($file, 0600)) {
                    throw new RuntimeException('Cannot restrict backup permissions.');
                }
                $offset = 0;
                while ($offset < strlen($bytes)) {
                    $written = @fwrite($handle, substr($bytes, $offset));
                    if ($written === false || $written === 0) {
                        throw new RuntimeException('Backup write failed.');
                    }
                    $offset += $written;
                }
                if (! @fflush($handle) || ! @fsync($handle) || ! @rewind($handle)
                    || stream_get_contents($handle) !== $bytes || @file_get_contents($file) !== $bytes) {
                    throw new RuntimeException('Backup verification failed.');
                }
            } finally {
                fclose($handle);
            }

            return static::BACKUP_ROOT.'/'.$uuid.'/before.json';
        } finally {
            umask($mask);
        }
    }
}
