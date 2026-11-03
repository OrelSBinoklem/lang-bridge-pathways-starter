<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use Illuminate\Support\Facades\Storage;

class ExamAudioPreviewController extends Controller
{
    private const ROOT = 'exams/previews/gemini38-all-levels-20261011';

    public function index()
    {
        $disk = Storage::disk('local');
        abort_unless($disk->exists(self::ROOT.'/index.html'), 404);
        $html = $disk->get(self::ROOT.'/index.html');
        $pack = json_decode($disk->get(self::ROOT.'/manifest.json'), true, flags: JSON_THROW_ON_ERROR);
        $pack = $this->replacePaths($pack, array_flip($this->paths($pack)));
        $json = json_encode($pack, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_HEX_TAG | JSON_THROW_ON_ERROR);
        $html = preg_replace_callback('~(<script id="pack" type="application/json">).*?(</script>)~s', fn ($m) => $m[1].$json.$m[2], $html, 1);
        return response($html)->header('Content-Type', 'text/html; charset=UTF-8')->header('Cache-Control', 'private, no-store');
    }

    public function audio(int $index)
    {
        $disk = Storage::disk('local');
        $pack = json_decode($disk->get(self::ROOT.'/manifest.json'), true, flags: JSON_THROW_ON_ERROR);
        $path = $this->paths($pack)[$index] ?? '';
        $resolved = realpath($disk->path(self::ROOT.'/'.$path));
        $previewRoot = realpath($disk->path('exams/previews'));
        $mp3Root = realpath($disk->path('exams/gemini'));
        $allowed = $resolved && (($previewRoot && str_starts_with($resolved, $previewRoot.DIRECTORY_SEPARATOR) && str_ends_with($resolved, '.wav'))
            || ($mp3Root && str_starts_with($resolved, $mp3Root.DIRECTORY_SEPARATOR) && preg_match('/[a-f0-9]{64}\.mp3$/', $resolved)));
        abort_unless($allowed, 404);
        return response()->file($resolved, ['Content-Type' => str_ends_with($resolved, '.mp3') ? 'audio/mpeg' : 'audio/wav', 'Cache-Control' => 'private, no-store']);
    }

    private function replacePaths(array $value, array $paths): array
    {
        foreach ($value as &$item) {
            if (is_array($item)) $item = $this->replacePaths($item, $paths);
            elseif (is_string($item) && isset($paths[$item])) $item = route('admin.exam-audio-preview.audio', ['index' => $paths[$item]]);
        }
        return $value;
    }

    private function paths(array $pack): array
    {
        $paths = [];
        foreach ($pack['jobs'] as $job) $paths[] = $job['preview_path'];
        foreach ($pack['variants'] as $variant) {
            foreach (['listening_bundle', 'speaking_bundle'] as $key) $paths[] = $variant[$key]['path'];
            foreach ($variant['listening'] as $task) $paths[] = $task['audio']['path'];
        }
        return array_values(array_unique($paths));
    }
}
