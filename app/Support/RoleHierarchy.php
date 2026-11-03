<?php

namespace App\Support;

final class RoleHierarchy
{
    /** Выше число — выше права */
    public const RANKS = [
        'super_admin' => 100,
        'admin' => 50,
        'moderator' => 20,
        'editor' => 20, // legacy alias модератора
        'user' => 0,
    ];

    /** Кто может заходить в Filament */
    public const PANEL_ROLES = ['super_admin', 'admin', 'moderator', 'editor'];

    /** Админские фичи на фронте (редактирование слов и т.п.) */
    public const FRONTEND_ADMIN_ROLES = ['super_admin', 'admin'];

    public static function rank(string $role): int
    {
        return self::RANKS[$role] ?? 0;
    }

    /** Роли, которые actor может назначать другим */
    public static function assignableBy(string ...$actorRoles): array
    {
        $max = 0;
        foreach ($actorRoles as $role) {
            $max = max($max, self::rank($role));
        }

        if ($max >= self::RANKS['super_admin']) {
            return ['super_admin', 'admin', 'moderator', 'user'];
        }

        if ($max >= self::RANKS['admin']) {
            return ['moderator', 'user'];
        }

        return [];
    }
}
