<?php

namespace App\Http\Middleware;

use App\Services\DictionaryCache;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Symfony\Component\HttpFoundation\Response;
use Symfony\Component\HttpFoundation\AcceptHeader;

class CacheDictionaryResponse
{
    public function handle(Request $request, Closure $next): Response
    {
        $accepted = AcceptHeader::fromString($request->header('Accept-Encoding', ''));
        $gzip = $accepted->get('gzip') ?? $accepted->get('*');
        $compressed = $gzip && $gzip->getQuality() > 0;
        $base = DictionaryCache::key($request->path(), $request->only(['learn_lang', 'category_id'])).':split-v2';
        $key = $base.($compressed ? ':gzip' : ':json');
        $cached = Cache::get($key);
        if (is_string($cached)) {
            return $this->respond($compressed, $cached);
        }

        // Double-check under a lock so simultaneous misses only build the list once.
        return Cache::lock($base.':lock', 60)->block(10, function () use ($base, $key, $compressed, $request, $next) {
            $cached = Cache::get($key);
            if (is_string($cached)) {
                return $this->respond($compressed, $cached);
            }
            $response = $next($request);
            if ($response->getStatusCode() === 200) {
                $json = $response->getContent();
                $gzip = gzencode($json, 6);
                // The database cache store uses a UTF-8 text column, not a binary blob.
                $expires = now()->addHour();
                Cache::put($base.':json', $json, $expires);
                if ($gzip !== false) {
                    $encoded = base64_encode($gzip);
                    Cache::put($base.':gzip', $encoded, $expires);
                    return $this->respond($compressed, $compressed ? $encoded : $json);
                }
                return $this->respond(false, $json);
            }

            return $response;
        });
    }

    private function respond(bool $compressed, string $cached): Response
    {
        $headers = ['Content-Type' => 'application/json', 'Vary' => 'Accept-Encoding'];
        if ($compressed) {
            $headers['Content-Encoding'] = 'gzip';
        }

        return response($compressed ? base64_decode($cached) : $cached, 200, $headers);
    }
}
