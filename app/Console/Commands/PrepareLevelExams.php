<?php

namespace App\Console\Commands;

class PrepareLevelExams extends PrepareA1Exams
{
    protected $signature = 'exams:prepare {level : A1, A2, B1 or B2} {--write} {--generate} {--publish} {--max-characters=20000}';
    protected $description = 'Prepare fixed authored exam variants for one level without overwriting administrator edits';

    protected function examLevel(): string { return strtoupper($this->argument('level')); }
}
