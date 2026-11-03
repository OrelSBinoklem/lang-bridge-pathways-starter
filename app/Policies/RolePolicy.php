<?php

namespace App\Policies;

use App\Models\User;
use Spatie\Permission\Models\Role;

class RolePolicy
{
    public function viewAny(User $actor): bool
    {
        return $actor->isSuperAdmin();
    }

    public function view(User $actor, Role $role): bool
    {
        return $actor->isSuperAdmin();
    }

    public function create(User $actor): bool
    {
        return $actor->isSuperAdmin();
    }

    public function update(User $actor, Role $role): bool
    {
        return $actor->isSuperAdmin();
    }

    public function delete(User $actor, Role $role): bool
    {
        return $actor->isSuperAdmin();
    }

    public function deleteAny(User $actor): bool
    {
        return $actor->isSuperAdmin();
    }
}
