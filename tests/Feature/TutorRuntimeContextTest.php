<?php

namespace Tests\Feature;

use App\Models\TutorConversation;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class TutorRuntimeContextTest extends TestCase
{
    private User $owner;
    private TutorConversation $conversation;
    private string $session;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Http::preventStrayRequests();
        Schema::create('users', function ($t) { $t->id(); $t->string('email')->unique(); $t->string('name'); $t->timestamps(); });
        Schema::create('personal_access_tokens', function ($t) { $t->id(); $t->unsignedBigInteger('tokenable_id'); $t->timestamp('expires_at')->nullable(); });
        (require database_path('migrations/2026_09_05_000001_create_tutor_conversations_table.php'))->up();
        (require database_path('migrations/2026_10_16_000001_create_credit_accounts.php'))->up();
        (require database_path('migrations/2026_10_22_000001_add_tutor_runtime_context.php'))->up();
        config(['credits.enabled' => true, 'credits.gateway_secret' => str_repeat('s', 32)]);
        $this->owner = User::create(['name' => 'Fixture', 'email' => 'owner@example.test']);
        $this->conversation = TutorConversation::create(['user_id' => $this->owner->id]);
        $this->session = str_repeat('c', 64);
        DB::table('credit_gateway_sessions')->insert([
            'ticket_hash' => hash('sha256', 'fixture'), 'session_hash' => hash('sha256', $this->session),
            'user_id' => $this->owner->id, 'ticket_expires_at' => now()->addMinute(), 'expires_at' => now()->addHour(), 'created_at' => now(),
        ]);
    }

    private function callContext(string $action, array $data = [])
    {
        return $this->withHeader('X-Credit-Gateway', str_repeat('s', 32))->postJson('/api/internal/credits', [
            'action' => 'context.'.$action, 'session' => $this->session, 'conversation_id' => $this->conversation->id,
        ] + $data);
    }

    public function test_messages_are_idempotent_and_full_text_is_restored(): void
    {
        $text = trim(str_repeat('Latvian ', 900));
        $data = ['role' => 'user', 'text' => $text, 'client_key' => 'turn:user'];
        $id = $this->callContext('message', $data)->assertOk()->json('message_id');
        $this->callContext('message', $data)->assertOk()->assertJsonPath('message_id', $id);
        $this->callContext('message', array_replace($data, ['text' => 'different']))->assertConflict();
        $this->assertSame(1, $this->conversation->messages()->count());
        $this->callContext('load')->assertOk()->assertJsonPath('messages.0.text', $text)->assertJsonPath('has_more', false);
    }

    public function test_long_memory_indexes_new_messages_once_under_the_owner_but_never_indexes_disabled_memory(): void
    {
        $embedding = \Mockery::mock(\App\Services\Tutor\OpenAiEmbeddingService::class);
        $embedding->shouldReceive('embedTutorMessage')->once()->withArgs(function ($message, $model, $dimensions) {
            $context = app(\App\Services\Credits\CreditContext::class);
            $this->assertSame($this->owner->id, $context->userId);
            $this->assertSame('memory', $context->purpose);
            $this->assertSame('economy', $context->tutorPreset);
            return $message->original_text === 'Index once' && $model === 'text-embedding-3-small' && $dimensions === 1536;
        })->andReturn(['ok' => true]);
        $this->app->instance(\App\Services\Tutor\OpenAiEmbeddingService::class, $embedding);
        $this->callContext('message', ['role' => 'user', 'text' => 'No index', 'client_key' => 'no-index',
            'metadata' => ['longMemoryEnabled' => false]])->assertOk();
        $data = ['role' => 'user', 'text' => 'Index once', 'client_key' => 'index-once',
            'tutor_preset' => 'economy',
            'metadata' => ['longMemoryEnabled' => true, 'embeddingModel' => 'text-embedding-3-small']];
        $this->callContext('message', $data)->assertOk();
        $this->callContext('message', $data)->assertOk();
        $this->assertSame(2, $this->conversation->messages()->count());
        $this->assertNull(app(\App\Services\Credits\CreditContext::class)->userId);
        $this->assertNull(app(\App\Services\Credits\CreditContext::class)->tutorPreset);
    }

    public function test_checkpoint_preserves_summary_lesson_and_tools_without_deleting_archive(): void
    {
        $id = $this->callContext('message', ['role' => 'user', 'text' => 'An old message', 'client_key' => 'old:user'])->json('message_id');
        $this->callContext('message', ['role' => 'assistant', 'text' => 'A recent answer', 'client_key' => 'new:assistant'])->assertOk();
        $state = ['summary' => 'Durable summary', 'summary_through_id' => $id,
            'lesson_context' => ['topic' => 'A task'], 'tool_interactions' => [['command' => 'navigate', 'result' => ['ok' => true]]]];
        $this->callContext('save', ['revision' => 0, 'state' => $state])->assertOk()->assertJsonPath('revision', 1);
        $this->callContext('load')->assertOk()->assertJsonPath('state.summary', 'Durable summary')
            ->assertJsonPath('state.lesson_context.topic', 'A task')->assertJsonCount(1, 'messages')
            ->assertJsonPath('messages.0.text', 'A recent answer');
        $this->assertSame(2, $this->conversation->messages()->count());
        $this->callContext('save', ['revision' => 0, 'state' => $state])->assertConflict();
        $this->callContext('save', ['revision' => 1, 'state' => ['summary' => 'wrong', 'summary_through_id' => 0]])->assertConflict();
    }

    public function test_cross_user_access_session_expiry_and_missing_gateway_secret_are_rejected(): void
    {
        $other = User::create(['name' => 'Other', 'email' => 'other@example.test']);
        $foreign = TutorConversation::create(['user_id' => $other->id]);
        $this->conversation = $foreign;
        foreach (['load', 'message', 'save'] as $action) {
            $this->callContext($action, ['revision' => 0, 'state' => ['summary' => 'test'], 'role' => 'user', 'text' => 'wrong', 'client_key' => 'cross:user'])->assertNotFound();
        }
        DB::table('credit_gateway_sessions')->update(['expires_at' => now()->subSecond()]);
        $this->callContext('load')->assertUnauthorized();
        $this->withHeader('X-Credit-Gateway', 'wrong')->postJson('/api/internal/credits', ['action' => 'context.load'])->assertForbidden();
    }

    public function test_unsummarized_archive_is_paginated_from_oldest_not_truncated_to_latest_messages(): void
    {
        for ($i = 0; $i < 107; $i++) {
            $this->conversation->messages()->create(['user_id' => $this->owner->id, 'role' => 'user', 'original_text' => 'Message '.$i]);
        }
        $page = $this->callContext('load')->assertOk()->assertJsonPath('messages.0.text', 'Message 0')
            ->assertJsonCount(100, 'messages')->assertJsonPath('has_more', true)->json();
        $this->callContext('load', ['after_id' => $page['messages'][99]['id']])->assertOk()
            ->assertJsonCount(7, 'messages')->assertJsonPath('messages.0.text', 'Message 100')->assertJsonPath('has_more', false);
    }

    public function test_first_turn_checkpoint_accepts_empty_summary_and_cannot_cover_foreign_message(): void
    {
        $state = ['summary' => '', 'summary_through_id' => 0, 'lesson_context' => null, 'tool_interactions' => [], 'last_compression' => null];
        $this->callContext('save', ['revision' => 0, 'state' => $state])->assertOk();
        $this->callContext('load')->assertOk()->assertJsonPath('state.summary', '');
        $this->callContext('save', ['revision' => 1, 'state' => ['summary' => 'bad', 'summary_through_id' => 999]])->assertUnprocessable();
    }

    private function snapshot(): array
    {
        return [
            'page' => '/course',
            'task' => ['topic' => 'Знакомство', 'text' => 'Nosauc savu vārdu.', 'instructions' => 'Ответь по-латышски.',
                'lessonBlockId' => 7, 'format' => 'speaking', 'completed' => false],
            'notes' => [['id' => 3, 'category' => 'learning', 'key' => 'level', 'content' => 'Уровень A1', 'importance' => 3]],
            'progress' => ['completed' => 0, 'course_step_id' => 12, 'score' => 80.5, 'passed' => false, 'next' => null],
            'voice' => ['voice' => 'browser', 'gender' => 'neutral', 'russian_self_reference' => 'avoid gendered self-reference when possible'],
        ];
    }

    private function journalState(?array $snapshot = null): array
    {
        return ['summary' => '', 'summary_through_id' => 0, 'journal_version' => 1, 'parameter_snapshot' => $snapshot ?? $this->snapshot()];
    }

    private function delta(array $changes): array
    {
        return ['role' => 'system', 'text' => 'Parameters changed', 'client_key' => 'state:delta:1',
            'metadata' => ['kind' => 'state_delta', 'changes' => $changes, 'event_version' => 1]];
    }

    public function test_snapshot_and_append_only_delta_round_trip_without_mutating_the_frozen_snapshot(): void
    {
        $snapshot = $this->snapshot();
        $this->callContext('save', ['revision' => 0, 'state' => $this->journalState($snapshot)])->assertOk();
        $event = $this->delta([
            ['path' => 'page', 'value' => '/grammar'],
            ['path' => 'task', 'value' => array_replace($snapshot['task'], ['completed' => true])],
            ['path' => 'notes', 'value' => []],
            ['path' => 'progress', 'value' => ['completed' => 1]],
            ['path' => 'voice', 'value' => null],
        ]);
        $id = $this->callContext('message', $event)->assertOk()->json('message_id');
        $this->callContext('load')->assertOk()->assertJsonPath('state.journal_version', 1)
            ->assertJsonPath('state.parameter_snapshot', $snapshot)->assertJsonCount(1, 'messages')
            ->assertJsonPath('messages.0.id', $id)->assertJsonPath('messages.0.role', 'system')
            ->assertJsonPath('messages.0.metadata', $event['metadata']);
        $this->assertSame($snapshot, $this->conversation->fresh()->runtime_context['parameter_snapshot']);
        $this->callContext('save', ['revision' => 1, 'state' => $this->journalState($snapshot)])->assertOk();
        $this->callContext('message', $event)->assertOk()->assertJsonPath('message_id', $id);
        $this->assertSame(1, $this->conversation->messages()->count());
    }

    public function test_delta_retries_conflict_on_changed_metadata_even_if_text_and_client_key_are_identical(): void
    {
        $event = $this->delta([['path' => 'progress', 'value' => ['completed' => 1]]]);
        $this->callContext('message', $event)->assertOk();
        $changed = $event;
        $changed['metadata']['changes'][0]['value']['completed'] = true;
        $this->callContext('message', $changed)->assertConflict();
        $changed['metadata']['changes'][0]['value']['completed'] = 2;
        $this->callContext('message', $changed)->assertConflict();
        $this->callContext('message', array_replace($event, ['metadata' => ['kind' => 'other']]))->assertConflict();
        $this->callContext('load')->assertOk()->assertJsonPath('messages.0.metadata.changes.0.value.completed', 1);
        $this->assertSame(1, $this->conversation->messages()->count());
    }

    public function test_service_preserves_exact_snapshot_strings_and_legacy_note_and_task_metadata(): void
    {
        $snapshot = $this->snapshot();
        $snapshot['task']['text'] = "  Latvian line\nsecond line  ";
        $snapshot['task']['instructions'] = '';
        $snapshot['task']['lessonBlockId'] = 0;
        $snapshot['notes'][0]['last_seen_at'] = '2026-10-28T10:00:00Z';
        $snapshot['progress']['label'] = '  A1  ';
        $service = app(\App\Services\Tutor\TutorRuntimeContext::class);
        $service->handle($this->owner->id, 'context.save', ['action' => 'context.save', 'conversation_id' => $this->conversation->id,
            'revision' => 0, 'state' => $this->journalState($snapshot)]);
        $loaded = $service->handle($this->owner->id, 'context.load', ['action' => 'context.load', 'conversation_id' => $this->conversation->id]);
        $this->assertSame($snapshot, $loaded['state']['parameter_snapshot']);
    }

    public function test_internal_http_route_preserves_empty_and_whitespace_strings_in_snapshots_and_deltas(): void
    {
        $snapshot = $this->snapshot();
        $snapshot['page'] = '';
        $snapshot['task']['topic'] = "  Tēma\t ";
        $snapshot['task']['text'] = "\n  Pirmā rinda\r\nOtrā rinda  \n";
        $snapshot['task']['instructions'] = '';
        $snapshot['notes'][0]['content'] = " \t\n ";
        $snapshot['progress'] = ['empty' => '', 'whitespace' => " \t\n ", 'label' => '  A1  '];
        $snapshot['voice']['russian_self_reference'] = '';

        // Keep the real HTTP stack: TrimStrings/ConvertEmptyStringsToNull must
        // not alter the raw context payload passed to the service by the gateway API.
        $this->callContext('save', ['revision' => 0, 'state' => $this->journalState($snapshot)])->assertOk();
        $this->assertSame($snapshot, $this->callContext('load')->assertOk()->json('state.parameter_snapshot'));
        $this->assertSame($snapshot, $this->conversation->fresh()->runtime_context['parameter_snapshot']);
        $this->callContext('save', ['revision' => 1, 'state' => $this->journalState($snapshot)])->assertOk();

        $changes = [
            ['path' => 'page', 'value' => " \t/course \n"],
            ['path' => 'task', 'value' => array_replace($snapshot['task'], ['text' => '', 'instructions' => " \t\n "])],
            ['path' => 'notes', 'value' => [array_replace($snapshot['notes'][0], ['content' => ''])]],
            ['path' => 'progress', 'value' => ['empty' => '', 'label' => " \t A2 \n"]],
            ['path' => 'voice', 'value' => array_replace($snapshot['voice'], ['russian_self_reference' => " \t\n "])],
        ];
        $event = $this->delta($changes);
        $event['text'] = json_encode(['kind' => 'state_delta', 'changes' => $changes], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $id = $this->callContext('message', $event)->assertOk()->json('message_id');
        $this->callContext('message', $event)->assertOk()->assertJsonPath('message_id', $id);
        $loaded = $this->callContext('load')->assertOk()->json();
        $this->assertSame($snapshot, $loaded['state']['parameter_snapshot']);
        $this->assertSame($event['metadata'], $loaded['messages'][0]['metadata']);
        $this->assertSame($event['text'], $loaded['messages'][0]['text']);
        $this->assertSame(1, $this->conversation->messages()->count());
    }

    public function test_empty_maps_null_fields_and_legacy_checkpoint_omissions_restore_compatibly(): void
    {
        $this->callContext('save', ['revision' => 0, 'state' => ['summary' => '', 'summary_through_id' => 0]])->assertOk();
        $legacy = $this->callContext('load')->assertOk()->json('state');
        $this->assertArrayNotHasKey('journal_version', $legacy);
        $this->assertArrayNotHasKey('parameter_snapshot', $legacy);
        $this->callContext('save', ['revision' => 1, 'state' => ['summary' => '', 'parameter_snapshot' => null]])->assertOk();
        $this->callContext('load')->assertOk()->assertJsonPath('state.parameter_snapshot', null);
        $empty = ['page' => null, 'task' => null, 'notes' => [], 'progress' => (object) [], 'voice' => null];
        $this->callContext('save', ['revision' => 2, 'state' => $this->journalState($empty)])->assertOk();
        $wire = json_decode($this->callContext('load')->assertOk()->getContent());
        $this->assertInstanceOf(\stdClass::class, $wire->state->parameter_snapshot->progress);
        $this->assertSame([], $wire->state->parameter_snapshot->notes);
        $this->callContext('save', ['revision' => 3, 'state' => ['journal_version' => 1, 'parameter_snapshot' => (object) []]])->assertOk();
        $wire = json_decode($this->callContext('load')->assertOk()->getContent());
        $this->assertInstanceOf(\stdClass::class, $wire->state->parameter_snapshot);
        $event = $this->delta([['path' => 'progress', 'value' => (object) []]]);
        $this->callContext('message', $event)->assertOk();
        $wire = json_decode($this->callContext('load')->assertOk()->getContent());
        $this->assertInstanceOf(\stdClass::class, $wire->messages[0]->metadata->changes[0]->value);
    }

    public static function invalidJournalState(): iterable
    {
        yield 'unknown journal version' => ['journal_version', 2];
        yield 'string journal version' => ['journal_version', '1'];
        yield 'null journal version' => ['journal_version', null];
        yield 'snapshot string' => ['parameter_snapshot', 'not an object'];
        yield 'snapshot list' => ['parameter_snapshot', ['value']];
        yield 'root instructions' => ['parameter_snapshot.instructions', 'replace base rules'];
        yield 'root code' => ['parameter_snapshot.code', 'return 1'];
        yield 'root credential' => ['parameter_snapshot.apiKey', 'fixture-only'];
        yield 'page array' => ['parameter_snapshot.page', ['url' => '/course']];
        yield 'long page' => ['parameter_snapshot.page', str_repeat('p', 2001)];
        yield 'unknown task field' => ['parameter_snapshot.task.code', 'return 1'];
        yield 'task wrong shape' => ['parameter_snapshot.task', 'task'];
        yield 'long task text' => ['parameter_snapshot.task.text', str_repeat('t', 4001)];
        yield 'task completed must be boolean' => ['parameter_snapshot.task.completed', 'true'];
        yield 'unknown task format' => ['parameter_snapshot.task.format', 'exam'];
        yield 'task ID must be integer' => ['parameter_snapshot.task.lessonBlockId', '7'];
        yield 'notes must be list' => ['parameter_snapshot.notes', ['key' => 'A1']];
        yield 'too many notes' => ['parameter_snapshot.notes', array_fill(0, 9, ['key' => 'level', 'content' => 'A1'])];
        yield 'note unknown field' => ['parameter_snapshot.notes.0.javascript', 'return 1'];
        yield 'note text too long' => ['parameter_snapshot.notes.0.content', str_repeat('n', 601)];
        yield 'progress nested map' => ['parameter_snapshot.progress.nested', ['completed' => 1]];
        yield 'progress list' => ['parameter_snapshot.progress', [1, 2]];
        yield 'progress unsafe key' => ['parameter_snapshot.progress.bad key', 1];
        yield 'progress prototype' => ['parameter_snapshot.progress.__proto__', 'bad'];
        yield 'nested constructor' => ['parameter_snapshot.task.constructor', 'bad'];
        yield 'nested prototype' => ['parameter_snapshot.notes.0.prototype', 'bad'];
        yield 'voice unknown configuration' => ['parameter_snapshot.voice.enabled', true];
        yield 'voice wrong type' => ['parameter_snapshot.voice.voice', ['code' => 'bad']];
        yield 'snapshot size' => ['parameter_snapshot.progress.large', str_repeat('x', 24576)];
    }

    #[DataProvider('invalidJournalState')]
    public function test_malformed_snapshot_is_rejected_without_updating_checkpoint(string $path, mixed $value): void
    {
        $state = $this->journalState();
        data_set($state, $path, $value);
        $this->callContext('save', ['revision' => 0, 'state' => $state])->assertUnprocessable()->assertJsonStructure(['errors']);
        $conversation = $this->conversation->fresh();
        $this->assertSame(0, $conversation->context_revision);
        $this->assertNull($conversation->runtime_context);
        $this->assertSame(0, $conversation->messages()->count());
    }

    public static function invalidDelta(): iterable
    {
        yield 'wrong role' => ['role', 'user'];
        yield 'wrong event version' => ['metadata.event_version', 2];
        yield 'string event version' => ['metadata.event_version', '1'];
        yield 'no changes' => ['metadata.changes', []];
        yield 'too many changes' => ['metadata.changes', array_fill(0, 17, ['path' => 'page', 'value' => '/course'])];
        yield 'unknown event field' => ['metadata.code', 'return 1'];
        yield 'unknown change field' => ['metadata.changes.0.code', 'return 1'];
        yield 'unlisted dotted path' => ['metadata.changes.0.path', 'task.unknown'];
        yield 'JSON pointer path' => ['metadata.changes.0.path', '/page'];
        yield 'unknown path' => ['metadata.changes.0.path', 'instructions'];
        yield 'prototype path' => ['metadata.changes.0.path', '__proto__'];
        yield 'nonstring path' => ['metadata.changes.0.path', ['page']];
        yield 'wrong page type' => ['metadata.changes.0.value', ['page' => '/course']];
        yield 'duplicate paths' => ['metadata.changes', [['path' => 'page', 'value' => '/a'], ['path' => 'page', 'value' => '/b']]];
        yield 'unsafe nested key' => ['metadata.changes', [['path' => 'progress', 'value' => ['constructor' => 1]]]];
        yield 'nested progress' => ['metadata.changes', [['path' => 'progress', 'value' => ['level' => ['value' => 'A1']]]]];
        yield 'unknown task shape' => ['metadata.changes', [['path' => 'task', 'value' => ['id' => 'task', 'title' => 'Task']]]];
        yield 'overlarge delta value' => ['metadata.changes', [['path' => 'progress', 'value' => ['large' => str_repeat('x', 24576)]]]];
    }

    #[DataProvider('invalidDelta')]
    public function test_malformed_delta_is_rejected_without_appending_a_message(string $path, mixed $value): void
    {
        $event = $this->delta([['path' => 'page', 'value' => '/grammar']]);
        data_set($event, $path, $value);
        $this->callContext('message', $event)->assertUnprocessable()->assertJsonStructure(['errors']);
        $this->assertSame(0, $this->conversation->messages()->count());
    }

    public function test_delta_requires_an_explicit_value_and_checkpoint_and_metadata_keep_their_global_size_limits(): void
    {
        $event = $this->delta([['path' => 'page']]);
        $this->callContext('message', $event)->assertUnprocessable()->assertJsonValidationErrors('metadata.changes.0.value');
        $event = $this->delta([['path' => 'page', 'value' => null]]);
        $this->callContext('message', $event)->assertOk();
        $state = $this->journalState();
        $state['tool_interactions'] = [['result' => str_repeat('x', 65536)]];
        $this->callContext('save', ['revision' => 0, 'state' => $state])->assertUnprocessable()->assertJsonValidationErrors('state');
        $this->callContext('message', ['role' => 'system', 'text' => 'legacy', 'client_key' => 'large:meta',
            'metadata' => ['legacy' => str_repeat('x', 65536)]])->assertUnprocessable()->assertJsonValidationErrors('metadata');
        $this->assertSame(1, $this->conversation->messages()->count());
    }

    public function test_system_deltas_and_tool_messages_are_never_embedded_even_with_a_long_memory_flag(): void
    {
        $embedding = \Mockery::mock(\App\Services\Tutor\OpenAiEmbeddingService::class);
        $embedding->shouldNotReceive('embedTutorMessage');
        $this->app->instance(\App\Services\Tutor\OpenAiEmbeddingService::class, $embedding);
        foreach (['system', 'tool'] as $role) {
            $this->callContext('message', ['role' => $role, 'text' => 'Not a learner message', 'client_key' => 'no-index:'.$role,
                'metadata' => ['longMemoryEnabled' => true]])->assertOk();
        }
        $this->callContext('message', $this->delta([['path' => 'page', 'value' => '/grammar']]))->assertOk();
        $this->assertSame(3, $this->conversation->messages()->count());
    }

    public function test_parameter_values_are_only_context_and_never_write_canonical_progress(): void
    {
        Schema::create('user_dictionary_words', function ($table) {
            $table->unsignedBigInteger('user_id');
            $table->integer('score');
        });
        DB::table('user_dictionary_words')->insert(['user_id' => $this->owner->id, 'score' => 7]);
        $this->callContext('save', ['revision' => 0, 'state' => $this->journalState()])->assertOk();
        $this->callContext('message', $this->delta([['path' => 'progress', 'value' => ['score' => 999]]]))->assertOk();
        $this->assertDatabaseHas('user_dictionary_words', ['user_id' => $this->owner->id, 'score' => 7]);
        $this->assertDatabaseCount('user_dictionary_words', 1);
    }

    public function test_snapshot_and_delta_remain_private_to_the_session_owner(): void
    {
        $other = User::create(['name' => 'Other', 'email' => 'journal-other@example.test']);
        $foreign = TutorConversation::create(['user_id' => $other->id, 'runtime_context' => ['parameter_snapshot' => ['page' => '/private-other-page']], 'context_revision' => 3]);
        $this->conversation = $foreign;
        $response = $this->callContext('load')->assertNotFound();
        $this->assertStringNotContainsString('/private-other-page', $response->getContent());
        $this->callContext('save', ['revision' => 3, 'state' => $this->journalState()])->assertNotFound();
        $this->callContext('message', $this->delta([['path' => 'page', 'value' => '/grammar']]))->assertNotFound();
        $this->assertSame(3, $foreign->fresh()->context_revision);
        $this->assertSame('/private-other-page', $foreign->fresh()->runtime_context['parameter_snapshot']['page']);
        $this->assertSame(0, $foreign->messages()->count());
    }

    public function test_compaction_checkpoint_keeps_full_event_archive_and_advances_only_the_context_boundary(): void
    {
        $this->callContext('save', ['revision' => 0, 'state' => $this->journalState()])->assertOk();
        $id = $this->callContext('message', $this->delta([['path' => 'page', 'value' => '/grammar']]))->assertOk()->json('message_id');
        $this->callContext('message', ['role' => 'user', 'text' => 'Current question', 'client_key' => 'current:user'])->assertOk();
        $nextSnapshot = array_replace($this->snapshot(), ['page' => '/grammar']);
        $state = array_replace($this->journalState($nextSnapshot), ['summary' => 'Earlier lesson', 'summary_through_id' => $id]);
        $this->callContext('save', ['revision' => 1, 'state' => $state])->assertOk();
        $this->callContext('load')->assertOk()->assertJsonPath('state.parameter_snapshot.page', '/grammar')
            ->assertJsonCount(1, 'messages')->assertJsonPath('messages.0.text', 'Current question');
        $this->assertSame(2, $this->conversation->messages()->count());
        $this->assertSame('state_delta', $this->conversation->messages()->findOrFail($id)->metadata['kind']);
    }

    public function test_completed_only_delta_round_trips_without_resending_task_text_or_mutating_snapshot(): void
    {
        $snapshot = $this->snapshot();
        $snapshot['task']['text'] = str_repeat('T', 4000);
        $snapshot['task']['instructions'] = str_repeat('I', 4000);
        $this->callContext('save', ['revision' => 0, 'state' => $this->journalState($snapshot)])->assertOk();
        $frozen = $this->conversation->fresh()->getRawOriginal('runtime_context');
        $event = $this->delta([['path' => 'task.completed', 'value' => true]]);
        $event['text'] = json_encode(['kind' => 'state_delta', 'changes' => $event['metadata']['changes']], JSON_THROW_ON_ERROR);
        $id = $this->callContext('message', $event)->assertOk()->json('message_id');
        $this->callContext('message', $event)->assertOk()->assertJsonPath('message_id', $id);
        $loaded = $this->callContext('load')->assertOk()->assertJsonCount(1, 'messages')->json();
        $this->assertSame($event['metadata'], $loaded['messages'][0]['metadata']);
        $this->assertSame($event['text'], $loaded['messages'][0]['text']);
        $this->assertLessThan(200, strlen($loaded['messages'][0]['text']));
        $this->assertStringNotContainsString($snapshot['task']['text'], json_encode($loaded['messages'][0], JSON_THROW_ON_ERROR));
        $this->assertStringNotContainsString($snapshot['task']['instructions'], json_encode($loaded['messages'][0], JSON_THROW_ON_ERROR));
        $this->assertSame($snapshot, $loaded['state']['parameter_snapshot']);
        $this->assertSame($frozen, $this->conversation->fresh()->getRawOriginal('runtime_context'));
        $event['metadata']['changes'][0]['value'] = false;
        $this->callContext('message', $event)->assertConflict();
        $this->assertSame(1, $this->conversation->messages()->count());
    }

    public function test_more_than_five_granular_and_root_changes_restore_exactly_through_http(): void
    {
        $changes = [
            ['path' => 'page', 'value' => '/grammar'],
            ['path' => 'notes', 'value' => []],
            ['path' => 'progress', 'value' => ['completed' => 1]],
            ['path' => 'voice', 'value' => null],
            ['path' => 'task.topic', 'value' => '  Tēma  '],
            ['path' => 'task.text', 'value' => ''],
            ['path' => 'task.instructions', 'value' => " \t\n "],
            ['path' => 'task.lessonBlockId', 'value' => null],
            ['path' => 'task.format', 'value' => 'writing'],
            ['path' => 'task.completed', 'value' => false],
        ];
        $event = $this->delta($changes);
        $this->callContext('message', $event)->assertOk();
        $loaded = $this->callContext('load')->assertOk()->json('messages.0.metadata');
        $this->assertSame($event['metadata'], $loaded);
        $this->assertCount(10, $loaded['changes']);
    }

    public function test_granular_task_field_bounds_and_root_task_reset_remain_supported(): void
    {
        $changes = [
            ['path' => 'task.topic', 'value' => str_repeat('t', 200)],
            ['path' => 'task.text', 'value' => str_repeat('x', 4000)],
            ['path' => 'task.instructions', 'value' => str_repeat('i', 4000)],
            ['path' => 'task.lessonBlockId', 'value' => 1],
            ['path' => 'task.format', 'value' => 'speaking'],
            ['path' => 'task.completed', 'value' => true],
        ];
        $this->callContext('message', $this->delta($changes))->assertOk();
        $reset = $this->delta([['path' => 'task', 'value' => array_replace($this->snapshot()['task'], ['lessonBlockId' => 8])]]);
        $reset['client_key'] = 'state:reset:task';
        $this->callContext('message', $reset)->assertOk();
        $clear = $this->delta([['path' => 'task', 'value' => null]]);
        $clear['client_key'] = 'state:clear:task';
        $this->callContext('message', $clear)->assertOk();
        $this->callContext('load')->assertOk()->assertJsonCount(3, 'messages')
            ->assertJsonPath('messages.0.metadata.changes', $changes)
            ->assertJsonPath('messages.1.metadata.changes.0.value.lessonBlockId', 8)
            ->assertJsonPath('messages.2.metadata.changes.0.value', null);
    }

    public static function invalidTaskDeltaPaths(): iterable
    {
        foreach (['task.__proto__', 'task.constructor', 'task.prototype', 'task.__proto__.completed',
            'task.completed.constructor', 'task.unknown', 'task..completed', 'task/completed',
            'Task.completed', ' task.completed', 'progress.completed', 'notes.0'] as $path) {
            yield $path => [$path];
        }
    }

    #[DataProvider('invalidTaskDeltaPaths')]
    public function test_only_explicit_task_field_paths_are_accepted(string $path): void
    {
        $this->callContext('message', $this->delta([['path' => $path, 'value' => true]]))
            ->assertUnprocessable()->assertJsonValidationErrors('metadata.changes.0.path');
        $this->assertSame(0, $this->conversation->messages()->count());
    }

    public static function invalidTaskDeltaValues(): iterable
    {
        yield 'boolean string' => ['task.completed', 'true'];
        yield 'boolean integer' => ['task.completed', 1];
        yield 'boolean null' => ['task.completed', null];
        yield 'zero ID' => ['task.lessonBlockId', 0];
        yield 'negative ID' => ['task.lessonBlockId', -1];
        yield 'string ID' => ['task.lessonBlockId', '7'];
        yield 'fractional ID' => ['task.lessonBlockId', 1.5];
        yield 'unknown format' => ['task.format', 'exam'];
        yield 'null format' => ['task.format', null];
        yield 'null text' => ['task.text', null];
        yield 'nonstring topic' => ['task.topic', ['code' => 'return 1']];
        yield 'long topic' => ['task.topic', str_repeat('t', 201)];
        yield 'long text' => ['task.text', str_repeat('x', 4001)];
        yield 'long instructions' => ['task.instructions', str_repeat('i', 4001)];
        yield 'prototype value' => ['task.text', ['__proto__' => 'bad']];
    }

    #[DataProvider('invalidTaskDeltaValues')]
    public function test_granular_task_values_follow_the_task_schema(string $path, mixed $value): void
    {
        $this->callContext('message', $this->delta([['path' => $path, 'value' => $value]]))->assertUnprocessable();
        $this->assertSame(0, $this->conversation->messages()->count());
    }

    public function test_duplicate_paths_and_mixing_root_task_with_subpaths_are_rejected_in_both_orders(): void
    {
        $root = ['path' => 'task', 'value' => $this->snapshot()['task']];
        $leaf = ['path' => 'task.completed', 'value' => true];
        foreach ([[$root, $leaf], [$leaf, $root], [['path' => 'task', 'value' => null], $leaf]] as $changes) {
            $this->callContext('message', $this->delta($changes))->assertUnprocessable()->assertJsonValidationErrors('metadata.changes');
        }
        $this->callContext('message', $this->delta([$leaf, $leaf]))->assertUnprocessable()->assertJsonValidationErrors('metadata.changes.1.path');
        $this->assertSame(0, $this->conversation->messages()->count());
    }
}
