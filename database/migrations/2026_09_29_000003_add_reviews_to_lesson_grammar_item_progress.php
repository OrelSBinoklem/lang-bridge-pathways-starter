<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('lesson_grammar_item_progress', function (Blueprint $table) {
            $table->unsignedTinyInteger('direct_correct_attempts')->default(0);
            $table->unsignedTinyInteger('reverse_correct_attempts')->default(0);
            $table->boolean('direct_mode_education')->default(false);
            $table->boolean('reverse_mode_education')->default(false);
            $table->timestamp('direct_next_review_at')->nullable();
            $table->timestamp('reverse_next_review_at')->nullable();
        });

        // Earlier one-answer completions remain completed when switching to two reviews.
        DB::table('lesson_grammar_item_progress')->update([
            'direct_correct_attempts' => DB::raw('CASE WHEN direct_correct = 1 THEN 2 ELSE 0 END'),
            'reverse_correct_attempts' => DB::raw('CASE WHEN reverse_correct = 1 THEN 2 ELSE 0 END'),
        ]);
    }

    public function down(): void
    {
        Schema::table('lesson_grammar_item_progress', function (Blueprint $table) {
            $table->dropColumn([
                'direct_correct_attempts', 'reverse_correct_attempts',
                'direct_mode_education', 'reverse_mode_education',
                'direct_next_review_at', 'reverse_next_review_at',
            ]);
        });
    }
};
