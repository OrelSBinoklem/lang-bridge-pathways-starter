<?php

namespace App\Console\Commands;

use App\Services\EnglishDictionaryAudio;
use Illuminate\Console\Command;

class InstallEnglishDictionaryAudio extends Command
{
    protected $signature = 'dictionary:install-english-audio {manifest?} {--apply : Подключить проверенные записи}';

    protected $description = 'Проверить и подключить озвучку английских слов, сохранив содержимое и прогресс';

    public function handle(EnglishDictionaryAudio $service): int
    {
        $file = $this->argument('manifest') ?: resource_path('dictionaries/english-audio/manifest.json');
        $manifest = json_decode(file_get_contents($file), true, flags: JSON_THROW_ON_ERROR);
        $public = base_path('frontend/public');
        $result = $this->option('apply') ? $service->install($manifest, $public) : $service->prepare($manifest, $public);
        $this->line(json_encode(['applied' => (bool) $this->option('apply'), ...$result], JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR));

        return self::SUCCESS;
    }
}
