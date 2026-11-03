<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Schedule::command('tutor:daily-summaries')->everyThirtyMinutes();
Schedule::command('exams:maintain')->everyMinute()->withoutOverlapping();
