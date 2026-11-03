<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\{DB, Schema};
use Tests\TestCase;

class AiWorkflowStorageTest extends TestCase
{
    public function test_storage_expansion_preserves_settings_and_refuses_a_lossy_rollback(): void
    {
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('app_settings', function ($table) {
            $table->string('key')->primary(); $table->string('value'); $table->timestamps();
        });
        DB::table('app_settings')->insert(['key' => 'credits_commission_percent', 'value' => '50']);
        $migration = require database_path('migrations/2026_10_29_000001_expand_app_settings_for_ai_workflows.php');
        $migration->up();
        $this->assertSame('text', Schema::getColumnType('app_settings', 'value'));
        $this->assertSame('50', DB::table('app_settings')->where('key', 'credits_commission_percent')->value('value'));
        $history = json_encode(['versions' => [['graph' => str_repeat('node ', 30000)]]]);
        DB::table('app_settings')->insert(['key' => 'ai_workflow_exams', 'value' => $history]);
        try { $migration->down(); $this->fail('A lossy rollback must not run.'); }
        catch (\RuntimeException $error) { $this->assertStringContainsString('Cannot shrink settings', $error->getMessage()); }
        $this->assertSame($history, DB::table('app_settings')->where('key', 'ai_workflow_exams')->value('value'));
    }
}
