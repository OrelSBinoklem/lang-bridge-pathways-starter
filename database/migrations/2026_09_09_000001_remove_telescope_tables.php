<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::dropIfExists('telescope_entries_tags');
        Schema::dropIfExists('telescope_entries');
        Schema::dropIfExists('telescope_monitoring');
    }

    public function down(): void
    {
        // Rollback recreates the schema only; deleted diagnostic history is not recoverable.
        $migration = require __DIR__.'/2026_09_08_170533_create_telescope_entries_table.php';
        $migration->up();
    }
};
