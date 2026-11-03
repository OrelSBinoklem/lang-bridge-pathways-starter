<?php

namespace App\Services;

use App\Models\User;
use Illuminate\Support\Str;

/** Compatibility API for former subscriptions. Ordinary access is permanently free. */
class CourseSubscription
{
    public function requireActive(User $user): void
    {
        // Authentication and AI credit checks remain at their existing boundaries.
    }

    public function status(User $user): array
    {
        return ['enabled' => false, 'active' => true, 'status' => 'free', 'user_id' => $user->id,
            'price_credits' => 0, 'months' => null, 'auto_renew' => false,
            'trial_until' => null, 'paid_until' => null, 'access_until' => null];
    }

    public function purchase(User $user, string $requestId): array
    {
        if (!Str::isUuid($requestId)) throw new \InvalidArgumentException('Invalid purchase reference');
        // Old open tabs may still submit their former purchase button. Never charge them.
        return $this->status($user);
    }
}
