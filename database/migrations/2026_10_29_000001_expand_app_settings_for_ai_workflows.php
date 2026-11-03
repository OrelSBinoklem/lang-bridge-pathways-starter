<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration
{
    public function up(): void
    {
        // A workflow holds up to 20 bounded versions plus its active rollback target.
        // MEDIUMTEXT fits that history while preserving all existing setting values.
        Schema::table('app_settings', function (Blueprint $table) {
            $table->mediumText('value')->change();
        });
    }

    public function down(): void
    {
        if (DB::table('app_settings')->whereRaw('length(value) > 255')->exists()) {
            throw new RuntimeException('Cannot shrink settings: existing values exceed 255 bytes. Preserve the workflow history.');
        }
        Schema::table('app_settings', function (Blueprint $table) {
            $table->string('value', 255)->change();
        });
    }
};
