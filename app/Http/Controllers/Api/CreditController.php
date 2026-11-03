<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Credits\CreditWallet;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class CreditController extends Controller
{
    public function statistics(Request $request, \App\Services\Credits\CreditStatistics $statistics)
    {
        $data = $request->validate(['period' => ['sometimes', 'in:hour,day,month'],
            'date' => ['sometimes', 'date_format:Y-m-d'], 'timezone' => ['sometimes', 'timezone:all_with_bc']]);
        return response()->json(['data' => $statistics->summarize(
            $request->user()->id, $data['period'] ?? 'day', $data['date'] ?? null, $data['timezone'] ?? 'UTC',
        )])->header('Cache-Control', 'private, no-store');
    }

    public function balance(Request $request, CreditWallet $wallet)
    {
        $history = DB::table('credit_operations')->where('user_id', $request->user()->id)->orderByDesc('created_at')->orderByDesc('id')
            ->limit(50)->get(['id', 'kind', 'model', 'status', 'amount_micros', 'reserved_micros', 'commission_bps', 'cost_micros', 'created_at', 'pricing'])
            ->map(function ($operation) {
                $pricing = json_decode($operation->pricing ?? '{}', true) ?? [];
                $operation->purpose = $pricing['purpose'] ?? \App\Services\Credits\CreditPurpose::fallback($operation->kind);
                unset($operation->pricing);
                return $operation;
            });
        return response()->json(['data' => $wallet->balance($request->user()->id) + ['history' => $history]])->header('Cache-Control', 'private, no-store');
    }

    public function ticket(Request $request)
    {
        app(\App\Services\CourseSubscription::class)->requireActive($request->user());
        $token = $request->user()->currentAccessToken();
        $ticket = Str::random(64);
        DB::table('credit_gateway_sessions')->where('expires_at', '<', now()->subDay())->delete();
        DB::table('credit_gateway_sessions')->insert(['ticket_hash' => hash('sha256', $ticket), 'user_id' => $request->user()->id,
            'access_token_id' => $token instanceof \Laravel\Sanctum\PersonalAccessToken ? $token->id : null,
            'ticket_expires_at' => now()->addSeconds(60), 'expires_at' => now()->addHour(), 'created_at' => now()]);
        return response()->json(['ticket' => $ticket])->header('Cache-Control', 'private, no-store');
    }

    public function gateway(Request $request, CreditWallet $wallet)
    {
        $secret = (string) config('credits.gateway_secret');
        abort_unless(strlen($secret) >= 32 && hash_equals($secret, (string) $request->header('X-Credit-Gateway')), 403);
        abort_unless(config('credits.enabled'), 503);
        $data = $request->validate(['action' => 'required|in:authenticate,presets,flow.active,debug.authorize,reserve,settle,context.load,context.save,context.message', 'ticket' => 'sometimes|string|size:64',
            'session' => 'sometimes|string|size:64', 'reference' => 'sometimes|uuid', 'operation' => 'sometimes|uuid',
            'model' => 'sometimes|string|max:100', 'kind' => 'sometimes|in:text,speech,transcription,embedding',
            'tutor_preset' => ['sometimes', 'nullable', \Illuminate\Validation\Rule::in(\App\Services\Tutor\TutorPresets::IDS)],
            'purpose' => ['sometimes', \Illuminate\Validation\Rule::in(\App\Services\Credits\CreditPurpose::VALUES)],
            'input_bytes' => 'sometimes|integer|min:0|max:180000', 'max_output_tokens' => 'sometimes|integer|min:0|max:16000',
            'characters' => 'sometimes|integer|min:0|max:4096', 'rejected' => 'sometimes|boolean', 'usage' => 'nullable|array',
            'usage.input_tokens' => 'sometimes|integer|min:0|max:10000000', 'usage.output_tokens' => 'sometimes|integer|min:0|max:1000000',
            'usage.cached_tokens' => 'sometimes|integer|min:0|max:10000000', 'usage.cache_write_tokens' => 'sometimes|integer|min:0|max:10000000',
            'usage.input_audio_tokens' => 'sometimes|integer|min:0|max:10000000', 'usage.web_search_calls' => 'sometimes|integer|min:0|max:100',
            'usage.seconds' => 'sometimes|numeric|min:0|max:7200']);
        if ($data['action'] === 'authenticate') {
            abort_unless(isset($data['ticket']), 422);
            return DB::transaction(function () use ($data) {
                $record = DB::table('credit_gateway_sessions')->where('ticket_hash', hash('sha256', $data['ticket']))->lockForUpdate()->first();
                abort_unless($record && !$record->session_hash && $record->ticket_expires_at > now() && $this->tokenValid($record), 401);
                app(\App\Services\CourseSubscription::class)->requireActive(\App\Models\User::findOrFail($record->user_id));
                $session = Str::random(64);
                DB::table('credit_gateway_sessions')->where('ticket_hash', $record->ticket_hash)->update(['session_hash' => hash('sha256', $session)]);
                return response()->json(['session' => $session, 'user_id' => (int) $record->user_id, 'is_admin' => \App\Models\User::findOrFail($record->user_id)->isFrontendAdmin()])->header('Cache-Control', 'no-store');
            });
        }
        abort_unless(isset($data['session']), 401);
        $record = DB::table('credit_gateway_sessions')->where('session_hash', hash('sha256', $data['session']))->first();
        // Settlement remains possible after logout/expiry; it cannot initiate another paid call.
        abort_unless($record, 401);
        if ($data['action'] === 'debug.authorize') {
            abort_unless($record->expires_at > now() && $this->tokenValid($record), 401);
            abort_unless(\App\Models\User::findOrFail($record->user_id)->isFrontendAdmin(), 403);
            return response()->json(['ok' => true])->header('Cache-Control', 'private, no-store');
        }
        if ($data['action'] === 'flow.active') {
            abort_unless($record->expires_at > now() && $this->tokenValid($record), 401);
            return response()->json(['flow' => app(\App\Services\Tutor\TutorFlows::class)->active()])->header('Cache-Control', 'no-store');
        }
        if ($data['action'] === 'presets') {
            abort_unless($record->expires_at > now() && $this->tokenValid($record), 401);
            return response()->json(['presets' => app(\App\Services\Tutor\TutorPresets::class)->all(),
                'profiles' => app(\App\Services\Tutor\AiProfiles::class)->runtime()])->header('Cache-Control', 'no-store');
        }
        if (str_starts_with($data['action'], 'context.')) {
            abort_unless($record->expires_at > now() && $this->tokenValid($record), 401);
            try {
                $contextPayload = json_decode($request->getContent(), true, 512, JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                abort(422, 'Invalid context JSON.');
            }
            abort_unless(is_array($contextPayload), 422);
            return response()->json(app(\App\Services\Tutor\TutorRuntimeContext::class)->handle(
                $record->user_id, $data['action'], $contextPayload, $data['tutor_preset'] ?? null,
            ))->header('Cache-Control', 'private, no-store');
        }
        if ($data['action'] === 'reserve') {
            abort_unless($record->expires_at > now() && $this->tokenValid($record), 401);
            abort_unless(isset($data['reference'], $data['model'], $data['kind']), 422);
            return ['operation' => $wallet->reserve($record->user_id, 'gateway:'.$data['reference'], $data, $data['tutor_preset'] ?? null)];
        }
        abort_unless(isset($data['operation']), 422);
        $allowedUsage = array_intersect_key($data['usage'] ?? [], array_flip(['input_tokens', 'output_tokens', 'cached_tokens', 'cache_write_tokens', 'input_audio_tokens', 'web_search_calls', 'seconds']));
        $wallet->settle($record->user_id, $data['operation'], $allowedUsage ?: null, $data['rejected'] ?? false);
        // Observation only: the wallet remains the sole authority for prices and debits.
        $operation = DB::table('credit_operations')->where('id', $data['operation'])->where('user_id', $record->user_id)
            ->first(['status', 'cost_micros']);
        return ['ok' => true, 'status' => $operation?->status,
            'cost_micros' => $operation && in_array($operation->status, ['settled', 'released'], true) ? (int) $operation->cost_micros : null];
    }

    private function tokenValid(object $record): bool
    {
        return !$record->access_token_id || DB::table('personal_access_tokens')->where('id', $record->access_token_id)
            ->where('tokenable_id', $record->user_id)->where(fn ($q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()))->exists();
    }
}
