<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('course_exams', function (Blueprint $table) {
            $table->id();
            $table->string('level', 2);
            $table->string('learn_lang', 8)->default('lv');
            $table->string('title');
            $table->boolean('is_published')->default(false);
            $table->timestamps();
            $table->unique(['level', 'learn_lang']);
        });
        Schema::create('exam_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('course_exam_id')->constrained()->restrictOnDelete();
            $table->unsignedSmallInteger('position');
            $table->string('title');
            $table->json('content');
            $table->boolean('is_published')->default(false);
            $table->timestamps();
            $table->unique(['course_exam_id', 'position']);
        });
        Schema::create('exam_attempts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('course_exam_id')->constrained()->restrictOnDelete();
            $table->foreignId('exam_variant_id')->constrained()->restrictOnDelete();
            $table->string('student_name');
            $table->json('snapshot');
            $table->json('answers');
            $table->json('playbacks');
            $table->json('results')->nullable();
            $table->string('status', 24)->default('running');
            $table->unsignedTinyInteger('section_index')->default(0);
            $table->timestamp('started_at');
            $table->timestamp('deadline_at');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('next_attempt_at')->nullable();
            $table->unsignedSmallInteger('cooldown_hours')->default(20);
            $table->boolean('retain_audio')->default(false);
            $table->decimal('score', 6, 2)->nullable();
            $table->boolean('passed')->nullable();
            $table->timestamp('grading_started_at')->nullable();
            $table->string('grading_error')->nullable();
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'course_exam_id', 'status']);
        });
        Schema::create('exam_recordings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_attempt_id')->constrained()->cascadeOnDelete();
            $table->string('question_id');
            $table->string('path');
            $table->timestamp('expires_at')->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('exam_recordings');
        Schema::dropIfExists('exam_attempts');
        Schema::dropIfExists('exam_variants');
        Schema::dropIfExists('course_exams');
    }
};
