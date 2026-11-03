<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('lesson_blocks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('lesson_page_id')->constrained('lesson_pages')->cascadeOnDelete();
            $table->string('type', 20);
            $table->string('title')->nullable();
            $table->unsignedInteger('position')->default(0);
            $table->json('config')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void { Schema::dropIfExists('lesson_blocks'); }
};
