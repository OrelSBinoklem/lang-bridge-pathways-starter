<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tutor_flow_versions', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->json('graph');
            // Keep the audit identity even if the administrator is later removed.
            // No users-table dependency: this migration also works on a fresh DB.
            $table->unsignedBigInteger('created_by');
            $table->timestamp('created_at');
        });

        Schema::create('tutor_flow_state', function (Blueprint $table) {
            $table->unsignedTinyInteger('id')->primary();
            $table->foreignId('head_version_id')->nullable()->constrained('tutor_flow_versions');
            $table->foreignId('active_version_id')->nullable()->constrained('tutor_flow_versions');
        });

        // Seed once in the migration, never lazily during a concurrent first save.
        DB::table('tutor_flow_state')->insert(['id' => 1, 'head_version_id' => null, 'active_version_id' => null]);
    }

    public function down(): void
    {
        Schema::dropIfExists('tutor_flow_state');
        Schema::dropIfExists('tutor_flow_versions');
    }
};
