<?php

namespace App\Console\Commands;

use App\Models\TutorDailySummary;
use App\Models\TutorMessage;
use App\Services\Tutor\OpenAiSummaryService;
use Illuminate\Console\Command;
use Illuminate\Support\Carbon;

class GenerateTutorDailySummariesCommand extends Command
{
    protected $signature = 'tutor:daily-summaries
        {--date= : Only summarize this date, YYYY-MM-DD}
        {--user= : Only summarize this user id}
        {--force : Rebuild even when message count did not change}';

    protected $description = 'Generate per-user daily summaries from stored tutor messages.';

    public function handle(OpenAiSummaryService $summaryService): int
    {
        $query = TutorMessage::query()
            ->whereIn('role', ['user', 'assistant'])
            ->whereNotNull('original_text');

        if ($this->option('user')) {
            $query->where('user_id', (int) $this->option('user'));
        }

        if ($this->option('date')) {
            $date = Carbon::parse((string) $this->option('date'))->toDateString();
            $query->whereDate('created_at', $date);
        }

        $groups = $query
            ->selectRaw('user_id, DATE(created_at) as summary_date, COUNT(*) as messages_count, MIN(id) as first_message_id, MAX(id) as last_message_id')
            ->groupByRaw('user_id, DATE(created_at)')
            ->orderByRaw('DATE(created_at) desc')
            ->get();

        $updated = 0;
        foreach ($groups as $group) {
            $existing = TutorDailySummary::query()
                ->where('user_id', $group->user_id)
                ->whereDate('summary_date', $group->summary_date)
                ->first();

            if (
                $existing
                && ! $this->option('force')
                && (int) $existing->messages_count === (int) $group->messages_count
                && (int) $existing->last_message_id === (int) $group->last_message_id
            ) {
                continue;
            }

            $messages = TutorMessage::query()
                ->where('user_id', $group->user_id)
                ->whereDate('created_at', $group->summary_date)
                ->whereIn('role', ['user', 'assistant'])
                ->oldest('id')
                ->get()
                ->map(fn (TutorMessage $message) => [
                    'role' => $message->role,
                    'text' => (string) $message->original_text,
                    'created_at' => optional($message->created_at)->toDateTimeString(),
                ])
                ->all();

            $result = $summaryService->summarizeDailyMessages($messages, $existing?->summary, null, (int) $group->user_id);
            if (trim((string) $result['summary']) === '') {
                continue;
            }

            TutorDailySummary::query()->updateOrCreate(
                [
                    'user_id' => $group->user_id,
                    'summary_date' => $group->summary_date,
                ],
                [
                    'summary' => $result['summary'],
                    'messages_count' => (int) $group->messages_count,
                    'first_message_id' => $group->first_message_id,
                    'last_message_id' => $group->last_message_id,
                    'model' => $result['model'] ?? null,
                    'metadata' => $result['metadata'] ?? null,
                ],
            );

            $updated += 1;
            $this->line("summarized user {$group->user_id} / {$group->summary_date}");
        }

        $this->info("Daily summaries updated: {$updated}");

        return self::SUCCESS;
    }
}
