<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('lesson_grammar_item_progress', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('lesson_block_id')->constrained('lesson_blocks')->cascadeOnDelete();
            $table->string('item_key', 64);
            $table->boolean('direct_correct')->default(false);
            $table->boolean('reverse_correct')->default(false);
            $table->timestamps();
            $table->unique(['user_id', 'lesson_block_id', 'item_key'], 'grammar_item_user_block_key_unique');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('lesson_grammar_item_progress');
    }
};
