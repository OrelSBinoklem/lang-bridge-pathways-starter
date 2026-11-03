<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('course_steps', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('description')->nullable();
            $table->string('level', 2)->index();
            $table->string('kind', 20);
            $table->string('learn_lang', 10)->default('lv')->index();
            $table->foreignId('dictionary_id')->nullable()->constrained('dictionaries')->nullOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('dictionary_categories')->nullOnDelete();
            $table->string('grammar_table_id', 80)->nullable();
            $table->string('seed_key')->nullable()->unique();
            $table->unsignedInteger('position')->default(0);
            $table->boolean('is_published')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void { Schema::dropIfExists('course_steps'); }
};
