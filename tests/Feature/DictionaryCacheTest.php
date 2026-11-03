<?php

namespace Tests\Feature;

use App\Http\Middleware\CacheDictionaryResponse;
use App\Services\DictionaryCache;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class DictionaryCacheTest extends TestCase
{
    public function test_gzip_and_plain_clients_share_the_same_cached_payload(): void
    {
        Cache::flush();
        $calls = 0;
        $next = function () use (&$calls) {
            ++$calls;
            return response()->json(['word' => str_repeat('translation ', 500)]);
        };
        $middleware = new CacheDictionaryResponse;
        $request = Request::create('/api/dictionaries/20/words');
        $plain = $middleware->handle($request, $next);
        $request->headers->set('Accept-Encoding', 'gzip, br');
        $gzip = $middleware->handle($request, $next);
        $this->assertSame('gzip', $gzip->headers->get('Content-Encoding'));
        $this->assertSame($plain->getContent(), gzdecode($gzip->getContent()));
        $this->assertSame('Accept-Encoding', $gzip->headers->get('Vary'));
        $this->assertLessThan(strlen($plain->getContent()), strlen($gzip->getContent()));
        $request->headers->set('Accept-Encoding', 'gzip;q=0, *;q=1');
        $disabled = $middleware->handle($request, $next);
        $this->assertNull($disabled->headers->get('Content-Encoding'));
        $this->assertSame($plain->getContent(), $disabled->getContent());
        $this->assertSame(1, $calls);
    }

    public function test_response_is_reused_and_expires_after_an_hour(): void
    {
        Cache::flush();
        $calls = 0;
        $next = function () use (&$calls) { return response()->json(['calls' => ++$calls]); };
        $middleware = new CacheDictionaryResponse;
        $request = Request::create('/api/dictionaries/1/words');
        $middleware->handle($request, $next);
        $middleware->handle($request, $next);
        $this->assertSame(1, $calls);
        $this->travel(61)->minutes();
        $middleware->handle($request, $next);
        $this->assertSame(2, $calls);
        $this->travelBack();
        DictionaryCache::invalidate();
        $middleware->handle($request, $next);
        $this->assertSame(3, $calls);
    }

    public function test_bulk_pivot_changes_invalidate_only_after_commit(): void
    {
        Schema::create('dictionary_word_category', function ($table) {
            $table->integer('word_id');
            $table->integer('category_id');
        });
        $before = DictionaryCache::key('words', []);
        DB::beginTransaction();
        DB::table('dictionary_word_category')->insert(['word_id' => 1, 'category_id' => 2]);
        $this->assertSame($before, DictionaryCache::key('words', []));
        DB::rollBack();
        $this->assertSame($before, DictionaryCache::key('words', []));
        DB::transaction(fn () => DB::table('dictionary_word_category')->insert(['word_id' => 1, 'category_id' => 2]));
        $this->assertNotSame($before, DictionaryCache::key('words', []));
        Schema::drop('dictionary_word_category');
    }
}
