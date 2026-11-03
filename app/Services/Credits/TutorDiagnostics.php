<?php

namespace App\Services\Credits;

class TutorDiagnostics
{
    public static function log(string $event, array $fields = []): void
    {
        if (!config('credits.diagnostics_enabled', true) || (app()->runningUnitTests() && !config('credits.diagnostics_directory'))) return;
        $numbers = ['user_id','input_bytes','duration_ms','status_code','input_tokens','output_tokens','cached_tokens','cache_write_tokens','input_audio_tokens','web_search_calls','seconds','reserved_micros','balance_micros','available_micros','cost_micros','amount_micros','commission_bps'];
        $flags = ['ok','has_usage','rejected'];
        $labels = ['trace_id','call_id','operation','reference','model','kind','purpose','action','phase','reason','error_type','request_id','preset','status'];
        $safe = [];
        foreach ($fields as $key => $value) {
            if (in_array($key, $numbers, true) && (is_int($value) || is_float($value)) && is_finite($value)) $safe[$key] = $value;
            if (in_array($key, $flags, true) && is_bool($value)) $safe[$key] = $value;
            if (in_array($key, $labels, true) && is_string($value) && preg_match('/^[a-zA-Z0-9_.:\/-]{1,140}$/D', $value)) $safe[$key] = $value;
        }
        if (!preg_match('/^[a-z0-9_.-]{1,80}$/D', $event)) return;
        try {
            $directory = config('credits.diagnostics_directory') ?: storage_path('logs/tutor-diagnostics');
            if (!is_dir($directory) && !mkdir($directory, 0770, true) && !is_dir($directory)) return;
            $file = $directory.'/tutor-'.gmdate('Y-m-d').'.jsonl';
            clearstatcache(true, $file);
            if (is_file($file) && filesize($file) >= 20*1024*1024) return;
            $line = json_encode(['v'=>1,'time'=>gmdate('Y-m-d\TH:i:s\Z'),'source'=>'laravel','event'=>$event]+$safe, JSON_THROW_ON_ERROR)."\n";
            $handle = fopen($file, 'ab');
            if (!$handle) return;
            try { if (flock($handle, LOCK_EX)) { fwrite($handle, $line); flock($handle, LOCK_UN); } }
            finally { fclose($handle); }
            if (!function_exists('posix_geteuid') || fileowner($file) === posix_geteuid()) chmod($file, 0660);
        } catch (\Throwable) { error_log('tutor_diagnostics_write_failed'); }
    }
}
