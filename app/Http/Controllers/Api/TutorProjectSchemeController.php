<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Tutor\TutorProjectSchemes;
use Illuminate\Http\Request;

class TutorProjectSchemeController extends Controller
{
    public function index(Request $request, TutorProjectSchemes $schemes)
    {
        abort_unless($request->user()?->isFrontendAdmin(), 403);

        return $this->respond($schemes->all());
    }

    public function create(Request $request, TutorProjectSchemes $schemes)
    {
        abort_unless($request->user()?->isFrontendAdmin(), 403);
        $input = $this->input($request, ['name']);
        abort_unless(is_string($input['name'] ?? null), 422);

        return $this->respond($schemes->create($input['name'], $request->user()->id), 201);
    }

    public function blocks(Request $request, TutorProjectSchemes $schemes)
    {
        abort_unless($request->user()?->isFrontendAdmin(), 403);

        return $this->respond($schemes->blocks());
    }

    public function update(Request $request, string $project, TutorProjectSchemes $schemes)
    {
        abort_unless($request->user()?->isFrontendAdmin(), 403);
        $input = $this->input($request, ['graph', 'expected_revision']);
        abort_unless(is_string($input['expected_revision'] ?? null), 422);

        return $this->respond($schemes->save($project, $input['graph'] ?? null, $input['expected_revision'], $request->user()->id));
    }

    private function input(Request $request, array $keys): array
    {
        abort_if(strlen($request->getContent()) > 32768, 422);
        try {
            $input = json_decode($request->getContent(), true, 32, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            abort(422, 'Нужен JSON-объект.');
        }
        abort_unless(is_array($input) && ! array_is_list($input) && ! array_diff(array_keys($input), $keys), 422);

        return $input;
    }

    private function respond(array $data, int $status = 200)
    {
        return response()->json(['data' => $data], $status)->header('Cache-Control', 'private, no-store');
    }
}
