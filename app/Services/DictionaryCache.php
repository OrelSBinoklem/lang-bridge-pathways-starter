<?php

namespace App\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Str;

class DictionaryCache
{
    public static function invalidate(): void
    {
        Cache::forever('dictionary-api:version', (string) Str::uuid());
    }

    public static function key(string $path, array $query): string
    {
        $version = Cache::get('dictionary-api:version');
        if (! is_string($version)) {
            Cache::add('dictionary-api:version', (string) Str::uuid(), now()->addYears(10));
            $version = Cache::get('dictionary-api:version');
        }
        ksort($query);

        return 'dictionary-api:'.$version.':'.hash('sha256', $path.json_encode($query));
    }
}
