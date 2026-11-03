<?php

namespace App\Services\Credits;

class CreditPricing
{
    public function quote(array $request): array
    {
        $model = $request['model'] ?? '';
        $rate = config('credits.rates')[$model] ?? null;
        if (!$rate) throw new CreditException('Для выбранной модели не настроен тариф.', 422);
        if ($model === 'gemini-3.8-flash-tts' && now('UTC')->lt(\Carbon\CarbonImmutable::parse('2027-01-01T00:00:00Z'))) $rate = [500, 500, 9000];
        if ($model === 'gemini-3.8-flash-lite-tts' && now('UTC')->lt(\Carbon\CarbonImmutable::parse('2027-01-01T00:00:00Z'))) $rate = [500, 500, 6000];
        $bytes = (int) ($request['input_bytes'] ?? 0);
        $output = (int) ($request['max_output_tokens'] ?? 16000);
        if ($bytes < 0 || $bytes > 180000 || $output < 0 || $output > 16000) throw new CreditException('Запрос превышает лимит оплачиваемой модели.', 422);
        $characters = (int) ($request['characters'] ?? 0);
        if ($characters < 0 || $characters > 4096) throw new CreditException('Слишком длинная озвучка.', 422);
        $kind = $request['kind'] ?? 'text';
        $reserve = match ($kind) {
            'speech', 'transcription' => 200000,
            default => max(1000, (int) ceil((($bytes + 20000) * max($rate[0] ?? 0, $rate[3] ?? 0) + $output * ($rate[2] ?? 0)) / 1000) + 20000),
        };
        $purpose = $request['purpose'] ?? CreditPurpose::fallback($kind);
        if (!in_array($purpose, CreditPurpose::VALUES, true)) throw new CreditException('Неизвестное назначение AI-запроса.', 422);
        return ['rate' => $rate, 'characters' => $characters, 'reserve_cost_micros' => $reserve, 'kind' => $kind, 'purpose' => $purpose];
    }

    public function cost(array $pricing, ?array $usage): ?int
    {
        $r = $pricing['rate'];
        if ($usage === null) return null;
        foreach ($usage as $key => $value) {
            if (!is_numeric($value) || !is_finite((float) $value) || $value < 0 || $value > 10000000) return null;
        }
        if (isset($r['character_micros'])) return $pricing['characters'] * $r['character_micros'];
        if (isset($r['second_micros'])) {
            return isset($usage['seconds']) ? (int) ceil($usage['seconds'] * $r['second_micros']) : null;
        }
        if (!isset($usage['input_tokens'], $usage['output_tokens'])) return null;
        $input = $usage['input_tokens'];
        $cached = min($input, $usage['cached_tokens'] ?? 0);
        $writes = min($input - $cached, $usage['cache_write_tokens'] ?? 0);
        $audio = min($input - $cached - $writes, $usage['input_audio_tokens'] ?? 0);
        $nanos = ($input - $cached - $writes - $audio) * $r[0] + $cached * $r[1]
            + $writes * ($r[3] ?? $r[0]) + $audio * ($r[4] ?? $r[0]) + $usage['output_tokens'] * $r[2];
        return (int) ceil($nanos / 1000) + ($usage['web_search_calls'] ?? 0) * 10000;
    }

    public static function normalize(array $payload): ?array
    {
        if (isset($payload['usageMetadata'])) {
            $u = $payload['usageMetadata'];
            return isset($u['promptTokenCount'], $u['candidatesTokenCount']) ? ['input_tokens' => $u['promptTokenCount'], 'output_tokens' => $u['candidatesTokenCount']] : null;
        }
        $u = $payload['usage'] ?? null;
        if (!is_array($u)) return isset($payload['duration']) && is_numeric($payload['duration']) ? ['seconds' => $payload['duration']] : null;
        if (isset($u['seconds'])) return ['seconds' => $u['seconds']];
        $input = $u['input_tokens'] ?? $u['prompt_tokens'] ?? null;
        $output = $u['output_tokens'] ?? $u['completion_tokens'] ?? (isset($payload['data']) ? 0 : null);
        if ($input === null || $output === null) return null;
        $details = $u['input_tokens_details'] ?? $u['prompt_tokens_details'] ?? $u['input_token_details'] ?? [];
        return ['input_tokens' => $input, 'output_tokens' => $output, 'cached_tokens' => $details['cached_tokens'] ?? 0,
            'cache_write_tokens' => $details['cache_write_tokens'] ?? $details['cache_creation_tokens'] ?? 0,
            'input_audio_tokens' => $details['audio_tokens'] ?? 0,
            'web_search_calls' => count(array_filter($payload['output'] ?? [], fn ($o) => ($o['type'] ?? '') === 'web_search_call'))];
    }
}
