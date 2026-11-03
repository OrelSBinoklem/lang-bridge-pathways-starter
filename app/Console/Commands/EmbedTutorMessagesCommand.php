<?php

namespace App\Console\Commands;

use App\Models\TutorMessage;
use App\Services\Tutor\OpenAiEmbeddingService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Schema;

class EmbedTutorMessagesCommand extends Command
{
    protected $signature = 'tutor:embed-messages
        {--limit=100 : Max messages to embed in this run}
        {--user= : Optional user id}
        {--force : Rebuild existing embeddings}';

    protected $description = 'Create OpenAI embeddings for tutor chat messages.';

    public function handle(OpenAiEmbeddingService $embeddings): int
    {
        if (! Schema::hasTable('tutor_message_embeddings')) {
            $this->error('Table tutor_message_embeddings is missing. Run migrations first.');

            return self::FAILURE;
        }

        $limit = max(1, min(5000, (int) $this->option('limit')));

        $query = TutorMessage::query()
            ->whereIn('role', ['user', 'assistant'])
            ->whereNotNull('original_text')
            ->oldest('id')
            ->limit($limit);

        if (! $this->option('force')) {
            $query->doesntHave('embedding');
        }

        if ($this->option('user')) {
            $query->where('user_id', (int) $this->option('user'));
        }

        $created = 0;
        $skipped = 0;
        $failed = 0;

        foreach ($query->get() as $message) {
            $result = $embeddings->embedTutorMessage($message);
            if ($result['ok'] && empty($result['skipped'])) {
                $created++;
                $this->line("embedded message {$message->id}");
                continue;
            }

            if ($result['ok']) {
                $skipped++;
                continue;
            }

            $failed++;
            $this->warn("failed message {$message->id}: ".($result['error'] ?? 'unknown error'));
        }

        $this->info("Done. embedded={$created}, skipped={$skipped}, failed={$failed}");

        return $failed > 0 ? self::FAILURE : self::SUCCESS;
    }
}
