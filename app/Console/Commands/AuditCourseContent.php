<?php

namespace App\Console\Commands;

use App\Services\ContentAudit\CourseEditorialAudit;
use Illuminate\Console\Command;

class AuditCourseContent extends Command
{
    protected $signature = 'course:audit-content {--dictionary=20} {--group=} {--name=latest}';

    protected $description = 'Read-only lexical editorial inventory; writes reports only inside .tmp/content-audit/';

    public function handle(CourseEditorialAudit $audit): int
    {
        $dictionary = filter_var($this->option('dictionary'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $group = $this->option('group') === null ? null : filter_var($this->option('group'), FILTER_VALIDATE_INT, ['options' => ['min_range' => 1]]);
        $name = $this->option('name');
        if (! $dictionary || $group === false || ! preg_match('/^[a-z0-9][a-z0-9-]{0,60}$/', $name)) {
            $this->error('Use positive dictionary/group IDs and a simple lowercase report name.');

            return self::FAILURE;
        }
        $root = base_path('.tmp');
        if (! is_dir($root) || is_link($root) || is_link($root.'/content-audit')) {
            $this->error('The report directory must be a real directory inside this workspace .tmp/.');

            return self::FAILURE;
        }
        $folder = $root.'/content-audit/'.$name;
        if (file_exists($folder)) {
            $this->error('Report already exists. Choose a new --name; existing reports are not overwritten.');

            return self::FAILURE;
        }
        $report = $audit->report($dictionary, $group);
        if (! is_dir($root.'/content-audit') && ! mkdir($root.'/content-audit')) {
            throw new \RuntimeException('Unable to create the report directory.');
        }
        if (! mkdir($folder)) {
            throw new \RuntimeException('Unable to create the report folder.');
        }
        $manifest = $report;
        $manifest['themes'] = [];
        foreach ($report['themes'] as $theme) {
            $filename = 'group-'.$theme['group']['id'].'.json';
            $this->writeJson($folder.'/'.$filename, $theme);
            unset($theme['records'], $theme['dictionary_records']);
            $manifest['themes'][] = $theme + ['report_file' => $filename];
        }
        $this->writeJson($folder.'/manifest.json', $manifest);
        $this->info('Read-only report: '.$folder.'/manifest.json');
        $this->line('Themes: '.count($report['themes']).'. No content, progress, audio or external services changed.');

        return self::SUCCESS;
    }

    private function writeJson(string $path, array $data): void
    {
        $json = json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR).PHP_EOL;
        if (file_put_contents($path, $json, LOCK_EX) === false) {
            throw new \RuntimeException('Unable to write the report.');
        }
    }
}
