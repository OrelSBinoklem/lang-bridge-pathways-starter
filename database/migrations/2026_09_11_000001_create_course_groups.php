<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('course_groups', function (Blueprint $table) {
            $table->id();
            $table->string('title')->nullable();
            $table->string('level', 2)->index();
            $table->string('learn_lang', 10)->default('lv')->index();
            $table->foreignId('dictionary_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('category_id')->nullable()->constrained('dictionary_categories')->nullOnDelete();
            $table->string('seed_key')->nullable()->unique();
            $table->unsignedInteger('position')->default(0);
            $table->boolean('is_published')->default(true);
            $table->timestamps();
        });
        Schema::table('course_steps', function (Blueprint $table) {
            $table->foreignId('group_id')->nullable()->constrained('course_groups')->nullOnDelete();
            $table->boolean('group_seeded')->default(false);
        });
    }
    public function down(): void
    {
        Schema::table('course_steps', fn (Blueprint $table) => $table->dropConstrainedForeignId('group_id'));
        Schema::table('course_steps', fn (Blueprint $table) => $table->dropColumn('group_seeded'));
        Schema::dropIfExists('course_groups');
    }
};
