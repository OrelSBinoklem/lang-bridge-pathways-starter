<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use RuntimeException;

class ImportCourseTaskBatch extends Command
{
    protected $signature = 'course:import-task-batch
        {--level=* : Limit to A2, B1 and/or B2; default all three}
        {--write : Create missing pages; never overwrite editor changes}
        {--publish : Publish reading/writing/speaking only; listening remains draft}';

    protected $description = 'Validate an authored task manifest and import the whole batch atomically without TTS';

    public function handle(): int
    {
        try {
            $levels = $this->option('level') ?: ['A2', 'B1', 'B2'];
            if (array_diff($levels, ['A2', 'B1', 'B2'])) {
                throw new RuntimeException('Only A2, B1 and B2 are allowed; A1 is preserved.');
            }
            $manifestPath = resource_path('course/task-packages-a2-b2.json');
            if (!is_file($manifestPath)) {
                throw new RuntimeException('Build the authored manifest before importing.');
            }
            $manifest = json_decode(file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
            if (($manifest['schema_version'] ?? null) !== 1 || empty($manifest['packages'])) {
                throw new RuntimeException('Build the authored manifest before importing.');
            }
            $packages = array_values(array_filter($manifest['packages'], fn ($package) => in_array($package['level'], $levels, true)));
            if (!$packages || count(array_unique(array_column($packages, 'category_id'))) !== count($packages)) {
                throw new RuntimeException('Manifest has no selected packages or duplicate categories.');
            }
            $run = function (string $command, array $arguments): void {
                if ($this->call($command, $arguments) !== self::SUCCESS) {
                    throw new RuntimeException('Batch aborted; '.$command.' failed.');
                }
            };
            foreach ($packages as $package) {
                if (!in_array($package['level'], ['A2', 'B1', 'B2'], true) || !is_int($package['category_id'])) {
                    throw new RuntimeException('Invalid package level/category.');
                }
                foreach (['skills', 'listening', 'vocabulary'] as $kind) {
                    $expected = 'resources/course/'.$kind.'-'.$package['category_id'].'-'.strtolower($package['level']).'.json';
                    $entry = $package[$kind] ?? [];
                    if (($entry['path'] ?? null) !== $expected || !is_file(base_path($expected)) || ($entry['sha256'] ?? '') !== hash_file('sha256', base_path($expected))) {
                        throw new RuntimeException('Manifest mismatch for '.$expected.'; rebuild/review the package.');
                    }
                    $draft = json_decode(file_get_contents(base_path($expected)), true, 512, JSON_THROW_ON_ERROR);
                    if (($draft['category_id'] ?? null) !== $package['category_id'] || ($draft['level'] ?? null) !== $package['level']) {
                        throw new RuntimeException('Manifest/package ownership mismatch.');
                    }
                }
                $run('course:import-skill-package', ['file' => base_path($package['skills']['path'])]);
                $run('course:import-listening', ['file' => base_path($package['listening']['path'])]);
            }
            if ($this->option('write') || $this->option('publish')) {
                DB::transaction(function () use ($packages, $run): void {
                    foreach ($packages as $package) {
                        $flags = array_filter(['--write' => (bool) $this->option('write'), '--publish' => (bool) $this->option('publish')]);
                        $run('course:import-skill-package', ['file' => base_path($package['skills']['path']), ...$flags]);
                        if ($this->option('write')) {
                            $run('course:import-listening', ['file' => base_path($package['listening']['path']), '--write' => true]);
                        }
                    }
                });
                $this->info('Batch committed in the configured database. Listening was not published; no TTS called.');
            } else {
                $this->info('Validated '.count($packages).' themes; no database writes.');
            }
            return self::SUCCESS;
        } catch (\JsonException|RuntimeException $exception) {
            $this->error($exception->getMessage());
            return self::FAILURE;
        }
    }
}
