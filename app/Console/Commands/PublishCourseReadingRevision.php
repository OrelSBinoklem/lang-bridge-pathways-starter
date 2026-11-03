<?php

namespace App\Console\Commands;

use Illuminate\Database\Connection;
use Illuminate\Support\ConfigurationUrlParser;
use RuntimeException;

class PublishCourseReadingRevision extends ApplyCourseReadingRevision
{
    protected $signature = 'course:publish-reading-revision {manifest}
        {--apply : Apply the verified release after a private backup}
        {--confirm-production= : Explicit target domain for an authorized production release}
        {--database= : Expected production database name}';

    protected $description = 'Publish only verified reading content, preserving identifiers and other course data';

    protected function guardApply(Connection $connection): void
    {
        if (app()->environment() !== 'production' || config('app.env') !== 'production'
            || $this->option('confirm-production') !== 'langbridge-pathways.com'
            || parse_url((string) config('app.url'), PHP_URL_HOST) !== 'langbridge-pathways.com') {
            throw new RuntimeException('Production publication requires the explicit authorized target domain and matching production environment.');
        }
        $database = $this->option('database');
        if (! is_string($database) || ! preg_match('/^[a-zA-Z0-9_]+$/D', $database)) {
            throw new RuntimeException('An explicit expected production database name is required.');
        }
        $effective = $connection->getConfig();
        $configured = (new ConfigurationUrlParser)->parseConfiguration(
            config('database.connections.'.$connection->getName(), $effective)
        );
        // This host uses one local connection; reject replicas and hidden endpoint overrides.
        if ($connection->getDirectPdoConfig()) {
            throw new RuntimeException('Direct PDO overrides are not supported for production publication.');
        }
        foreach ([$effective, $configured] as $settings) {
            if (! in_array($settings['driver'] ?? null, ['mysql', 'mariadb'], true)
                || ($settings['host'] ?? null) !== '127.0.0.1'
                || ($settings['database'] ?? null) !== $database
                || ! empty($settings['unix_socket']) || isset($settings['read']) || isset($settings['write'])) {
                throw new RuntimeException('Production publication requires the explicitly named database on a single 127.0.0.1 MariaDB connection.');
            }
        }
    }
}
