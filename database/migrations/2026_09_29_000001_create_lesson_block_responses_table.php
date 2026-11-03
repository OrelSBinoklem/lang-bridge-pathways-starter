<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('lesson_block_responses', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lesson_block_id')->constrained('lesson_blocks')->cascadeOnDelete();
            $table->foreignId('lesson_block_variant_id')->nullable()->constrained('lesson_block_variants')->nullOnDelete();
            $table->text('answer_text')->nullable();
            $table->string('status', 20)->default('submitted');
            $table->text('feedback')->nullable();
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'lesson_block_id', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lesson_block_responses');
    }
};
