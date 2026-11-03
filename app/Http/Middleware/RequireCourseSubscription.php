<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class RequireCourseSubscription
{
    public function handle(Request $request, Closure $next)
    {
        // Keep the existing account boundary before shared dictionary caching.
        // The legacy setting no longer enables subscriptions or paid access.
        $protected = $request->is('api/dictionaries/*', 'api/course', 'api/lessons/*', 'api/grammar-topics', 'api/training/*',
            'api/tutor/*')
            || ($request->is('api/exams/*/start', 'api/exam-attempts/*') && !$request->isMethod('GET') && !$request->isMethod('HEAD'));
        if (!config('subscriptions.enabled') || !$protected) return $next($request);
        if ($request->is('api/tutor/presets') && $request->isMethod('GET')) return $next($request);
        $user = Auth::guard('sanctum')->user();
        if (!$user) return response()->json(['message' => 'Войдите, чтобы заниматься бесплатно.', 'code' => 'unauthenticated'], 401)->header('Cache-Control', 'private, no-store');
        return $next($request)->header('Cache-Control', 'private, no-store');
    }
}
