<?php

return [
    'enabled' => env('CREDITS_ENABLED', false),
    'gateway_secret' => env('CREDITS_GATEWAY_SECRET', ''),
    'diagnostics_enabled' => env('TUTOR_DIAGNOSTICS_ENABLED', true),
    // USD per million tokens, expressed as integer nano-USD per token.
    'rates' => [
        'gpt-5.4' => [2500, 250, 15000],
        'gpt-5.4-mini' => [750, 75, 4500],
        'gpt-5.4-nano' => [200, 20, 1250],
        'gpt-5.5' => [5000, 500, 30000],
        'gpt-6.1-sol' => [2000, 100, 10000, 2500],
        'gpt-6.1-terra' => [1000, 50, 5000, 1250],
        'gpt-6-sol' => [2000, 200, 10000, 2500],
        'gpt-6-luna' => [100, 10, 500, 125],
        'gpt-5.6-sol' => [4000, 400, 20000, 5000],
        'gpt-5.6-terra' => [2000, 200, 12000],
        'gpt-5.6-luna' => [200, 20, 1200],
        'gpt-4.1' => [2000, 500, 8000],
        'gpt-4.1-mini' => [400, 100, 1600],
        'gpt-4.1-nano' => [100, 25, 400],
        'o4-mini' => [1100, 275, 4400],
        'o3' => [2000, 500, 8000],
        'text-embedding-3-small' => [20, 20, 0],
        'text-embedding-3-large' => [130, 130, 0],
        'gpt-4o-mini-tts' => [600, 600, 12000],
        'gpt-4o-mini-tts-2025-12-15' => [600, 600, 12000],
        'gpt-4o-transcribe' => [2500, 2500, 10000, 2500, 6000],
        'gpt-4o-mini-transcribe' => [1250, 1250, 5000, 1250, 3000],
        // List rates. CreditPricing applies the owner-approved 50% promotion through 2026-12-31 UTC.
        // Recheck the official Google pricing page when the promotion or published price changes.
        'gemini-3.8-flash-tts' => [1000, 1000, 18000],
        'gemini-3.8-flash-lite-tts' => [1000, 1000, 12000],
        'gpt-transcribe' => ['second_micros' => 75],
        'whisper-1' => ['second_micros' => 100],
        'tts-1' => ['character_micros' => 15],
        'tts-1-hd' => ['character_micros' => 30],
    ],
];
