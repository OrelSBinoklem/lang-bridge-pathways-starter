<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Post;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PostController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        $posts = Post::query()
            ->with(['user', 'media'])
            ->where('status', 'published')
            ->latest('published_at')
            ->paginate(10);

        return PostResource::collection($posts);
    }

    public function show(Post $post): PostResource
    {
        $post->load(['user', 'media']);

        return PostResource::make($post);
    }
}
