<?php

namespace App\Services\Credits;

use Illuminate\Support\Str;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

class MeteredHttp
{
    public function middleware(): \Closure
    {
        return function (callable $handler) {
            return function (RequestInterface $request, array $options) use ($handler) {
                if (!config('credits.enabled') || $request->getUri()->getHost() !== 'api.openai.com') return $handler($request, $options);
                // Maintenance commands and administrative content production are site expenses, not personal usage.
                $owner = app(CreditContext::class)->userId;
                if (!$owner && app()->runningInConsole() && !app()->runningUnitTests()) return $handler($request, $options);
                if (request()->is('api/admin/*') && request()->user()?->isFrontendAdmin()) return $handler($request, $options);
                $user = $owner ?? request()->user()?->id;
                if (!$user) throw new CreditException('Войдите в аккаунт для использования AI.', 401);
                $body = json_decode((string) $request->getBody(), true) ?? [];
                $model = $options['credit_model'] ?? $body['model'] ?? '';
                $path = $request->getUri()->getPath();
                $kind = str_ends_with($path, '/transcriptions') ? 'transcription' : (str_ends_with($path, '/embeddings') ? 'embedding' : 'text');
                if (!in_array($path, ['/v1/responses', '/v1/embeddings', '/v1/audio/transcriptions'], true)) throw new CreditException('Этот AI-сервис ещё не подключён к оплате.', 422);
                $wallet = app(CreditWallet::class);
                $id = $wallet->reserve($user, 'http:'.Str::uuid(), ['model' => $model, 'kind' => $kind,
                    'purpose' => $options['credit_purpose'] ?? CreditPurpose::forHttp($kind),
                    'input_bytes' => $kind === 'transcription' ? 0 : strlen((string) $request->getBody()), 'max_output_tokens' => $body['max_output_tokens'] ?? 16000],
                    app(CreditContext::class)->tutorPreset);
                $started=microtime(true);
                TutorDiagnostics::log('http.provider.start',['operation'=>$id,'user_id'=>$user,'model'=>$model,'kind'=>$kind]);
                try {
                    return $handler($request, $options)->then(function (ResponseInterface $response) use ($wallet, $user, $id, $started) {
                        $payload = json_decode((string) $response->getBody(), true) ?? [];
                        $response->getBody()->rewind();
                        $status = $response->getStatusCode();
                        TutorDiagnostics::log('http.provider.completed',['operation'=>$id,'user_id'=>$user,'status_code'=>$status,'duration_ms'=>(int)round((microtime(true)-$started)*1000),'request_id'=>$response->getHeaderLine('x-request-id'),'has_usage'=>CreditPricing::normalize($payload)!==null]);
                        $wallet->settle($user, $id, CreditPricing::normalize($payload), $status >= 400 && $status < 500);
                        return $response;
                    }, function ($error) use ($wallet, $user, $id) {
                        TutorDiagnostics::log('http.provider.failed',['operation'=>$id,'user_id'=>$user,'error_type'=>class_basename($error)]);
                        $wallet->settle($user, $id, null);
                        throw $error;
                    });
                } catch (\Throwable $error) {
                    TutorDiagnostics::log('http.provider.failed',['operation'=>$id,'user_id'=>$user,'error_type'=>class_basename($error)]);
                    $wallet->settle($user, $id, null);
                    throw $error;
                }
            };
        };
    }
}
