<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class UseFrontendAuthToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->cookie(config('laravel-erd.auth_cookie'));

        if (! $request->bearerToken() && is_string($token) && $token !== '') {
            $request->headers->set('Authorization', 'Bearer '.$token);
        }

        $user = Auth::guard('sanctum')->user();
        abort_unless($user, 401);
        abort_unless($user->hasAnyRole(['super_admin', 'admin']), 403);
        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
