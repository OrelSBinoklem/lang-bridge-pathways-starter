<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('credit_accounts', function (Blueprint $table) {
            $table->foreignId('user_id')->primary()->constrained()->restrictOnDelete();
            $table->bigInteger('balance_micros')->default(0);
            $table->bigInteger('reserved_micros')->default(0);
            $table->timestamps();
        });
        Schema::create('credit_operations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->string('reference', 160)->unique();
            $table->string('kind', 30);
            $table->string('model', 100)->nullable();
            $table->string('status', 30);
            $table->unsignedInteger('commission_bps')->default(0);
            $table->bigInteger('reserved_micros')->default(0);
            $table->bigInteger('cost_micros')->nullable();
            $table->bigInteger('amount_micros')->default(0);
            $table->bigInteger('balance_after_micros')->nullable();
            $table->json('pricing')->nullable();
            $table->json('usage')->nullable();
            $table->timestamps();
            $table->index(['user_id', 'created_at']);
        });
        Schema::create('credit_gateway_sessions', function (Blueprint $table) {
            $table->string('ticket_hash', 64)->primary();
            $table->string('session_hash', 64)->nullable()->unique();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->unsignedBigInteger('access_token_id')->nullable();
            $table->timestamp('ticket_expires_at');
            $table->timestamp('expires_at');
            $table->timestamp('created_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credit_gateway_sessions');
        Schema::dropIfExists('credit_operations');
        Schema::dropIfExists('credit_accounts');
    }
};
