<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('tutor_difficult_words', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('word');
            $table->string('lemma')->nullable();
            $table->string('language', 10)->default('lv');
            $table->string('translation_ru')->nullable();
            $table->string('status', 30)->default('difficult');
            $table->unsignedTinyInteger('difficulty')->default(3);
            $table->unsignedTinyInteger('confidence')->nullable();
            $table->json('examples')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->unique(['user_id', 'word', 'language']);
            $table->index(['user_id', 'status']);
            $table->index(['user_id', 'last_seen_at']);
        });

        Schema::create('tutor_progress_estimates', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('cefr_level', 2);
            $table->unsignedTinyInteger('confidence')->nullable();
            $table->text('summary')->nullable();
            $table->json('evidence')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['user_id', 'cefr_level']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('tutor_progress_estimates');
        Schema::dropIfExists('tutor_difficult_words');
    }
};
