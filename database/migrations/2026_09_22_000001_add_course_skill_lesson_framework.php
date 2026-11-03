<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('lesson_pages', function (Blueprint $table) {
            $table->foreignId('course_group_id')->nullable()->after('id')->constrained('course_groups')->nullOnDelete()->index();
            $table->string('skill', 20)->nullable()->after('learn_lang')->index();
            $table->string('status', 20)->default('draft')->after('description')->index();
            $table->string('seed_key')->nullable()->after('slug')->unique();
        });

        Schema::table('lesson_blocks', function (Blueprint $table) {
            $table->boolean('is_required')->default(true)->after('title');
            $table->unsignedSmallInteger('weight')->default(100)->after('is_required');
            $table->text('bot_prompt')->nullable()->after('config');
            $table->string('seed_key')->nullable()->after('bot_prompt');
            $table->unique(['lesson_page_id', 'seed_key']);
        });

        Schema::create('lesson_block_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lesson_block_id')->constrained('lesson_blocks')->cascadeOnDelete();
            $table->string('title')->nullable();
            $table->string('seed_key')->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->json('config')->nullable();
            $table->boolean('is_published')->default(true);
            $table->timestamps();
            $table->unique(['lesson_block_id', 'position']);
            $table->unique(['lesson_block_id', 'seed_key']);
        });

        Schema::create('lesson_block_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lesson_block_id')->constrained('lesson_blocks')->cascadeOnDelete();
            $table->unsignedTinyInteger('best_score')->nullable();
            $table->string('best_rank', 20)->nullable();
            $table->unsignedTinyInteger('cooldown_tier')->default(0);
            $table->timestamp('last_scored_at')->nullable();
            $table->timestamp('next_scored_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'lesson_block_id']);
        });

        Schema::create('lesson_block_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lesson_block_id')->constrained('lesson_blocks')->cascadeOnDelete();
            $table->foreignId('lesson_block_variant_id')->nullable()->constrained('lesson_block_variants')->nullOnDelete();
            $table->json('answer');
            $table->json('feedback')->nullable();
            $table->unsignedTinyInteger('score');
            $table->string('rank', 20)->nullable();
            $table->boolean('is_practice')->default(false);
            $table->unsignedTinyInteger('cooldown_tier')->default(0);
            $table->timestamp('scored_at');
            $table->timestamps();
            $table->index(['user_id', 'lesson_block_id', 'is_practice']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lesson_block_attempts');
        Schema::dropIfExists('lesson_block_progress');
        Schema::dropIfExists('lesson_block_variants');

        Schema::table('lesson_blocks', function (Blueprint $table) {
            $table->dropUnique(['lesson_page_id', 'seed_key']);
            $table->dropColumn(['is_required', 'weight', 'bot_prompt', 'seed_key']);
        });

        Schema::table('lesson_pages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('course_group_id');
            $table->dropUnique(['seed_key']);
            $table->dropColumn(['skill', 'status', 'seed_key']);
        });
    }
};
