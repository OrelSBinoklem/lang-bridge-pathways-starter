<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/** @mixin \App\Models\Post */
class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'title' => $this->title,
            'slug' => $this->slug,
            'excerpt' => $this->excerpt,
            'body' => $this->when($request->routeIs('api.posts.show'), $this->body),
            'status' => $this->status,
            'published_at' => $this->published_at?->toIso8601String(),
            'author' => [
                'id' => $this->user?->id,
                'name' => $this->user?->name,
            ],
            'cover_url' => $this->getFirstMediaUrl('cover') ?: null,
        ];
    }
}
