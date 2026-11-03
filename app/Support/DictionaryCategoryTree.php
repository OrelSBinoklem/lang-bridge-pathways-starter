<?php

namespace App\Support;

use Illuminate\Support\Collection;

class DictionaryCategoryTree
{
    /** @var list<int> */
    private array $orderedIds = [];

    /** @var array<int, string> */
    private array $prefixes = [];

    /** @var array<int, list<int>> */
    private array $childIds = [];

    /**
     * @param  Collection<int, object>  $categories
     */
    public function __construct(Collection $categories)
    {
        $categories = $categories->sortBy([
            ['dictionary_id', 'asc'],
            ['order', 'asc'],
            ['id', 'asc'],
        ]);

        $byId = $categories->keyBy('id');
        $children = [];

        foreach ($categories as $category) {
            $parent = $byId->get($category->parent_id);
            $parentId = $parent && $parent->dictionary_id === $category->dictionary_id
                ? $parent->id
                : 0;

            $children[$category->dictionary_id][$parentId][] = $category->id;

            if ($parentId !== 0) {
                $this->childIds[$parentId][] = (int) $category->id;
            }
        }

        foreach ($categories->pluck('dictionary_id')->unique() as $dictionaryId) {
            $visited = [];
            $siblings = $children[$dictionaryId] ?? [];

            $visit = function (int $id, array $ancestorLast, bool $isLast, bool $isRoot) use (&$visit, &$visited, $siblings): void {
                if (isset($visited[$id])) {
                    return;
                }

                $visited[$id] = true;
                $this->orderedIds[] = $id;
                $this->prefixes[$id] = $isRoot ? '' : implode('', array_map(
                    fn (bool $last): string => $last ? '   ' : '│  ',
                    $ancestorLast,
                )).($isLast ? '└─ ' : '├─ ');

                $childIds = $siblings[$id] ?? [];
                foreach ($childIds as $index => $childId) {
                    $visit($childId, $isRoot ? [] : [...$ancestorLast, $isLast], $index === count($childIds) - 1, false);
                }
            };

            foreach ($siblings[0] ?? [] as $id) {
                $visit($id, [], true, true);
            }

            // Malformed parent cycles still appear in the admin list for repair.
            foreach ($categories->where('dictionary_id', $dictionaryId) as $category) {
                if (! isset($visited[$category->id])) {
                    $visit($category->id, [], true, true);
                }
            }
        }
    }

    /** @return list<int> */
    public function orderedIds(): array
    {
        return $this->orderedIds;
    }

    public function prefixFor(int $id): string
    {
        return $this->prefixes[$id] ?? '';
    }

    /** @return list<int> */
    public function descendantIdsFor(int $id): array
    {
        if (! array_key_exists($id, $this->prefixes)) {
            return [];
        }

        $seen = [];
        $pending = [$id];

        while ($pending !== []) {
            $currentId = array_pop($pending);
            if (isset($seen[$currentId])) {
                continue;
            }

            $seen[$currentId] = true;
            array_push($pending, ...array_reverse($this->childIds[$currentId] ?? []));
        }

        return array_keys($seen);
    }
}
