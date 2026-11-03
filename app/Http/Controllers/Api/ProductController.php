<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ProductResource;
use App\Models\Product;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class ProductController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $includes = collect(explode(',', (string) $request->query('include', '')))
            ->map(fn (string $value) => trim($value))
            ->filter()
            ->all();

        $with = array_values(array_intersect($includes, ['category', 'media']));

        $search = trim((string) $request->query('q', ''));

        if ($search !== '') {
            $products = Product::search($search)
                ->query(fn ($query) => $query->with($with)->where('published', true))
                ->paginate(12);
        } else {
            $products = Product::query()
                ->with($with)
                ->when($request->boolean('published_only', true), fn ($q) => $q->where('published', true))
                ->latest()
                ->paginate(12);
        }

        return ProductResource::collection($products);
    }

    public function show(Product $product): ProductResource
    {
        $product->load(['category', 'media']);

        return ProductResource::make($product);
    }
}
