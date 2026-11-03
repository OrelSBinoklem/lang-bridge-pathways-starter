<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\CourseSubscription;
use Illuminate\Http\Request;

class SubscriptionController extends Controller
{
    public function show(Request $request, CourseSubscription $subscriptions)
    {
        return response()->json(['data' => $subscriptions->status($request->user())])->header('Cache-Control', 'private, no-store');
    }

    public function purchase(Request $request, CourseSubscription $subscriptions)
    {
        $data = $request->validate(['request_id' => 'required|uuid']);
        return response()->json(['data' => $subscriptions->purchase($request->user(), $data['request_id'])])->header('Cache-Control', 'private, no-store');
    }
}
