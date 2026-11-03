<?php

namespace App\Console\Commands;

use App\Models\Dictionary;
use App\Services\EnglishSupplementDictionary;
use App\Services\EnglishSupplementRevision;
use Illuminate\Console\Command;

class ReviseEnglishSupplementDictionary extends Command
{
    protected $signature = 'dictionary:revise-english-supplement {revision} {--package= : JSON-пакет этой редакции, если он отличается от текущего} {--apply}';

    protected $description = 'Проверить и применить точечную редакцию дополнительного английского словаря';

    public function handle(EnglishSupplementRevision $service): int
    {
        $revision = json_decode(file_get_contents($this->argument('revision')), true, flags: JSON_THROW_ON_ERROR);
        $dictionary = Dictionary::findOrFail($revision['dictionary_id']);
        $catalog = app(EnglishSupplementDictionary::class);
        $package = $this->option('package')
            ? $catalog->validate(json_decode(file_get_contents($this->option('package')), true, flags: JSON_THROW_ON_ERROR))
            : $catalog->load();
        $result = $this->option('apply') ? $service->apply($dictionary, $revision, $package) : $service->prepare($dictionary, $revision, $package);
        $this->line(json_encode(['applied' => (bool) $this->option('apply'), ...$result], JSON_THROW_ON_ERROR));

        return self::SUCCESS;
    }
}
