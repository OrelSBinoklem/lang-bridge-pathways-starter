<?php

namespace App\Services\Tutor;

use App\Services\Credits\CreditContext;
use Illuminate\Support\Facades\{Http, Log};
use Psr\Http\Message\{RequestInterface, ResponseInterface};

/** Private, opt-in request inspection. Billing and provider results are never changed. */
class AiTrace
{
    public function middleware(): \Closure
    {
        return function (callable $handler) {
            return function (RequestInterface $request, array $options) use ($handler) {
                $role = $options['ai_role'] ?? null;
                if (!$role || !config('ai_studio.capture') || $request->getUri()->getHost() !== 'api.openai.com'
                    || (app()->runningUnitTests() && !config('ai_studio.capture_in_tests'))) return $handler($request, $options);
                $owner = app(CreditContext::class)->userId ?? request()->user()?->id ?? ($options['ai_user_id'] ?? null);
                if (!$owner || !isset(app(AiProfiles::class)->defaults()[$role])) return $handler($request, $options);
                $base = ['userId' => (int) $owner, 'botId' => $role];
                $id = null;
                if ($this->send($base + ['action' => 'status'])['recording'] ?? false) {
                    $body = $options['ai_context'] ?? json_decode((string) $request->getBody(), true);
                    if (is_array($body)) {
                        $attempt = request()->route('attempt');
                        $subject = app(CreditContext::class)->debugSubject
                            ?? ($attempt ? ['type' => 'exam_attempt', 'id' => is_object($attempt) ? $attempt->id : $attempt] : null);
                        $id = $this->send($base + ['action' => 'begin', 'request' => $body, 'subject' => $subject,
                            'graph' => app(AiProfiles::class)->inspectionGraph($role)])['id'] ?? null;
                    }
                }
                $finish = function (?ResponseInterface $response, ?\Throwable $error = null) use ($id, $base) {
                    if (!$id) return;
                    try {
                    $payload = null;
                    if ($response) {
                        $stream = $response->getBody();
                        // Never consume an unseekable provider stream or retain raw audio.
                        if ($stream->isSeekable() && ($stream->getSize() ?? PHP_INT_MAX) <= 1900000) {
                            $position = $stream->tell();
                            $payload = json_decode((string) $stream, true);
                            $stream->seek($position);
                        }
                    }
                    $this->send($base + ['action' => 'finish', 'id' => $id, 'status' => $response?->getStatusCode(),
                        'response' => $payload, 'captureOmitted' => $response && $payload === null, 'error' => $error ? class_basename($error) : null]);
                    } catch (\Throwable $captureError) { Log::warning('ai_studio.capture_failed', ['type' => class_basename($captureError)]); }
                };
                try {
                    return $handler($request, $options)->then(function (ResponseInterface $response) use ($finish) {
                        $finish($response); return $response;
                    }, function ($error) use ($finish) { $finish(null, $error); throw $error; });
                } catch (\Throwable $error) { $finish(null, $error); throw $error; }
            };
        };
    }

    private function send(array $payload): array
    {
        $url = (string) config('ai_studio.capture_url');
        $parts = parse_url($url);
        $secret = (string) config('credits.gateway_secret');
        if (!$parts || !in_array($parts['host'] ?? '', ['127.0.0.1', 'localhost', '::1'], true)
            || ($parts['scheme'] ?? '') !== 'http' || strlen($secret) < 32) return [];
        try {
            $response = Http::connectTimeout(1)->timeout(2)->withHeaders(['X-Tutor-Debug' => $secret])->post($url, $this->redact($payload));
            if ($response->successful()) return $response->json() ?? [];
            Log::warning('ai_studio.capture_failed', ['status' => $response->status()]);
        } catch (\Throwable $error) { Log::warning('ai_studio.capture_failed', ['type' => class_basename($error)]); }
        return [];
    }

    private function redact(array $value): array
    {
        foreach ($value as $key => &$item) {
            if (preg_match('/^(authorization|api[_-]?key|access[_-]?token|secret|ticket|headers|audio|audioBase64|audio_base64|encrypted_content)$/i', (string) $key)) $item = '[excluded]';
            elseif (is_array($item)) $item = $this->redact($item);
        }
        return $value;
    }
}
