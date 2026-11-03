<?php

namespace Tests\Feature;

use App\Filament\Resources\Exams\ExamVariantArchiveResource;
use App\Models\{CourseExam, ExamAttempt, ExamVariant, ExamVariantArchive, User};
use App\Services\Exams\{ExamAi, ExamDefinition, ExamGrader, ExamRevision, ExamVariantArchiver};
use Illuminate\Support\Facades\{Auth, DB, Http, Schema};
use Tests\TestCase;

class ExamArchiveTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Http::preventStrayRequests();
        Schema::create('users', fn ($t) => $t->id());
        DB::table('users')->insert(['id' => 1]);
        (require database_path('migrations/2026_09_26_000001_create_course_exams.php'))->up();
        (require database_path('migrations/2026_09_26_000002_limit_exam_grading_retries.php'))->up();
        (require database_path('migrations/2026_10_03_000001_create_exam_variant_archives.php'))->up();
    }

    private function variant(): ExamVariant
    {
        $content = (require resource_path('course/exams/b2.php'))[1];
        $exam = CourseExam::create(['level' => 'B2', 'learn_lang' => 'lv', 'title' => 'B2']);
        return ExamVariant::create(['course_exam_id' => $exam->id, 'position' => 2, 'title' => $content['title'], 'content' => $content]);
    }

    public function test_archive_command_is_read_only_by_default_and_idempotent_when_writing(): void
    {
        $variant = $this->variant();
        $before = $variant->fresh()->getAttributes();
        $this->artisan('exams:archive')->assertSuccessful();
        $this->assertSame(0, ExamVariantArchive::count());
        $this->artisan('exams:archive', ['--write' => true])->assertSuccessful();
        $this->artisan('exams:archive', ['--write' => true])->assertSuccessful();
        $this->assertSame(1, ExamVariantArchive::count());
        $this->assertSame($before, $variant->fresh()->getAttributes());
        $this->assertSame($variant->content, ExamVariantArchive::first()->content);
        $this->assertSame(0, ExamAttempt::count());
        Http::assertNothingSent();
    }

    public function test_content_changes_archive_previous_definition_without_changing_attempt_snapshot(): void
    {
        $variant = $this->variant();
        $original = $variant->content;
        $attempt = ExamAttempt::create(['user_id' => 1, 'course_exam_id' => $variant->course_exam_id, 'exam_variant_id' => $variant->id,
            'student_name' => 'Synthetic', 'snapshot' => $original, 'answers' => [], 'playbacks' => [], 'started_at' => now(), 'deadline_at' => now()->addMinute()]);
        $content = $original;
        $content['sections'][2]['tasks'][0]['questions'][5]['accepted'][] = 'vadītāja';
        $variant->update(['content' => $content]);
        $this->assertSame($original, ExamVariantArchive::firstOrFail()->content);
        $this->assertSame($original, $attempt->fresh()->snapshot);
        $this->assertSame($content, $variant->fresh()->content);
        $this->assertSame($variant->id, $attempt->fresh()->exam_variant_id);
        $variant->update(['is_published' => false]);
        $this->assertSame(1, ExamVariantArchive::count());
    }

    public function test_archive_cannot_be_edited_or_deleted(): void
    {
        $archive = app(ExamVariantArchiver::class)->archive($this->variant(), 'Test');
        try { $archive->update(['title' => 'Changed']); $this->fail('Archive update should fail.'); }
        catch (\LogicException) { $this->assertNotSame('Changed', $archive->fresh()->title); }
        $this->expectException(\LogicException::class);
        $archive->delete();
    }

    public function test_archive_is_available_only_to_administrators_and_has_no_edit_actions(): void
    {
        Auth::shouldReceive('user')->andReturn(null);
        $this->assertFalse(ExamVariantArchiveResource::canViewAny());
        $this->assertFalse(ExamVariantArchiveResource::canCreate());
        $this->assertFalse(ExamVariantArchiveResource::canEdit(null));
        $this->assertFalse(ExamVariantArchiveResource::canDelete(null));
    }

    public function test_learner_is_denied_and_administrator_can_view_archive(): void
    {
        $user = \Mockery::mock(User::class)->makePartial();
        $user->shouldReceive('isFrontendAdmin')->andReturn(false, true);
        Auth::shouldReceive('user')->andReturn($user);
        $this->assertFalse(ExamVariantArchiveResource::canViewAny());
        $this->assertTrue(ExamVariantArchiveResource::canViewAny());
    }

    private function revisionEntry(ExamVariant $variant): array
    {
        return ['level' => 'B2', 'position' => $variant->position,
            'expected_sha256' => app(ExamRevision::class)->contentHash($variant->content),
            'question_changes' => [['id' => 'b2-v2-writing-1-q6', 'set' => ['accepted' => ['vadītājs', 'vadītāja']]]]];
    }

    public function test_revision_dry_run_and_idempotent_write_preserve_original_archive(): void
    {
        $variant = $this->variant();
        $original = $variant->content;
        $pack = ['revision' => 'test', 'variants' => [$this->revisionEntry($variant)]];
        $service = app(ExamRevision::class);
        $this->assertTrue($service->apply($pack)[0]['changed']);
        $this->assertSame($original, $variant->fresh()->content);
        $this->assertSame(0, ExamVariantArchive::count());
        $this->assertTrue($service->apply($pack, true)[0]['written']);
        $this->assertFalse($service->apply($pack, true)[0]['changed']);
        $this->assertSame(1, ExamVariantArchive::count());
        $this->assertSame($original, ExamVariantArchive::first()->content);
        $this->assertSame(['vadītājs', 'vadītāja'], $variant->fresh()->content['sections'][2]['tasks'][0]['questions'][5]['accepted']);
        Http::assertNothingSent();
    }

    public function test_revision_conflict_rolls_back_the_whole_pack(): void
    {
        $variant = $this->variant();
        $second = ExamVariant::create(['course_exam_id' => $variant->course_exam_id, 'position' => 3,
            'title' => $variant->title, 'content' => $variant->content]);
        $entries = [$this->revisionEntry($variant), $this->revisionEntry($second)];
        $entries[1]['expected_sha256'] = str_repeat('0', 64);
        try { app(ExamRevision::class)->apply(['revision' => 'test', 'variants' => $entries], true); $this->fail('Conflict must fail.'); }
        catch (\RuntimeException $e) { $this->assertStringContainsString('Administrator edits conflict', $e->getMessage()); }
        $this->assertSame($variant->content, $variant->fresh()->content);
        $this->assertSame(0, ExamVariantArchive::count());
    }

    public function test_revision_cannot_change_a_timer_or_total_points(): void
    {
        $variant = $this->variant();
        foreach (['seconds', 'points'] as $field) {
            $entry = $this->revisionEntry($variant);
            unset($entry['question_changes']);
            $section = $variant->content['sections'][1];
            if ($field === 'seconds') $section['seconds'] += 60;
            else $section['tasks'][0]['questions'][0]['points'] += 1;
            $entry['replace_sections'] = ['reading' => $section];
            try { app(ExamRevision::class)->apply(['revision' => 'test', 'variants' => [$entry]], true); $this->fail('Invariants must fail.'); }
            catch (\InvalidArgumentException $e) { $this->assertStringContainsString('must preserve', $e->getMessage()); }
        }
        $this->assertSame(0, ExamVariantArchive::count());
        $this->assertSame($variant->content, $variant->fresh()->content);
    }

    public function test_readable_archive_displays_all_skills_and_escapes_authored_html(): void
    {
        $content = $this->variant()->content;
        $content['sections'][1]['tasks'][0]['text'] = '<script>alert(1)</script>';
        $html = view('filament.exams.archive-content', ['getState' => fn () => $content])->render();
        foreach (['Слушание', 'Чтение', 'Письмо', 'Говорение', 'Критерии оценки'] as $label) $this->assertStringContainsString($label, $html);
        $this->assertStringContainsString('&lt;script&gt;', $html);
        $this->assertStringNotContainsString('<script>', $html);
    }

    public function test_administrator_can_open_archived_version_in_filament(): void
    {
        (require database_path('migrations/2026_08_01_163324_create_permission_tables.php'))->up();
        $archive = app(ExamVariantArchiver::class)->archive($this->variant(), 'Test');
        $user = \Mockery::mock(User::class)->makePartial();
        $user->id = 1;
        $user->name = 'Test Admin';
        $user->email = 'admin@example.test';
        $user->shouldReceive('isFrontendAdmin')->andReturn(true);
        $user->shouldReceive('hasAnyRole')->andReturn(true);
        $user->shouldReceive('hasRole')->andReturn(true);
        $user->shouldReceive('getRoleNames')->andReturn(collect(['admin']));
        $this->actingAs($user);
        \Filament\Facades\Filament::setCurrentPanel(\Filament\Facades\Filament::getPanel('admin'));
        $component = \Livewire\Livewire::test(\App\Filament\Resources\Exams\Pages\ListExamVariantArchives::class)
            ->assertCanSeeTableRecords([$archive])->assertTableActionVisible('view', $archive)
            ->mountTableAction('view', $archive);
        $html = $component->instance()->getSchema($component->instance()->getMountedActionSchemaName())->toHtml();
        $this->assertStringContainsString('Критерии оценки', $html);
        $this->assertStringContainsString('Слушание', $html);
    }

    public function test_administrator_can_download_shared_archived_audio_without_a_public_route(): void
    {
        \Illuminate\Support\Facades\Storage::fake('local');
        $variant = $this->variant();
        $content = $variant->content;
        $content['sections'][0]['tasks'][0]['audio_path'] = 'exams/b2/test.mp3';
        $variant->update(['content' => $content]);
        $archive = app(ExamVariantArchiver::class)->archive($variant, 'Synthetic audio');
        \Illuminate\Support\Facades\Storage::disk('local')->put('exams/b2/test.mp3', 'synthetic-mp3');
        $user = \Mockery::mock(User::class)->makePartial();
        $user->id = 1;
        $user->name = 'Test Admin';
        $user->email = 'admin@example.test';
        $user->shouldReceive('isFrontendAdmin')->andReturn(true);
        $user->shouldReceive('hasAnyRole')->andReturn(true);
        $user->shouldReceive('hasRole')->andReturn(true);
        $user->shouldReceive('getRoleNames')->andReturn(collect(['admin']));
        $this->actingAs($user);
        $id = $content['sections'][0]['tasks'][0]['id'];
        $this->get(route('admin.exam-archives.audio', ['archive' => $archive->id, 'taskId' => $id]))
            ->assertDownload('exam-B2-v2-'.$id.'.mp3')->assertStreamedContent('synthetic-mp3');
        $response = $this->get(route('admin.exam-archives.json', $archive->id))->assertDownload();
        $this->assertSame($archive->content, json_decode($response->streamedContent(), true, flags: JSON_THROW_ON_ERROR)['content']);
        Http::assertNothingSent();
    }

    public function test_learner_cannot_mount_the_archive_page(): void
    {
        $user = \Mockery::mock(User::class)->makePartial();
        $user->id = 1;
        $user->shouldReceive('isFrontendAdmin')->andReturn(false);
        $this->actingAs($user);
        \Filament\Facades\Filament::setCurrentPanel(\Filament\Facades\Filament::getPanel('admin'));
        \Livewire\Livewire::test(\App\Filament\Resources\Exams\Pages\ListExamVariantArchives::class)->assertForbidden();
    }

    public function test_archive_download_routes_reject_guests_and_students(): void
    {
        $archive = app(ExamVariantArchiver::class)->archive($this->variant(), 'Private');
        $urls = [route('admin.exam-archives.json', $archive), route('admin.exam-archives.audio', ['archive' => $archive, 'taskId' => 'task'])];
        foreach ($urls as $url) $this->get($url)->assertRedirect();
        $user = \Mockery::mock(User::class)->makePartial();
        $user->id = 1;
        $user->shouldReceive('isFrontendAdmin')->andReturn(false);
        $this->actingAs($user);
        foreach ($urls as $url) $this->get($url)->assertForbidden();
    }

    public function test_even_administrators_cannot_download_student_recordings_or_traversal_paths_from_archive(): void
    {
        \Illuminate\Support\Facades\Storage::fake('local');
        $variant = $this->variant();
        $user = \Mockery::mock(User::class)->makePartial();
        $user->id = 1;
        $user->shouldReceive('isFrontendAdmin')->andReturn(true);
        $this->actingAs($user);
        $taskId = $variant->content['sections'][0]['tasks'][0]['id'];
        foreach (['exam-recordings/private.mp3', 'exams/../exam-recordings/private.mp3'] as $path) {
            $content = $variant->content;
            $content['sections'][0]['tasks'][0]['audio_path'] = $path;
            $variant->update(['content' => $content]);
            $archive = app(ExamVariantArchiver::class)->archive($variant, 'Synthetic rejected path');
            $this->get(route('admin.exam-archives.audio', ['archive' => $archive->id, 'taskId' => $taskId]))->assertNotFound();
        }
        $this->get(route('admin.exam-archives.audio', ['archive' => $archive->id, 'taskId' => 'unknown']))->assertNotFound();
        Http::assertNothingSent();
    }

    public function test_fair_answer_revision_is_accepted_by_canonical_grading_without_provider_calls(): void
    {
        $pack = json_decode(file_get_contents(resource_path('course/exams/revisions/2026-10-03-fair-answers.json')), true, flags: JSON_THROW_ON_ERROR);
        $variants = [];
        foreach ($pack['variants'] as &$entry) {
            $exam = CourseExam::firstOrCreate(['level' => $entry['level'], 'learn_lang' => 'lv'], ['title' => $entry['level']]);
            $source = (static fn ($level) => require resource_path('course/exams/'.strtolower($level).'.php'))($entry['level'])[$entry['position'] - 1];
            $variant = ExamVariant::create(['course_exam_id' => $exam->id, 'position' => $entry['position'], 'title' => $source['title'], 'content' => $source]);
            $entry['expected_sha256'] = app(ExamRevision::class)->contentHash($source);
            $variants[] = $variant;
        }
        unset($entry);
        app(ExamRevision::class)->apply($pack, true);
        $ai = \Mockery::mock(ExamAi::class);
        $ai->shouldReceive('assess')->with([], \Mockery::any())->andReturn([]);
        $grader = new ExamGrader(app(ExamDefinition::class), $ai);
        foreach ($variants as $i => $variant) {
            $snapshot = $variant->fresh()->content + ['level' => $pack['variants'][$i]['level']];
            $answers = [];
            foreach ($pack['variants'][$i]['question_changes'] as $change) {
                if (isset($change['set']['accepted'])) $answers[$change['id']] = ['text' => end($change['set']['accepted'])];
                if (isset($change['set']['correct'])) $answers[$change['id']] = ['text' => $change['set']['correct']];
            }
            $attempt = ExamAttempt::create(['user_id' => 1, 'course_exam_id' => $variant->course_exam_id, 'exam_variant_id' => $variant->id,
                'student_name' => 'Synthetic', 'snapshot' => $snapshot, 'answers' => $answers, 'playbacks' => [], 'status' => 'pending',
                'started_at' => now(), 'deadline_at' => now(), 'submitted_at' => now()]);
            $grader->grade($attempt->id);
            $this->assertSame('completed', $attempt->fresh()->status);
            $checked = [];
            foreach ($attempt->fresh()->results as $section) $checked += $section['answers'];
            foreach (array_keys($answers) as $id) $this->assertSame(1, $checked[$id]['points']);
        }
        $this->assertSame(8, ExamVariantArchive::count());
        Http::assertNothingSent();
    }
}
