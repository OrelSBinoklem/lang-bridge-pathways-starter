<?php

namespace App\Jobs;

use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class ProcessDemoReport implements ShouldQueue
{
    use Queueable;

    public function __construct(
        public string $requestedBy,
        public string $message = 'Demo queue ping',
    ) {}

    public function handle(): void
    {
        $payload = [
            'requested_by' => $this->requestedBy,
            'message' => $this->message,
            'processed_at' => now()->toIso8601String(),
        ];

        Cache::put('demo:last_queue_result', $payload, now()->addDay());

        Log::info('ProcessDemoReport completed', $payload);
    }
}
