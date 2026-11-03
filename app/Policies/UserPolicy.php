<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->isSuperAdmin() || $actor->hasRole('admin');
    }

    public function view(User $actor, User $target): bool
    {
        if ($actor->id === $target->id) {
            return true;
        }

        return $this->viewAny($actor);
    }

    public function create(User $actor): bool
    {
        return $actor->isSuperAdmin() || $actor->hasRole('admin');
    }

    public function update(User $actor, User $target): bool
    {
        if ($actor->id === $target->id) {
            return true;
        }

        return $actor->canManageUser($target);
    }

    public function delete(User $actor, User $target): bool
    {
        if ($actor->id === $target->id) {
            return false;
        }

        return $actor->canManageUser($target);
    }

    public function deleteAny(User $actor): bool
    {
        return $actor->isSuperAdmin() || $actor->hasRole('admin');
    }
}
