<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration {
    public function up(): void
    {
        DB::table('lesson_pages')
            ->where('slug', 'grammar-a1-alphabet')
            ->where('description', 'Буквы, группы звуков и особенности чтения o.')
            ->update(['description' => null]);
    }

    public function down(): void
    {
        // Restore nothing: an administrator may have changed the description since migration.
    }
};
