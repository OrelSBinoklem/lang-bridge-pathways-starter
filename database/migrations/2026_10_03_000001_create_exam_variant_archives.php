<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('exam_variant_archives', function (Blueprint $table) {
            $table->id();
            $table->foreignId('exam_variant_id')->constrained()->restrictOnDelete();
            $table->foreignId('course_exam_id')->constrained()->restrictOnDelete();
            $table->string('level', 2);
            $table->string('learn_lang', 8);
            $table->unsignedSmallInteger('position');
            $table->string('title');
            $table->json('content');
            $table->boolean('was_published');
            $table->string('fingerprint', 64);
            $table->string('reason', 500);
            $table->foreignId('archived_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('archived_at');
            $table->unique(['exam_variant_id', 'fingerprint']);
            $table->index(['level', 'position', 'archived_at']);
        });
    }

    public function down(): void { Schema::dropIfExists('exam_variant_archives'); }
};
