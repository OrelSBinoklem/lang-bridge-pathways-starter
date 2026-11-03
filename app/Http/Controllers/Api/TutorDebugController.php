<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\TutorConversation;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TutorDebugController extends Controller
{
    public function users(Request $request): JsonResponse
    {
        abort_unless($request->user()?->isFrontendAdmin(), 403);
        $input = $request->validate(['q' => 'sometimes|nullable|string|max:100', 'user_id' => 'sometimes|integer|min:1']);
        $query = User::query()->select(['id', 'name', 'email']);
        if (! empty($input['q'])) {
            $q = '%'.addcslashes($input['q'], '%_\\').'%';
            $query->where(fn ($builder) => $builder->where('name', 'like', $q)->orWhere('email', 'like', $q));
        }
        $users = $query->orderBy('id')->limit(50)->get();
        $selected = (int) ($input['user_id'] ?? $request->user()->id);
        $selectedUser = User::query()->select(['id', 'name', 'email'])->find($selected);
        if ($selectedUser && ! $users->contains('id', $selected)) $users->prepend($selectedUser);
        $conversations = TutorConversation::query()->where('user_id', $selected)->latest('updated_at')->limit(50)->get(['id', 'status', 'started_at', 'updated_at']);

        return response()->json(['data' => ['users' => $users, 'conversations' => $conversations]])->header('Cache-Control', 'private, no-store');
    }
}
