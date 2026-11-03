<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void { Schema::table('exam_attempts', fn (Blueprint $t) => $t->unsignedTinyInteger('grading_tries')->default(0)); }
    public function down(): void { Schema::table('exam_attempts', fn (Blueprint $t) => $t->dropColumn('grading_tries')); }
};
