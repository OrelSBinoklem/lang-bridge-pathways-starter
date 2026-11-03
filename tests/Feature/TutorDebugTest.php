<?php

namespace Tests\Feature;

use App\Models\TutorConversation;
use App\Models\User;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class TutorDebugTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('users', function ($table) { $table->id(); $table->string('name'); $table->string('email'); $table->timestamps(); });
        (require database_path('migrations/2026_09_05_000001_create_tutor_conversations_table.php'))->up();
    }

    private function actor(bool $admin): User
    {
        $user = \Mockery::mock(User::class)->makePartial();
        $user->forceFill(['id' => 101, 'name' => 'Admin', 'email' => 'admin@example.test']);
        $user->shouldReceive('isFrontendAdmin')->andReturn($admin);

        return $user;
    }

    public function test_debug_directory_is_admin_only(): void
    {
        $this->getJson('/api/tutor/flows/debug-users')->assertUnauthorized();
        $this->actingAs($this->actor(false))->getJson('/api/tutor/flows/debug-users')->assertForbidden();
    }

    public function test_directory_returns_only_selected_users_conversation_metadata_without_private_context(): void
    {
        $one = User::create(['name' => 'Student One', 'email' => 'one@example.test']);
        $two = User::create(['name' => 'Student Two', 'email' => 'two@example.test']);
        $first = TutorConversation::create(['user_id' => $one->id, 'summary' => 'Private context not returned']);
        TutorConversation::create(['user_id' => $two->id, 'summary' => 'Other private context']);
        $response = $this->actingAs($this->actor(true))->getJson('/api/tutor/flows/debug-users?user_id='.$one->id.'&q=Student');
        $response->assertOk()->assertHeader('Cache-Control', 'no-store, private')->assertJsonCount(2, 'data.users')->assertJsonCount(1, 'data.conversations')->assertJsonPath('data.conversations.0.id', $first->id);
        $this->assertStringNotContainsString('Private context', $response->getContent());
        $this->assertStringNotContainsString('summary', $response->getContent());
        $this->actingAs($this->actor(true))->getJson('/api/tutor/flows/debug-users?q=')->assertOk();
        $this->actingAs($this->actor(true))->getJson('/api/tutor/flows/debug-users?user_id=-1')->assertUnprocessable();
    }
}
