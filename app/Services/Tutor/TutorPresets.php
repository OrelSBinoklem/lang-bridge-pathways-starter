<?php

namespace App\Services\Tutor;

use App\Models\AppSetting;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class TutorPresets
{
    public const IDS = ['economy', 'standard', 'quality', 'uncompromising'];

    public function all(): array
    {
        $defaults = json_decode(file_get_contents(base_path('frontend/src/config/tutor-presets.json')), true, 512, JSON_THROW_ON_ERROR);
        $scenarioDefaults = json_decode(file_get_contents(base_path('frontend/src/config/tutor-scenario-defaults.json')), true, 512, JSON_THROW_ON_ERROR);
        $saved = AppSetting::whereIn('key', [...array_map(fn ($id) => 'tutor_preset_'.$id, self::IDS), 'tutor_preset_maximum'])->pluck('value', 'key');
        $result = [];
        foreach ($defaults as $id => $config) {
            // Initially inherit the owner's current maximum, including saved pricing scenarios.
            $source = $id === 'quality' && !isset($saved['tutor_preset_quality']) ? 'uncompromising' : $id;
            if ($id === 'uncompromising' && isset($saved['tutor_preset_maximum'])) $source = 'maximum';
            $override = json_decode($saved['tutor_preset_'.$source] ?? '{}', true, 512, JSON_THROW_ON_ERROR);
            if ($id === 'uncompromising' && $source !== 'maximum') $override['config']['tutorModel'] = 'gpt-6-sol';
            $embeddingDefaults = ['messageEmbeddingModel' => 'text-embedding-3-large', 'summaryEmbeddingModel' => 'text-embedding-3-large'];
            $config = array_replace($config, $embeddingDefaults, $override['config'] ?? []);
            if (empty($override['embedding_choice_explicit'])) $config = array_replace($config, $embeddingDefaults);
            $scenario = $override['scenario'] ?? [];
            if (empty($override['scenario_defaults_explicit'])) $scenario = array_replace($scenario, $scenarioDefaults);
            $result[$id] = ['config' => $config,
                'scenario' => $scenario, 'loadedScenario' => $override['loadedScenario'] ?? []];
        }
        return $result;
    }

    public function save(string $id, array $input): array
    {
        abort_unless(in_array($id, self::IDS, true), 404);
        $reasoning = json_decode(file_get_contents(base_path('frontend/src/config/tutor-reasoning.json')), true, 512, JSON_THROW_ON_ERROR);
        $tts = json_decode(file_get_contents(base_path('frontend/src/config/tutor-tts.json')), true, 512, JSON_THROW_ON_ERROR);
        $rules = ['config' => 'required|array', 'scenario' => 'present|array', 'loadedScenario' => 'present|array'];
        foreach (['tutorModel', 'contextSummaryModel'] as $key) {
            $rules['config.'.$key] = ['required', Rule::in($key === 'contextSummaryModel' ? [...array_keys($reasoning), 'same_as_tutor'] : array_keys($reasoning))];
        }
        $enums = [
            'transcriptionModel' => ['browser-speech', 'gpt-transcribe', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'],
            'secondaryTranscriptionModel' => ['gpt-transcribe', 'gpt-4o-transcribe', 'gpt-4o-mini-transcribe', 'whisper-1'],
            'secondaryTranscriptionLanguage' => ['', 'lv', 'ru'], 'primaryTranscriptionLanguage' => ['', 'lv', 'ru', 'uk', 'en'],
            'ttsModel' => array_column($tts['models'], 'id'), 'ttsStartMode' => ['first_sentence', 'full_reply'],
            'contextMode' => ['basic', 'full'], 'ttsMode' => ['browser', 'api'],
            'reasoningEffort' => ['none', 'low', 'medium', 'high', 'xhigh', 'max'],
            'tutorPipeline' => ['stt_text_tts'], 'liveDelay' => ['low', 'medium', 'high'],
            'liveTranscriptionModel' => [''],
            'voiceModel' => ['gpt-realtime-2.1', 'gpt-realtime-2.1-mini', 'gpt-realtime-2', 'gpt-realtime-1.5', 'gpt-realtime-translate'],
            'messageEmbeddingModel' => ['text-embedding-3-small', 'text-embedding-3-large'],
            'summaryEmbeddingModel' => ['text-embedding-3-small', 'text-embedding-3-large'],
        ];
        foreach ($enums as $key => $values) $rules['config.'.$key] = [str_ends_with($key, 'Language') || $key === 'liveTranscriptionModel' ? 'present' : 'required', 'nullable', Rule::in($values)];
        foreach (['dualTranscriptionEnabled', 'contextCompressionEnabled', 'reasoningEnabled', 'longMemoryEnabled'] as $key) $rules['config.'.$key] = 'required|boolean';
        $rules['config.maxOutputTokens'] = 'sometimes|integer|min:700|max:8192';
        $rules['config.ttsVoice'] = ['required', Rule::in(array_unique(array_merge(...array_column($tts['models'], 'voices'))))];
        $keys = ['audioMinutes', 'liveAudioMinutes', 'dialogueActs', 'callsPerAct', 'fixedContextTokens', 'initialHistoryTokens',
            'userTokensPerAct', 'outputTokensPerCall', 'reasoningTokensPerCall', 'toolTokensPerCall', 'cacheHitPercent',
            'historyTokenLimit', 'ttsWordsPerMinute', 'ttsMinutes', 'retainedHistoryActs', 'summaryBatchActs',
            'summaryTokensPerRun', 'summaryReasoningTokensPerRun', 'memorySearchesPerHour', 'memoryQueryTokens', 'memoryResultTokens'];
        foreach (['scenario', 'loadedScenario'] as $scenario) {
            $rules[$scenario] = 'present|array:'.implode(',', $keys);
            foreach ($keys as $key) $rules[$scenario.'.'.$key] = 'sometimes|numeric|min:0|max:1000000';
            foreach (['audioMinutes', 'liveAudioMinutes', 'ttsMinutes'] as $key) $rules[$scenario.'.'.$key] = 'sometimes|numeric|min:0|max:60';
            $rules[$scenario.'.cacheHitPercent'] = 'sometimes|numeric|min:0|max:100';
            $rules[$scenario.'.dialogueActs'] = 'sometimes|integer|min:0|max:1000';
            $rules[$scenario.'.callsPerAct'] = 'sometimes|numeric|min:1|max:20';
        }
        $data = Validator::make($input, $rules)->after(function ($validator) use ($input, $tts, $reasoning) {
            $config = $input['config'] ?? [];
            $profile = collect($tts['models'])->firstWhere('id', $config['ttsModel'] ?? '');
            if ($profile && !in_array($config['ttsVoice'] ?? '', $profile['voices'], true)) $validator->errors()->add('config.ttsVoice', 'Выберите голос выбранной модели.');
            $efforts = $reasoning[$config['tutorModel'] ?? ''] ?? [];
            if ($efforts && !in_array($config['reasoningEnabled'] ?? false ? ($config['reasoningEffort'] ?? '') : 'none', $efforts, true)) $validator->errors()->add('config.reasoningEffort', 'Этот режим мышления недоступен у выбранной модели.');
        })->validate();
        foreach (['primaryTranscriptionLanguage', 'secondaryTranscriptionLanguage', 'liveTranscriptionModel'] as $key) $data['config'][$key] = (string)($data['config'][$key] ?? '');
        // Never persist arbitrary client keys (including preset, playback, provider or pipeline overrides).
        $configKeys = array_map(fn ($key) => substr($key, 7), array_filter(array_keys($rules), fn ($key) => str_starts_with($key, 'config.')));
        $data['config'] = array_intersect_key($data['config'], array_flip($configKeys));
        $data['embedding_choice_explicit'] = true;
        $data['scenario_defaults_explicit'] = true;
        if ($id === 'uncompromising' && !AppSetting::where('key', 'tutor_preset_quality')->exists()) {
            $original = AppSetting::where('key', 'tutor_preset_uncompromising')->value('value');
            AppSetting::firstOrCreate(['key' => 'tutor_preset_quality'], ['value' => $original ?? '{}']);
        }
        AppSetting::updateOrCreate(['key' => 'tutor_preset_'.($id === 'uncompromising' ? 'maximum' : $id)], ['value' => json_encode($data, JSON_THROW_ON_ERROR)]);
        return $this->all();
    }
}
