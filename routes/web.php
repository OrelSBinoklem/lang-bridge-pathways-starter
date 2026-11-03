<?php

use App\Http\Controllers\Admin\DictionaryExportController;
use App\Http\Controllers\Admin\ExamArchiveDownloadController;
use App\Http\Controllers\Admin\ExamAudioPreviewController;
use App\Http\Controllers\Auth\GoogleAuthController;
use Illuminate\Support\Facades\Route;

Route::inertia('/', 'welcome')->name('home');

Route::middleware(\App\Http\Middleware\UseFrontendAuthToken::class)
    ->withoutMiddleware(\Illuminate\Cookie\Middleware\EncryptCookies::class)
    ->group(function () {
        Route::get('/admin/exam-audio-preview', [ExamAudioPreviewController::class, 'index'])->name('admin.exam-audio-preview');
        Route::get('/admin/exam-audio-preview/audio/{index}', [ExamAudioPreviewController::class, 'audio'])
            ->whereNumber('index')->name('admin.exam-audio-preview.audio');
    });

Route::middleware(['auth', 'verified'])->group(function () {
    Route::inertia('dashboard', 'dashboard')->name('dashboard');
    Route::get('/admin/dictionaries/{dictionary}/export-json', DictionaryExportController::class)
        ->name('admin.dictionaries.export-json');
    Route::get('/admin/exam-archives/{archive}/json', [ExamArchiveDownloadController::class, 'json'])
        ->name('admin.exam-archives.json');
    Route::get('/admin/exam-archives/{archive}/audio/{taskId}', [ExamArchiveDownloadController::class, 'audio'])
        ->where('taskId', '[a-zA-Z0-9_-]+')->name('admin.exam-archives.audio');
});

Route::get('/auth/google', [GoogleAuthController::class, 'redirect'])->name('auth.google');
Route::get('/auth/google/callback', [GoogleAuthController::class, 'callback'])->name('auth.google.callback');

require __DIR__.'/settings.php';
