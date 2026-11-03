<?php

namespace App\Console\Commands;

use App\Models\Dictionary;
use App\Services\EnglishDictionaryCopy;
use Illuminate\Console\Command;
use InvalidArgumentException;

class CopyEnglishDictionary extends Command
{
    protected $signature = 'dictionary:copy-english-topics {--source=31 : Existing English source dictionary} {--apply : Create the reviewed independent copy; otherwise preview only}';

    protected $description = 'Copy English vocabulary into compact level/topic categories with at most 30 words per leaf';

    public function handle(EnglishDictionaryCopy $copy): int
    {
        try {
            $source = Dictionary::findOrFail((int) $this->option('source'));
            [$taxonomy, $groups, $identities] = $copy->resources();
            $plan = $copy->prepare($source, $taxonomy, $groups, $identities);
            $this->info($plan['name'].' — '.$plan['words']->count().' записей; '.count($plan['categories']).' категорий; максимум '.$plan['limit'].' слов в конечной категории.');
            foreach ($plan['counts'] as $level => $topics) {
                $this->line($level.': '.array_sum($topics).' слов, '.count($topics).' основных тем.');
            }
            if (! $this->option('apply')) {
                $this->info('Предпросмотр. База не изменена.');

                return self::SUCCESS;
            }
            $target = $copy->create($source, $taxonomy, $groups, $identities);
            $this->info('Создан словарь #'.$target->id.': /dictionaries/'.$target->id.'. Исходный словарь, курс и пользовательский прогресс не изменялись.');

            return self::SUCCESS;
        } catch (InvalidArgumentException $error) {
            $this->error($error->getMessage());

            return self::FAILURE;
        }
    }
}
