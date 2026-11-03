<?php

$allowAllOrigins = filter_var(env('CORS_ALLOW_ALL', false), FILTER_VALIDATE_BOOL);

return [

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $allowAllOrigins
        ? ['*']
        : array_values(array_filter(array_unique([
            env('FRONTEND_URL', 'http://localhost:3000'),
            'http://localhost:3000',
            'http://127.0.0.1:3000',
            'http://app.lbpw.loc',
            'http://www.app.lbpw.loc',
        ]))),

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    // A wildcard origin and credentials are mutually exclusive in browser CORS.
    'supports_credentials' => !$allowAllOrigins,

];
