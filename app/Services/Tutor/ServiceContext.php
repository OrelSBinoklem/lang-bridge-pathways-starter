<?php

namespace App\Services\Tutor;

class ServiceContext
{
    public static function parts(array $plan, array $input, array $variables): array
    {
        $request = array_values(array_filter($input, fn ($v) => ($v['role'] ?? '') !== 'developer'));
        $parts = [];
        foreach ($plan['parts'] as $part) {
            if ($part['kind'] === 'prompt') {
                $text = $part['text']; foreach ($variables as $key => $value) $text = str_replace('{{'.$key.'}}', (string) $value, $text);
                $parts[] = ['kind' => 'prompt', 'messages' => [['role' => 'developer', 'content' => $text]], 'port' => $part['port']];
            } else $parts[] = ['kind' => 'source', 'messages' => $part['source'] === 'request' ? $request : [['role' => 'user', 'content' => json_encode($variables, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR)]], 'port' => $part['port']];
        }
        return $parts;
    }

    /** Learner data always stay user messages, even with text/JSON serialization. */
    public static function assemble(array $plan, array $input, array $variables): array
    {
        $parts = self::parts($plan, $input, $variables);
        $instructions = array_merge(...array_map(fn ($p) => $p['kind'] === 'prompt' ? $p['messages'] : [], $parts));
        if ($plan['format'] === 'messages' && $plan['mode'] === 'object') return array_merge(...array_column($parts, 'messages'));
        $data = [];
        foreach ($parts as $part) if ($part['kind'] === 'source') {
            $key = collect($plan['inputs'])->firstWhere('id', $part['port'])['key'];
            $data[$key] = [...($data[$key] ?? []), ...$part['messages']];
        }
        $json = fn ($value) => json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $asText = fn ($value) => implode("\n\n", array_map(fn ($key, $v) => $key.":\n".$json($v), array_keys($value), array_values($value)));
        $assembled = $plan['mode'] === 'json' ? $json($data) : ($plan['mode'] === 'text' ? $asText($data) : $data);
        $content = $plan['format'] === 'json' ? $json($assembled) : (is_string($assembled) ? $assembled : $asText($assembled));
        return [...$instructions, ['role' => 'user', 'content' => $content]];
    }
}
