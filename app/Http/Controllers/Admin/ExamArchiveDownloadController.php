<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ExamVariantArchive;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExamArchiveDownloadController extends Controller
{
    public function json(Request $request, ExamVariantArchive $archive): StreamedResponse
    {
        abort_unless($request->user()?->isFrontendAdmin(), 403);
        $json = json_encode(['level' => $archive->level, 'learn_lang' => $archive->learn_lang, 'position' => $archive->position,
            'title' => $archive->title, 'reason' => $archive->reason, 'was_published' => $archive->was_published,
            'archived_at' => $archive->archived_at->toIso8601String(), 'fingerprint' => $archive->fingerprint, 'content' => $archive->content],
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        return response()->streamDownload(fn () => print($json), 'exam-'.$archive->level.'-v'.$archive->position.'-archive-'.$archive->id.'.json',
            ['Content-Type' => 'application/json; charset=UTF-8', 'Cache-Control' => 'private, no-store']);
    }

    public function audio(Request $request, ExamVariantArchive $archive, string $taskId): StreamedResponse
    {
        abort_unless($request->user()?->isFrontendAdmin(), 403);
        $task = null;
        foreach ($archive->content['sections'] ?? [] as $section) {
            $task = collect($section['tasks'] ?? [])->firstWhere('id', $taskId);
            if ($task) break;
        }
        $path = $task['audio_path'] ?? '';
        abort_unless(preg_match('~^exams/[a-zA-Z0-9/_-]+\.mp3$~', $path), 404);
        abort_unless(Storage::disk('local')->exists($path), 404, 'Архивная запись недоступна.');
        return Storage::disk('local')->download($path, 'exam-'.$archive->level.'-v'.$archive->position.'-'.$taskId.'.mp3',
            ['Content-Type' => 'audio/mpeg', 'Cache-Control' => 'private, no-store']);
    }
}
