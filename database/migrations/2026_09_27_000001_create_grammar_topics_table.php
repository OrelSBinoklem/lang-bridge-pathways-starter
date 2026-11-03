<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('grammar_topics', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lesson_page_id')->unique()->constrained('lesson_pages')->cascadeOnDelete();
            $table->text('rule')->nullable();
            $table->json('examples')->nullable();
            $table->json('table_keys')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void { Schema::dropIfExists('grammar_topics'); }
};
