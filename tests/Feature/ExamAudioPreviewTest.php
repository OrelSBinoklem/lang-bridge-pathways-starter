<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Support\Facades\{Auth, Storage};
use Tests\TestCase;

class ExamAudioPreviewTest extends TestCase
{
    public function test_gallery_and_audio_require_an_administrator(): void
    {
        $this->getJson('/admin/exam-audio-preview')->assertUnauthorized();
        $this->getJson('/admin/exam-audio-preview/audio/0')->assertUnauthorized();
        $user = \Mockery::mock(User::class)->makePartial();
        $user->shouldReceive('hasAnyRole')->andReturn(false);
        Auth::guard('sanctum')->setUser($user);
        $this->getJson('/admin/exam-audio-preview')->assertForbidden();
        $this->getJson('/admin/exam-audio-preview/audio/0')->assertForbidden();
    }

    public function test_audio_path_cannot_escape_private_preview_directory(): void
    {
        Storage::fake('local');
        $user = \Mockery::mock(User::class)->makePartial();
        $user->shouldReceive('hasAnyRole')->andReturn(true);
        Auth::guard('sanctum')->setUser($user);
        Storage::disk('local')->put('exams/previews/gemini38-all-levels-20261011/manifest.json', json_encode([
            'jobs' => [['preview_path' => '../../../exam-recordings/private.wav']], 'variants' => [],
        ]));
        Storage::disk('local')->put('exam-recordings/private.wav', 'private student data');
        $this->getJson('/admin/exam-audio-preview/audio/0')->assertNotFound();
    }
}
