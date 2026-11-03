<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Tutor\TutorFlows;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class TutorFlowController extends Controller
{
    public function index(Request $request, TutorFlows $flows): JsonResponse
    {
        $this->authorizeAdmin($request);

        return $this->respond($flows->all());
    }

    public function store(Request $request, TutorFlows $flows): JsonResponse
    {
        $this->authorizeAdmin($request);
        $input = $this->input($request, ['expected_head_version_id', 'graph']);
        $expected = $this->expected($input, 'expected_head_version_id');
        $graph = $flows->validateGraph($input['graph'] ?? null);

        return $this->respond($flows->save($graph, $expected, (int) $request->user()->getAuthIdentifier()), 201);
    }

    public function show(Request $request, int $version, TutorFlows $flows): JsonResponse
    {
        $this->authorizeAdmin($request);

        return $this->respond($flows->version($version));
    }

    public function activate(Request $request, int $version, TutorFlows $flows): JsonResponse
    {
        $this->authorizeAdmin($request);
        $input = $this->input($request, ['expected_active_version_id']);

        return $this->respond($flows->activate($version, $this->expected($input, 'expected_active_version_id')));
    }

    public function deactivate(Request $request, TutorFlows $flows): JsonResponse
    {
        $this->authorizeAdmin($request);
        $input = $this->input($request, ['expected_active_version_id']);

        return $this->respond($flows->deactivate($this->expected($input, 'expected_active_version_id')));
    }

    private function authorizeAdmin(Request $request): void
    {
        abort_unless($request->user(), 401);
        abort_unless($request->user()->isFrontendAdmin(), 403);
    }

    private function expected(array $input, string $key): ?int
    {
        if (! array_key_exists($key, $input) || ($input[$key] !== null && (! is_int($input[$key]) || $input[$key] < 1))) {
            throw ValidationException::withMessages([$key => 'Укажите ожидаемую версию: положительный ID или null.']);
        }

        return $input[$key];
    }

    private function input(Request $request, array $keys): array
    {
        // Read the JSON shape before TrimStrings/ConvertEmptyStringsToNull changes
        // prompt text, empty strings or {}. Never evaluate or log the payload.
        try {
            $input = json_decode($request->getContent(), false, 512, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            throw ValidationException::withMessages(['request' => 'Нужен корректный JSON-объект.']);
        }
        if (! $input instanceof \stdClass) {
            throw ValidationException::withMessages(['request' => 'Нужен JSON-объект.']);
        }
        $input = (array) $input;
        if (array_diff(array_keys($input), $keys) !== []) {
            throw ValidationException::withMessages(['request' => 'Неизвестные поля запрещены.']);
        }

        return $input;
    }

    private function respond(array $data, int $status = 200): JsonResponse
    {
        return response()->json(['data' => $data], $status)->header('Cache-Control', 'private, no-store');
    }
}
