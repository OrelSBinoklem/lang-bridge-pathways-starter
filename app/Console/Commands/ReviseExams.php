<?php

namespace App\Console\Commands;

use App\Services\Exams\ExamRevision;
use Illuminate\Console\Command;

class ReviseExams extends Command
{
    protected $signature = 'exams:revise {pack : JSON editorial revision file} {--write}';
    protected $description = 'Apply reviewed JSON changes with automatic archives and guards against administrator edits';

    public function handle(ExamRevision $revision): int
    {
        try {
            $path = $this->argument('pack');
            if (!is_file($path)) throw new \InvalidArgumentException('Revision file not found.');
            $pack = json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
            $result = $revision->apply($pack, (bool) $this->option('write'));
        } catch (\Throwable $error) {
            $this->error($error->getMessage());
            return self::FAILURE;
        }
        $this->info('Revision '.$pack['revision'].': '.count(array_filter($result, fn ($r) => $r['changed'])).' changed variants; '.
            count(array_filter($result, fn ($r) => $r['written'])).' written.');
        if (!$this->option('write')) $this->info('Dry run: no writes, archives or paid requests.');
        return self::SUCCESS;
    }
}
