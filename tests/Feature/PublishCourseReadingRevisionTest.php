<?php

namespace Tests\Feature;

use App\Console\Commands\PublishCourseReadingRevision;
use Illuminate\Database\Connection;
use Illuminate\Support\ConfigurationUrlParser;
use PHPUnit\Framework\Attributes\DataProvider;
use Symfony\Component\Console\Input\ArrayInput;
use Tests\TestCase;

class PublishCourseReadingRevisionTest extends TestCase
{
    #[DataProvider('guardCases')]
    public function test_explicit_production_guards(array $settings, array $options, array $application, bool $allowed): void
    {
        $this->app->instance('env', $application['environment'] ?? 'production');
        config(['app.env' => $application['configured_environment'] ?? 'production',
            'app.url' => $application['url'] ?? 'https://langbridge-pathways.com']);
        $settings = array_replace(['name' => 'reading_publish_guard', 'driver' => 'mysql',
            'host' => '127.0.0.1', 'database' => 'isolated'], $settings);
        config(['database.connections.reading_publish_guard' => $settings]);
        $effective = (new ConfigurationUrlParser)->parseConfiguration($settings);
        unset($effective['read'], $effective['write']);
        $connection = new Connection(null, 'isolated', '', $effective);
        $command = new class extends PublishCourseReadingRevision
        {
            public function check(Connection $connection, array $options): void
            {
                $this->input = new ArrayInput($options, $this->getDefinition());
                $this->guardApply($connection);
            }
        };
        if (! $allowed) {
            $this->expectException(\RuntimeException::class);
        }
        $command->check($connection, array_replace(['manifest' => '.tmp/unused.json',
            '--confirm-production' => 'langbridge-pathways.com', '--database' => 'isolated'], $options));
        $this->assertTrue($allowed);
    }

    public static function guardCases(): array
    {
        return [
            'explicit matching target' => [[], [], [], true],
            'confirmation missing' => [[], ['--confirm-production' => null], [], false],
            'wrong confirmation' => [[], ['--confirm-production' => 'other.example'], [], false],
            'database missing' => [[], ['--database' => null], [], false],
            'database mismatch' => [[], ['--database' => 'other'], [], false],
            'wrong domain' => [[], [], ['url' => 'https://other.example'], false],
            'wrong runtime environment' => [[], [], ['environment' => 'local'], false],
            'wrong configured environment' => [[], [], ['configured_environment' => 'testing'], false],
            'sqlite forbidden' => [['driver' => 'sqlite'], [], [], false],
            'remote endpoint forbidden' => [['host' => '192.0.2.5'], [], [], false],
            'socket override forbidden' => [['unix_socket' => '/tmp/other.sock'], [], [], false],
            'read override forbidden' => [['read' => ['host' => '192.0.2.5']], [], [], false],
            'write override forbidden' => [['write' => ['host' => '127.0.0.1']], [], [], false],
            'URL remote endpoint forbidden' => [['url' => 'mysql://192.0.2.5/isolated'], [], [], false],
            'URL different database forbidden' => [['url' => 'mysql://127.0.0.1/other'], [], [], false],
        ];
    }
}
