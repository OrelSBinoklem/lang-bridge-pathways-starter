<?php

return [
    'capture' => env('AI_STUDIO_CAPTURE', true),
    'capture_in_tests' => false,
    'capture_url' => env('AI_STUDIO_CAPTURE_URL', 'http://127.0.0.1:8788/internal/debug/capture'),
];
