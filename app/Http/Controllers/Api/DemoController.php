<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Http\Resources\ProductResource;
use App\Jobs\ProcessDemoReport;
use App\Models\Category;
use App\Models\Post;
use App\Models\Product;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

class DemoController extends Controller
{
    public function dashboard(Request $request): JsonResponse
    {
        $latestProducts = Product::query()
            ->with('category')
            ->latest()
            ->limit(6)
            ->get();

        $latestPosts = Post::query()
            ->with('user')
            ->where('status', 'published')
            ->latest('published_at')
            ->limit(5)
            ->get();

        return response()->json([
            'user' => $request->user(),
            'stats' => [
                'users' => User::query()->count(),
                'categories' => Category::query()->count(),
                'products' => Product::query()->count(),
                'published_products' => Product::query()->where('published', true)->count(),
                'posts' => Post::query()->count(),
                'published_posts' => Post::query()->where('status', 'published')->count(),
            ],
            'latest_products' => ProductResource::collection($latestProducts)->resolve(),
            'latest_posts' => PostResource::collection($latestPosts)->resolve(),
            'queue' => [
                'connection' => config('queue.default'),
                'pending_jobs' => DB::table('jobs')->count(),
                'failed_jobs' => DB::table('failed_jobs')->count(),
                'last_result' => Cache::get('demo:last_queue_result'),
            ],
        ]);
    }

    public function queuePing(Request $request): JsonResponse
    {
        $message = $request->validate([
            'message' => ['nullable', 'string', 'max:255'],
        ])['message'] ?? 'Demo queue ping';

        ProcessDemoReport::dispatch(
            $request->user()->email,
            $message,
        );

        return response()->json([
            'message' => 'Job queued',
            'queue' => [
                'connection' => config('queue.default'),
                'pending_jobs' => DB::table('jobs')->count(),
                'last_result' => Cache::get('demo:last_queue_result'),
            ],
        ], 202);
    }

    public function queueStatus(): JsonResponse
    {
        return response()->json([
            'connection' => config('queue.default'),
            'pending_jobs' => DB::table('jobs')->count(),
            'failed_jobs' => DB::table('failed_jobs')->count(),
            'last_result' => Cache::get('demo:last_queue_result'),
        ]);
    }
}
