<?php

return [
    'uri' => env('LARAVEL_ERD_URI', 'erd'),
    'storage_path' => storage_path('framework/cache/laravel-erd'),
    'extension' => env('LARAVEL_ERD_EXTENSION', 'sql'),
    'auth_cookie' => env('AUTH_COOKIE_NAME', 'lbpw_token'),
    'middleware' => [\App\Http\Middleware\UseFrontendAuthToken::class],
    'binary' => [
        'erd-go' => env('LARAVEL_ERD_GO', '/usr/local/bin/erd-go'),
        'dot' => env('LARAVEL_ERD_DOT', '/usr/local/bin/dot'),
    ],
    /*
    |--------------------------------------------------------------------------
    | Connection Overrides
    |--------------------------------------------------------------------------
    |
    | Override specific database connections used during ERD generation.
    | Each key should match a connection name from database.connections.
    | Connections not listed here default to an in-memory SQLite database.
    |
    */
    'connections' => [],
];
