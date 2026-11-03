<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\{DB, Schema};

return new class extends Migration {
    public function up(): void
    {
        Schema::create('course_subscriptions', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->restrictOnDelete();
            $table->timestamp('paid_until')->nullable();
            $table->timestamps();
        });
        DB::table('app_settings')->insertOrIgnore(['key' => 'course_access_launch_at', 'value' => now('UTC')->toDateTimeString(), 'created_at' => now(), 'updated_at' => now()]);
    }

    public function down(): void
    {
        Schema::dropIfExists('course_subscriptions');
        // Keep the original launch date: rolling back must not restart everyone's trial.
    }
};
