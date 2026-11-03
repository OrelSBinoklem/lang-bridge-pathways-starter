<?php

namespace App\Console\Commands;

use App\Services\EnglishSupplementDictionary;
use Illuminate\Console\Command;
use InvalidArgumentException;

class PrepareEnglishSupplementDictionary extends Command
{
    protected $signature = 'dictionary:prepare-english-supplement {--write : Create a new independent English dictionary}';

    protected $description = 'Validate/create English supplemental vocabulary with at most 30 words per final category';

    public function handle(EnglishSupplementDictionary $service): int
    {
        try {
            $package = $service->load();
            $this->info($package['name'].': '.count($package['words']).' слов; '.count($package['categories']).' категорий.');
            if (! $this->option('write')) {
                $this->line('Только проверка. Для создания используйте --write.');

                return self::SUCCESS;
            }
            $dictionary = $service->create($package);
            $this->info('Создан #'.$dictionary->id.': /dictionaries/'.$dictionary->id);

            return self::SUCCESS;
        } catch (InvalidArgumentException $error) {
            $this->error($error->getMessage());

            return self::FAILURE;
        }
    }
}
