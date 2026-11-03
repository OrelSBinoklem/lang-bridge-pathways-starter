<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('lesson_block_progress', function (Blueprint $table) {
            $table->json('assisted_variant_ids')->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('lesson_block_progress', function (Blueprint $table) {
            $table->dropColumn('assisted_variant_ids');
        });
    }
};
