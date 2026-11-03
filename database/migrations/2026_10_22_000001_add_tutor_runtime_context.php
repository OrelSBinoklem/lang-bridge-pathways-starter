<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tutor_conversations', function (Blueprint $table) {
            $table->json('runtime_context')->nullable();
            $table->unsignedBigInteger('context_revision')->default(0);
        });
        Schema::table('tutor_messages', function (Blueprint $table) {
            $table->string('client_key', 120)->nullable();
            $table->unique(['tutor_conversation_id', 'client_key'], 'tutor_message_client_key_unique');
        });
    }

    public function down(): void
    {
        Schema::table('tutor_messages', function (Blueprint $table) {
            $table->dropUnique('tutor_message_client_key_unique');
            $table->dropColumn('client_key');
        });
        Schema::table('tutor_conversations', fn (Blueprint $table) => $table->dropColumn(['runtime_context', 'context_revision']));
    }
};
