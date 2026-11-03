<?php

namespace Tests\Feature;

use App\Models\Dictionary;
use App\Models\DictionaryWord;
use App\Services\EnglishDictionaryAudio;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use InvalidArgumentException;
use Tests\TestCase;

class EnglishDictionaryAudioTest extends TestCase
{
    private string $public;
    private array $manifest;
    private DictionaryWord $word;

    protected function setUp(): void
    {
        parent::setUp();
        $this->assertSame(':memory:', config('database.connections.sqlite.database'));
        Schema::create('users', fn ($table) => $table->id());
        foreach (['2026_08_02_000001_create_lbp_dictionary_tables.php', '2026_09_08_000001_add_multilingual_dictionary_translations.php', '2026_09_08_000002_add_info_to_dictionary_word_translations.php'] as $migration) {
            (require database_path('migrations/'.$migration))->up();
        }
        $dictionary = Dictionary::create(['name' => 'English', 'lang' => 'RU', 'learn_lang' => 'EN', 'sound' => false]);
        $this->word = $dictionary->dictionaryWords()->create(['word' => 'record', 'type' => 'noun', 'learn_lang' => 'EN', 'translation_1' => 'запись']);
        $this->word->translations()->create(['lang' => 'uk', 'translation_1' => 'запис']);
        DB::table('users')->insert(['id' => 1]);
        DB::table('user_dictionary_words')->insert(['user_id' => 1, 'dict_word_id' => $this->word->id, 'correct_attempts' => 2]);
        $this->public = base_path('.tmp/english-audio-test-'.bin2hex(random_bytes(6)));
        $bytes = 'An isolated test asset, never published as speech.';
        $url = '/audio/dictionary/en-flash/'.hash('sha256', $bytes).'.mp3';
        File::ensureDirectoryExists(dirname($this->public.$url));
        file_put_contents($this->public.$url, $bytes);
        $this->manifest = ['version' => 1, 'review' => ['complete' => true],
            'dictionaries' => [['id' => $dictionary->id, 'name' => $dictionary->name]],
            'words' => [['id' => $this->word->id, 'dictionary_id' => $dictionary->id, 'old_sound_url' => null,
                'sound_url' => $url, 'content_hash' => EnglishDictionaryAudio::fingerprint($this->word->fresh('translations')->toArray())]]];
    }

    protected function tearDown(): void
    {
        if (isset($this->public)) {
            // Only this test's verified private temporary directory is removed.
            $root = realpath(base_path('.tmp'));
            $resolved = realpath($this->public);
            if ($resolved && $root && str_starts_with($resolved, $root.DIRECTORY_SEPARATOR.'english-audio-test-')) {
                File::deleteDirectory($resolved);
            }
        }
        parent::tearDown();
    }

    public function test_preview_is_read_only_and_install_is_idempotent_and_preserves_progress(): void
    {
        $service = app(EnglishDictionaryAudio::class);
        $before = $this->word->fresh('translations')->toArray();
        $progress = DB::table('user_dictionary_words')->get()->toJson();
        $this->assertSame(1, $service->prepare($this->manifest, $this->public)['changed']);
        $this->assertNull($this->word->fresh()->sound_url);
        $this->assertSame(1, $service->install($this->manifest, $this->public)['changed']);
        $this->assertTrue($this->word->dictionary->fresh()->sound);
        $this->assertSame(0, $service->install($this->manifest, $this->public)['changed']);
        $this->assertSame(EnglishDictionaryAudio::fingerprint($before), EnglishDictionaryAudio::fingerprint($this->word->fresh('translations')->toArray()));
        $this->assertSame($progress, DB::table('user_dictionary_words')->get()->toJson());
    }

    public function test_admin_translation_edits_are_never_overwritten(): void
    {
        $this->word->translations()->update(['translation_1' => 'Правка администратора']);
        $this->expectException(InvalidArgumentException::class);
        app(EnglishDictionaryAudio::class)->install($this->manifest, $this->public);
    }

    public function test_corrupt_asset_prevents_all_database_changes(): void
    {
        file_put_contents($this->public.$this->manifest['words'][0]['sound_url'], 'corrupted');
        try {
            app(EnglishDictionaryAudio::class)->install($this->manifest, $this->public);
            $this->fail('Corrupt file accepted');
        } catch (InvalidArgumentException) {
            $this->assertNull($this->word->fresh()->sound_url);
            $this->assertFalse($this->word->dictionary->fresh()->sound);
        }
    }

    public function test_incomplete_package_or_replaced_admin_audio_is_rejected(): void
    {
        $this->word->dictionary->dictionaryWords()->create(['word' => 'other', 'learn_lang' => 'EN', 'translation_1' => 'другой']);
        $this->expectException(InvalidArgumentException::class);
        app(EnglishDictionaryAudio::class)->install($this->manifest, $this->public);
    }

    public function test_admin_audio_edits_are_preserved(): void
    {
        $this->word->update(['sound_url' => '/manual/admin.mp3']);
        $this->expectException(InvalidArgumentException::class);
        app(EnglishDictionaryAudio::class)->install($this->manifest, $this->public);
    }
}
