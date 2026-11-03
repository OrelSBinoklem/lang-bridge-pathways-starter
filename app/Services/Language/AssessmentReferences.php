<?php

namespace App\Services\Language;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class AssessmentReferences
{
    public function post(array $body, string $key, int $timeout, string $role = 'examiner', array $variables = []): array
    {
        $body = app(\App\Services\Tutor\AiProfiles::class)->apply($role, $body, $variables);
        if (($variables['language'] ?? 'lv') === 'en') {
            // English has its own workflow and rubrics; Latvian tools are not relevant evidence.
            $response = Http::withToken($key)->withOptions(['ai_role' => $role])->connectTimeout(min(15, $timeout))->timeout($timeout)
                ->post('https://api.openai.com/v1/responses', $body);
            return ['response' => $response, 'checks' => []];
        }
        $body['input'][0]['content'] .= "\n".LatvianReferences::instructions();
        $body['tools'] = [LatvianReferences::tool()];
        $body['include'] = ['reasoning.encrypted_content'];
        $body['parallel_tool_calls'] = false;
        $deadline = microtime(true) + $timeout;
        $checks = [];
        for ($round = 0; $round < 4; $round++) {
            $remaining = (int) floor($deadline - microtime(true));
            if ($remaining < 1) throw new RuntimeException('Assessment reference deadline exceeded');
            if (count($checks) >= 3 || $round === 3) $body['tool_choice'] = 'none';
            $response = Http::withToken($key)->withOptions(['ai_role' => $role])->connectTimeout(min(15, $remaining))->timeout($remaining)
                ->post('https://api.openai.com/v1/responses', $body);
            if (!$response->successful() || $response->json('status') !== 'completed') return ['response' => $response, 'checks' => $checks];
            $output = $response->json('output', []);
            $calls = array_values(array_filter($output, fn ($item) => ($item['type'] ?? '') === 'function_call'));
            if (!$calls) return ['response' => $response, 'checks' => $checks];
            if ($round === 3 || count($checks) >= 3) throw new RuntimeException('Assessment reference budget exceeded');
            // Preserve encrypted reasoning and call items for stateless Responses continuations.
            $body['input'] = array_merge($body['input'], $output);
            foreach ($calls as $call) {
                if (count($checks) >= 3) throw new RuntimeException('Assessment reference budget exceeded');
                if (($call['name'] ?? '') !== 'latvian_reference' || !is_string($call['call_id'] ?? null)) throw new RuntimeException('Unexpected assessment tool');
                $arguments = json_decode($call['arguments'], true, 16, JSON_THROW_ON_ERROR);
                if (!is_string($arguments['operation'] ?? null) || !is_string($arguments['query'] ?? null)) throw new RuntimeException('Invalid assessment tool arguments');
                $budget = max(1, (int) floor($deadline - microtime(true)) - 5);
                $result = app(LatvianReferences::class)->run($arguments['operation'], $arguments['query'], $budget);
                $checks[] = ['operation' => $arguments['operation'], 'query' => mb_substr($arguments['query'], 0, 1200),
                    'ok' => $result['ok'], 'source_url' => $result['source_url'] ?? null, 'sources' => $result['sources'] ?? [],
                    'error_code' => $result['error']['code'] ?? null];
                $body['input'][] = ['type' => 'function_call_output', 'call_id' => $call['call_id'],
                    'output' => json_encode($result, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)];
            }
        }
        throw new RuntimeException('Assessment reference budget exceeded');
    }
}
