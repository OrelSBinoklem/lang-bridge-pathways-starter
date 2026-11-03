<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Dictionary;
use App\Services\DictionaryExportService;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DictionaryExportController extends Controller
{
    public function __invoke(Dictionary $dictionary, DictionaryExportService $export): StreamedResponse
    {
        $tree = $export->exportToJsonTree($dictionary);
        $json = json_encode($tree, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
        if ($json === false) {
            abort(500, 'Failed to encode dictionary JSON: '.json_last_error_msg());
        }

        $slug = preg_replace('/[^a-zA-Z0-9_-]+/', '-', $dictionary->name) ?: 'dictionary';
        $filename = "{$slug}-{$dictionary->id}.json";

        return response()->streamDownload(
            static function () use ($json): void {
                echo $json;
            },
            $filename,
            ['Content-Type' => 'application/json; charset=UTF-8'],
        );
    }
}
