<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Language\LatvianReferences;
use Illuminate\Http\{JsonResponse, Request};
use Illuminate\Validation\Rule;

class TutorReferenceController extends Controller
{
    public function __invoke(Request $request, LatvianReferences $references): JsonResponse
    {
        $data = $request->validate(['operation' => ['required', Rule::in(LatvianReferences::OPERATIONS)],
            'query' => ['required', 'string', 'max:1200']]);
        $result = $references->run($data['operation'], $data['query']);
        return response()->json(['data' => $result], $result['ok'] ? 200 :
            (($result['error']['code'] ?? '') === 'invalid_reference_request' ? 422 : 503));
    }
}
