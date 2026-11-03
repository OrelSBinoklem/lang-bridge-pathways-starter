<?php

namespace Tests\Unit;

use App\Support\DictionaryCategoryTree;
use PHPUnit\Framework\TestCase;

class DictionaryCategoryTreeTest extends TestCase
{
    public function test_it_orders_categories_by_dictionary_and_parent_and_formats_branches(): void
    {
        $categories = collect([
            (object) ['id' => 5, 'dictionary_id' => 2, 'parent_id' => null, 'order' => 0],
            (object) ['id' => 4, 'dictionary_id' => 1, 'parent_id' => 2, 'order' => 0],
            (object) ['id' => 3, 'dictionary_id' => 1, 'parent_id' => 1, 'order' => 2],
            (object) ['id' => 2, 'dictionary_id' => 1, 'parent_id' => 1, 'order' => 1],
            (object) ['id' => 1, 'dictionary_id' => 1, 'parent_id' => null, 'order' => 0],
        ]);

        $tree = new DictionaryCategoryTree($categories);

        $this->assertSame([1, 2, 4, 3, 5], $tree->orderedIds());
        $this->assertSame('', $tree->prefixFor(1));
        $this->assertSame('├─ ', $tree->prefixFor(2));
        $this->assertSame('│  └─ ', $tree->prefixFor(4));
        $this->assertSame('└─ ', $tree->prefixFor(3));
        $this->assertSame('', $tree->prefixFor(5));
        $this->assertSame([1, 2, 4, 3], $tree->descendantIdsFor(1));
        $this->assertSame([5], $tree->descendantIdsFor(5));
        $this->assertSame([], $tree->descendantIdsFor(999));
    }

    public function test_it_keeps_orphans_and_cycles_visible_for_repair(): void
    {
        $tree = new DictionaryCategoryTree(collect([
            (object) ['id' => 1, 'dictionary_id' => 1, 'parent_id' => 99, 'order' => 0],
            (object) ['id' => 2, 'dictionary_id' => 1, 'parent_id' => 3, 'order' => 1],
            (object) ['id' => 3, 'dictionary_id' => 1, 'parent_id' => 2, 'order' => 2],
        ]));

        $this->assertSame([1, 2, 3], $tree->orderedIds());
        $this->assertSame('└─ ', $tree->prefixFor(3));
        $this->assertSame([2, 3], $tree->descendantIdsFor(2));
    }
}
