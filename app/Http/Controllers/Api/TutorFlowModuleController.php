<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Tutor\TutorFlowModules;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TutorFlowModuleController extends Controller
{
    public function index(Request $request, TutorFlowModules $modules): JsonResponse
    {
        $this->authorizeAdmin($request);

        return $this->respond(['modules' => $modules->all()]);
    }

    public function store(Request $request, TutorFlowModules $modules): JsonResponse
    {
        $this->authorizeAdmin($request);
        if (strlen($request->getContent()) > 132096) {
            throw ValidationException::withMessages(['request' => 'Запрос превышает лимит размера.']);
        }
        try {
            $body = json_decode($request->getContent(), false, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw ValidationException::withMessages(['request' => 'Нужен корректный JSON-объект.']);
        }
        if (! $body instanceof \stdClass) {
            throw ValidationException::withMessages(['request' => 'Нужен JSON-объект.']);
        }
        $input = (array) $body;
        if (array_diff(array_keys($input), ['definition', 'expected_version']) || ! array_key_exists('definition', $input) || ! array_key_exists('expected_version', $input) || ($input['expected_version'] !== null && (! is_int($input['expected_version']) || $input['expected_version'] < 1 || $input['expected_version'] >= 9007199254740991))) {
            throw ValidationException::withMessages(['request' => 'Нужны definition и expected_version (положительное целое или null).']);
        }

        return $this->respond($modules->save($input['definition'], $input['expected_version']), 201);
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user(), 401);
        abort_unless($request->user()->isFrontendAdmin(), 403);
    }

    private function respond(array $data, int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data], $status)->header('Cache-Control', 'private, no-store');
    }
}
