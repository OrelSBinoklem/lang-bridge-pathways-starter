<?php

namespace Tests\Feature;

use App\Models\TutorConversation;
use App\Models\TutorMessage;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TutorConversationTest extends TestCase
{
    private User $owner;

    private TutorConversation $conversation;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame('sqlite', config('database.default'));
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Http::preventStrayRequests();
        Schema::create('users', function ($table) {
            $table->id();
            $table->string('name');
            $table->string('email')->unique();
            $table->timestamps();
        });
        (require database_path('migrations/2026_09_05_000001_create_tutor_conversations_table.php'))->up();
        (require database_path('migrations/2026_10_22_000001_add_tutor_runtime_context.php'))->up();
        $this->owner = User::create(['name' => 'Owner', 'email' => 'conversation@example.test']);
        $this->conversation = TutorConversation::create(['user_id' => $this->owner->id]);
    }

    private function message(string $role, string $text, ?array $metadata = null): TutorMessage
    {
        return $this->conversation->messages()->create([
            'user_id' => $this->owner->id, 'role' => $role, 'original_text' => $text, 'metadata' => $metadata,
        ]);
    }

    private function url(): string
    {
        return '/api/tutor/conversations/'.$this->conversation->id.'/messages';
    }

    private function deltaMetadata(): array
    {
        return ['kind' => 'state_delta', 'event_version' => 1, 'changes' => [['path' => 'page', 'value' => '/hidden-context-page']]];
    }

    public function test_internal_deltas_are_hidden_from_chat_but_preserved_in_archive_and_context_load(): void
    {
        $visible = [
            $this->message('user', 'Sveiki!'),
            $this->message('system', 'Normal status note'),
            $this->message('system', 'Legacy empty metadata', []),
            $this->message('system', 'Other event', ['kind' => 'status']),
            $this->message('system', 'Explicit null kind', ['kind' => null]),
            $this->message('assistant', 'Labdien!'),
            // A metadata marker alone must not hide a learner's own message.
            $this->message('user', 'Still a learner message', ['kind' => 'state_delta']),
        ];
        (require database_path('migrations/2026_10_16_000001_create_credit_accounts.php'))->up();
        config(['credits.enabled' => true, 'credits.gateway_secret' => str_repeat('s', 32)]);
        $session = str_repeat('c', 64);
        DB::table('credit_gateway_sessions')->insert([
            'ticket_hash' => hash('sha256', 'conversation-fixture'), 'session_hash' => hash('sha256', $session),
            'user_id' => $this->owner->id, 'ticket_expires_at' => now()->addMinute(),
            'expires_at' => now()->addHour(), 'created_at' => now(),
        ]);
        $metadata = $this->deltaMetadata();
        $text = json_encode(['kind' => 'state_delta', 'changes' => $metadata['changes']], JSON_THROW_ON_ERROR);
        $id = $this->withHeader('X-Credit-Gateway', str_repeat('s', 32))->postJson('/api/internal/credits', [
            'action' => 'context.message', 'session' => $session, 'conversation_id' => $this->conversation->id,
            'role' => 'system', 'text' => $text, 'client_key' => 'context:delta', 'metadata' => $metadata,
        ])->assertOk()->json('message_id');

        $response = $this->actingAs($this->owner)->getJson($this->url())->assertOk()
            ->assertJsonCount(count($visible), 'data.messages')->assertJsonPath('data.pagination.has_more', false);
        $this->assertSame(array_map(fn ($message) => $message->id, $visible), array_column($response->json('data.messages'), 'id'));
        $this->assertStringNotContainsString('/hidden-context-page', $response->getContent());
        $this->assertDatabaseHas('tutor_messages', ['id' => $id, 'original_text' => $text]);
        $loaded = $this->postJson('/api/internal/credits', [
            'action' => 'context.load', 'session' => $session, 'conversation_id' => $this->conversation->id,
        ])->assertOk()->assertJsonCount(count($visible) + 1, 'messages')->json('messages');
        $delta = collect($loaded)->firstWhere('id', $id);
        $this->assertSame('system', $delta['role']);
        $this->assertSame($metadata, $delta['metadata']);
        $this->assertSame($text, $delta['text']);
        $this->assertDatabaseCount('tutor_messages', count($visible) + 1);
    }

    public function test_hidden_deltas_do_not_consume_chat_pages_or_distort_before_id_and_has_more(): void
    {
        $first = $this->message('user', 'First');
        $this->message('system', 'Hidden delta 1', $this->deltaMetadata());
        $second = $this->message('assistant', 'Second');
        $this->message('system', 'Hidden delta 2', $this->deltaMetadata());
        $third = $this->message('system', 'Visible status note', ['kind' => 'status']);
        $this->message('system', 'Hidden delta 3', $this->deltaMetadata());

        $page = $this->actingAs($this->owner)->getJson($this->url().'?limit=2')->assertOk()
            ->assertJsonCount(2, 'data.messages')->assertJsonPath('data.messages.0.id', $second->id)
            ->assertJsonPath('data.messages.1.id', $third->id)->assertJsonPath('data.pagination.has_more', true)
            ->assertJsonPath('data.pagination.before_id', $second->id);
        $this->getJson($this->url().'?limit=2&before_id='.$page->json('data.pagination.before_id'))->assertOk()
            ->assertJsonCount(1, 'data.messages')->assertJsonPath('data.messages.0.id', $first->id)
            ->assertJsonPath('data.pagination.has_more', false)->assertJsonPath('data.pagination.before_id', $first->id);
        $this->assertDatabaseCount('tutor_messages', 6);
    }

    public function test_conversation_with_only_internal_deltas_has_an_empty_chat_page_without_deleting_events(): void
    {
        $this->message('system', 'Hidden delta', $this->deltaMetadata());
        $this->actingAs($this->owner)->getJson($this->url().'?limit=1')->assertOk()
            ->assertJsonCount(0, 'data.messages')->assertJsonPath('data.pagination.has_more', false)
            ->assertJsonPath('data.pagination.before_id', null);
        $this->assertDatabaseCount('tutor_messages', 1);
    }

    public function test_chat_message_filter_preserves_authentication_and_conversation_ownership(): void
    {
        $this->message('user', 'Private conversation text');
        $this->getJson($this->url())->assertUnauthorized();
        $other = User::create(['name' => 'Other', 'email' => 'other-conversation@example.test']);
        $response = $this->actingAs($other)->getJson($this->url())->assertNotFound();
        $this->assertStringNotContainsString('Private conversation text', $response->getContent());
        $this->assertDatabaseCount('tutor_messages', 1);
    }
}
