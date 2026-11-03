<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tutor_daily_summaries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->date('summary_date');
            $table->text('summary');
            $table->unsignedInteger('messages_count')->default(0);
            $table->foreignId('first_message_id')->nullable()->constrained('tutor_messages')->nullOnDelete();
            $table->foreignId('last_message_id')->nullable()->constrained('tutor_messages')->nullOnDelete();
            $table->string('model', 120)->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'summary_date']);
            $table->index(['user_id', 'summary_date']);
            $table->index(['user_id', 'updated_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tutor_daily_summaries');
    }
};
