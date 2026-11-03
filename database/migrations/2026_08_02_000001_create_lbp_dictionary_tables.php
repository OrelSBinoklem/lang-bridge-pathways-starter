<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('dictionaries', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('lang', 10);
            $table->string('learn_lang', 10)->index();
            $table->unsignedInteger('words')->default(0);
            $table->unsignedInteger('level')->default(1);
            $table->unsignedInteger('max_level')->default(1);
            $table->boolean('sound')->default(false);
            $table->timestamps();
        });

        Schema::create('dictionary_categories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dictionary_id')->constrained('dictionaries')->cascadeOnDelete();
            $table->string('name');
            $table->foreignId('parent_id')->nullable()->constrained('dictionary_categories')->nullOnDelete();
            $table->unsignedInteger('order')->default(0);
            $table->timestamps();

            $table->index(['dictionary_id', 'parent_id']);
        });

        Schema::create('dictionary_words', function (Blueprint $table) {
            $table->id();
            $table->foreignId('dictionary_id')->constrained('dictionaries')->cascadeOnDelete();
            $table->string('word');
            $table->string('learn_lang', 10);
            $table->boolean('is_phrase')->default(false);
            $table->string('translation_1');
            $table->string('translation_2')->nullable();
            $table->string('translation_3')->nullable();
            $table->text('translation_input_variable')->nullable();
            $table->string('difficult_translation')->nullable();
            $table->text('info')->nullable();
            $table->string('sound_url')->nullable();
            $table->unsignedTinyInteger('level')->nullable();
            $table->unsignedTinyInteger('max_level')->default(1);
            $table->string('type', 50)->nullable();
            $table->char('gender', 1)->nullable();
            $table->unsignedInteger('order')->default(0);
            $table->timestamps();

            $table->index(['dictionary_id', 'word']);
            $table->index(['dictionary_id', 'order']);
        });

        Schema::create('dictionary_word_category', function (Blueprint $table) {
            $table->foreignId('word_id')->constrained('dictionary_words')->cascadeOnDelete();
            $table->foreignId('category_id')->constrained('dictionary_categories')->cascadeOnDelete();
            $table->primary(['word_id', 'category_id']);
        });

        Schema::create('unique_words', function (Blueprint $table) {
            $table->id();
            $table->string('word');
            $table->string('lang', 10);
            $table->timestamps();

            $table->unique(['word', 'lang']);
        });

        Schema::create('user_dictionary_words', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('dict_word_id')->constrained('dictionary_words')->cascadeOnDelete();
            $table->unsignedInteger('attempts')->default(0);
            $table->unsignedInteger('correct_attempts')->default(0);
            $table->timestamp('last_shown')->nullable();
            $table->timestamp('last_shown_revert')->nullable();
            $table->boolean('easy_education')->default(false);
            $table->boolean('mode_education')->default(false);
            $table->boolean('mode_education_revert')->default(false);
            $table->unsignedTinyInteger('cooldown_tier')->default(0);
            $table->unsignedTinyInteger('cooldown_tier_revert')->default(0);
            $table->unsignedSmallInteger('dense_remaining_direct')->default(0);
            $table->unsignedSmallInteger('dense_remaining_revert')->default(0);
            $table->unsignedInteger('attempts_all')->default(0);
            $table->unsignedInteger('correct_attempts_all')->default(0);
            $table->unsignedInteger('attempts_revert')->default(0);
            $table->unsignedInteger('correct_attempts_revert')->default(0);
            $table->unsignedInteger('statistic_attempts')->default(0);
            $table->unsignedInteger('statistic_attempts_revert')->default(0);
            $table->unsignedInteger('statistic_correct_attempts')->default(0);
            $table->unsignedInteger('statistic_correct_attempts_revert')->default(0);
            $table->boolean('easy_correct')->default(false);
            $table->boolean('easy_correct_revert')->default(false);
            $table->boolean('is_reset')->default(false);
            $table->timestamps();

            $table->unique(['user_id', 'dict_word_id']);
            $table->index(['user_id', 'dict_word_id']);
        });

        Schema::create('dense_training_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->unsignedBigInteger('dictionary_id')->default(0);
            $table->unsignedBigInteger('category_id');
            $table->longText('dense_word_ids_direct')->nullable();
            $table->longText('dense_review_word_ids_direct')->nullable();
            $table->longText('dense_word_ids_revert')->nullable();
            $table->longText('dense_review_word_ids_revert')->nullable();
            $table->unsignedSmallInteger('attempts_left')->default(3);
            $table->timestamp('waiting_since')->nullable();
            $table->boolean('use_random')->default(true);
            $table->timestamps();

            $table->index(['user_id', 'category_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('dense_training_sessions');
        Schema::dropIfExists('user_dictionary_words');
        Schema::dropIfExists('unique_words');
        Schema::dropIfExists('dictionary_word_category');
        Schema::dropIfExists('dictionary_words');
        Schema::dropIfExists('dictionary_categories');
        Schema::dropIfExists('dictionaries');
    }
};
