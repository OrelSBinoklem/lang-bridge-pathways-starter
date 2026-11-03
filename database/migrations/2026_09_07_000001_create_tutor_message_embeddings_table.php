<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $connection = Schema::getConnection()->getDriverName();
        $hasPgVector = false;

        if ($connection === 'pgsql') {
            try {
                DB::statement('CREATE EXTENSION IF NOT EXISTS vector');
                $hasPgVector = true;
            } catch (Throwable) {
                $hasPgVector = false;
            }
        }

        Schema::create('tutor_message_embeddings', function (Blueprint $table) use ($hasPgVector) {
            $table->id();
            $table->foreignId('tutor_message_id')->unique()->constrained('tutor_messages')->cascadeOnDelete();
            $table->foreignId('tutor_conversation_id')->constrained('tutor_conversations')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->longText('content');
            $table->string('model', 80);
            $table->unsignedSmallInteger('dimensions')->default(1536);
            if (! $hasPgVector) {
                $table->json('embedding_json')->nullable();
            }
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
            $table->index(['tutor_conversation_id', 'created_at']);
            $table->index(['model', 'dimensions']);
        });

        if ($hasPgVector) {
            DB::statement('ALTER TABLE tutor_message_embeddings ADD COLUMN embedding vector(1536)');
            DB::statement(
                'CREATE INDEX tutor_message_embeddings_embedding_idx ON tutor_message_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)'
            );
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('tutor_message_embeddings');
    }
};
