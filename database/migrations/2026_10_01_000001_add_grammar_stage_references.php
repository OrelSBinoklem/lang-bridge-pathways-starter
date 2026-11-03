<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('lesson_blocks', function (Blueprint $table) {
            $table->foreignId('source_block_id')->nullable()->constrained('lesson_blocks')->restrictOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('lesson_blocks', fn (Blueprint $table) => $table->dropConstrainedForeignId('source_block_id'));
    }
};
