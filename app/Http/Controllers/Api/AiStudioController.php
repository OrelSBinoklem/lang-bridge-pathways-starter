<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Tutor\AiProfiles;
use Illuminate\Http\Request;

class AiStudioController extends Controller
{
    public function workflows(Request $request, \App\Services\Tutor\ServiceWorkflows $flows)
    {
        abort_unless($request->user()?->isFrontendAdmin(), 403);
        return response()->json(['data' => $flows->all()])->header('Cache-Control', 'private, no-store');
    }

    public function workflowMutation(Request $request, string $scheme, string $action, \App\Services\Tutor\ServiceWorkflows $flows)
    {
        abort_unless($request->user()?->isFrontendAdmin(), 403);
        try { $input = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR); }
        catch (\JsonException) { abort(422, 'Некорректный JSON.'); }
        abort_unless(is_array($input) && !array_is_list($input), 422);
        if ($action === 'preview') {
            abort_unless(!array_diff(array_keys($input), ['graph', 'role', 'body', 'variables']), 422);
            return response()->json(['data' => $flows->preview($scheme, $input)])->header('Cache-Control', 'private, no-store');
        }
        abort_unless(!array_diff(array_keys($input), ['expected_revision', 'graph', 'version_id']), 422);
        return response()->json(['data' => $flows->mutate($scheme, $action, $input, (int) $request->user()->id)])->header('Cache-Control', 'private, no-store');
    }

    public function index(Request $request, AiProfiles $profiles)
    {
        abort_unless($request->user()?->isFrontendAdmin(), 403);
        return response()->json(['data' => $profiles->all()])->header('Cache-Control', 'private, no-store');
    }

    public function update(Request $request, string $bot, AiProfiles $profiles)
    {
        abort_unless($request->user()?->isFrontendAdmin(), 403);
        try { $input = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR); }
        catch (\JsonException) { abort(422, 'Некорректный JSON.'); }
        abort_unless(is_array($input) && !array_is_list($input), 422);
        return response()->json(['data' => $profiles->save($bot, $input)])->header('Cache-Control', 'private, no-store');
    }
}
