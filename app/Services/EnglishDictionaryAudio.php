<?php

namespace App\Services;

use App\Models\Dictionary;
use App\Models\DictionaryWord;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

/** Installs reviewed recordings without changing vocabulary, translations, IDs or progress. */
class EnglishDictionaryAudio
{
    public static function fingerprint(array $word): string
    {
        unset($word['sound_url'], $word['created_at'], $word['updated_at']);
        $word['translations'] ??= [];
        foreach ($word['translations'] as &$translation) {
            unset($translation['created_at'], $translation['updated_at']);
            ksort($translation);
        }
        unset($translation);
        usort($word['translations'], fn ($a, $b) => [$a['lang'], $a['id']] <=> [$b['lang'], $b['id']]);
        ksort($word);

        return hash('sha256', json_encode($word, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
    }

    public function prepare(array $manifest, string $publicDirectory): array
    {
        if (($manifest['version'] ?? null) !== 1 || empty($manifest['words']) || empty($manifest['dictionaries'])
            || ($manifest['review']['complete'] ?? false) !== true) {
            throw new InvalidArgumentException('Нужен полный проверенный пакет озвучки.');
        }
        $dictionaryIds = array_column($manifest['dictionaries'], 'id');
        if (count($dictionaryIds) !== count(array_unique($dictionaryIds))) {
            throw new InvalidArgumentException('Повтор словаря в пакете.');
        }
        $dictionaries = Dictionary::whereIn('id', $dictionaryIds)->lockForUpdate()->get()->keyBy('id');
        foreach ($manifest['dictionaries'] as $expected) {
            $dictionary = $dictionaries->get($expected['id']);
            if (! $dictionary || strtolower($dictionary->learn_lang) !== 'en' || $dictionary->name !== $expected['name']) {
                throw new InvalidArgumentException('Исходный словарь изменился.');
            }
        }
        $words = DictionaryWord::whereIn('dictionary_id', $dictionaryIds)->with('translations')->orderBy('id')->lockForUpdate()->get()->keyBy('id');
        if (count($manifest['words']) !== $words->count()) {
            throw new InvalidArgumentException('Состав словарей изменился.');
        }
        $seen = $assets = [];
        $changed = 0;
        foreach ($manifest['words'] as $entry) {
            $word = $words->get($entry['id'] ?? null);
            if (! $word || isset($seen[$word->id]) || $word->dictionary_id !== ($entry['dictionary_id'] ?? null)
                || self::fingerprint($word->toArray()) !== ($entry['content_hash'] ?? null)) {
                throw new InvalidArgumentException('Слово или перевод изменились: '.($entry['id'] ?? '?'));
            }
            $seen[$word->id] = true;
            $url = $entry['sound_url'] ?? '';
            if (! is_string($url) || ! preg_match('~^/audio/dictionary/en-flash/([a-f0-9]{64})\.mp3$~D', $url, $match)) {
                throw new InvalidArgumentException('Неверный путь аудио.');
            }
            if (! array_key_exists('old_sound_url', $entry)
                || ($word->sound_url !== $url && $word->sound_url !== $entry['old_sound_url'])) {
                throw new InvalidArgumentException('Озвучка уже изменена администратором: '.$word->id);
            }
            if (! isset($assets[$url])) {
                $file = rtrim($publicDirectory, '/\\').str_replace('/', DIRECTORY_SEPARATOR, $url);
                if (! is_file($file) || hash_file('sha256', $file) !== $match[1]) {
                    throw new InvalidArgumentException('Файл озвучки отсутствует или повреждён: '.$word->id);
                }
                $assets[$url] = true;
            }
            $changed += $word->sound_url === $url ? 0 : 1;
        }

        return ['records' => $words->count(), 'recordings' => count($assets), 'changed' => $changed, 'dictionary_ids' => $dictionaryIds];
    }

    public function install(array $manifest, string $publicDirectory): array
    {
        $result = DB::transaction(function () use ($manifest, $publicDirectory) {
            $result = $this->prepare($manifest, $publicDirectory);
            foreach ($manifest['words'] as $entry) {
                DB::table('dictionary_words')->where('id', $entry['id'])
                    ->where(fn ($query) => $query->where('sound_url', '!=', $entry['sound_url'])->orWhereNull('sound_url'))
                    ->update(['sound_url' => $entry['sound_url'], 'updated_at' => now()]);
            }
            DB::table('dictionaries')->whereIn('id', $result['dictionary_ids'])->where('sound', false)
                ->update(['sound' => true, 'updated_at' => now()]);
            DB::afterCommit(fn () => DictionaryCache::invalidate());

            return $result;
        });

        return $result;
    }
}
