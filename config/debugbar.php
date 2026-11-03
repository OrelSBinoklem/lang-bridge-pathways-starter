<?php

return [
    'enabled' => env('DEBUGBAR_ENABLED', false),

    'except' => [
        'telescope*',
        'horizon*',
        '_boost/browser-logs',
        'livewire-*/livewire.js',
    ],

    'force_allow_enable' => env('DEBUGBAR_FORCE_ALLOW_ENABLE', false),

    'route_middleware' => ['api', 'auth:sanctum', 'role:super_admin|admin'],
];
