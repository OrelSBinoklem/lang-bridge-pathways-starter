<?php

namespace App\Filament\Resources\DictionaryCategories\Pages;

use App\Filament\Resources\DictionaryCategories\DictionaryCategoryResource;
use App\Models\DictionaryCategory;
use App\Support\DictionaryCategoryTree;
use Filament\Actions\CreateAction;
use Filament\Resources\Pages\ListRecords;
use Illuminate\Database\Eloquent\Builder;

class ListDictionaryCategories extends ListRecords
{
    protected static string $resource = DictionaryCategoryResource::class;

    private ?DictionaryCategoryTree $categoryTree = null;

    public function categoryTree(): DictionaryCategoryTree
    {
        return $this->categoryTree ??= new DictionaryCategoryTree(
            DictionaryCategory::query()->orderBy('dictionary_id')->orderBy('order')->orderBy('id')
                ->get(['id', 'dictionary_id', 'parent_id', 'order']),
        );
    }

    public function orderCategoriesAsTree(Builder $query): Builder
    {
        $cases = [];
        foreach ($this->categoryTree()->orderedIds() as $position => $id) {
            $cases[] = 'WHEN '.(int) $id.' THEN '.$position;
        }

        if ($cases !== []) {
            $query->orderByRaw('CASE dictionary_categories.id '.implode(' ', $cases).' ELSE '.count($cases).' END');
        }

        return $query;
    }

    protected function getHeaderActions(): array
    {
        return [
            CreateAction::make()->label('Новая категория'),
        ];
    }
}
