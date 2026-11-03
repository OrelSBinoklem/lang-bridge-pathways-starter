<?php

namespace App\Console\Commands;

use App\Models\DenseTrainingSession;
use App\Models\Dictionary;
use App\Models\DictionaryCategory;
use App\Models\DictionaryWord;
use App\Models\UniqueWord;
use App\Models\User;
use App\Models\UserDictionaryWord;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class ImportLbpDumpCommand extends Command
{
    protected $signature = 'lbp:import-dump
        {--connection=wp_import : Staging DB connection with WP tables}
        {--fresh : Truncate LBP tables before import}
        {--skip-users : Skip users / progress / dense sessions}';

    protected $description = 'Import dictionaries, words, users and progress from staging WP database (lbp_wp_import)';

    /** @var array<int, int> */
    private array $userMap = [];

    public function handle(): int
    {
        $connection = (string) $this->option('connection');

        if (! config("database.connections.{$connection}")) {
            $this->error("Connection [{$connection}] is not configured.");

            return self::FAILURE;
        }

        try {
            DB::connection($connection)->getPdo();
        } catch (\Throwable $e) {
            $this->error("Cannot connect to [{$connection}]: ".$e->getMessage());

            return self::FAILURE;
        }

        if ($this->option('fresh')) {
            $this->warn('Truncating LBP tables...');
            $this->truncateLbp();
        }

        // No wrapping transaction: MySQL DDL (AUTO_INCREMENT) commits implicitly.
        $this->importDictionaries($connection);
        $this->importCategories($connection);
        $this->importWords($connection);
        $this->importWordCategories($connection);
        $this->importUniqueWords($connection);

        if (! $this->option('skip-users')) {
            $this->importUsers($connection);
            $this->importProgress($connection);
            $this->importDenseSessions($connection);
        }

        $this->info(sprintf(
            'Done. Dictionaries: %d, categories: %d, words: %d, users mapped: %d, progress: %d',
            Dictionary::count(),
            DictionaryCategory::count(),
            DictionaryWord::count(),
            count($this->userMap),
            UserDictionaryWord::count(),
        ));

        return self::SUCCESS;
    }

    private function truncateLbp(): void
    {
        DB::statement('SET FOREIGN_KEY_CHECKS=0');

        DenseTrainingSession::query()->delete();
        UserDictionaryWord::query()->delete();
        DB::table('dictionary_word_category')->delete();
        DictionaryWord::query()->delete();
        DictionaryCategory::query()->delete();
        Dictionary::query()->delete();
        UniqueWord::query()->delete();

        DB::statement('SET FOREIGN_KEY_CHECKS=1');
    }

    private function importDictionaries(string $connection): void
    {
        $rows = DB::connection($connection)->table('wp_dictionaries')->orderBy('id')->get();
        $this->info('Importing dictionaries: '.$rows->count());
        $now = now();

        foreach ($rows as $row) {
            DB::table('dictionaries')->updateOrInsert(
                ['id' => (int) $row->id],
                [
                    'name' => $row->name,
                    'lang' => $row->lang,
                    'learn_lang' => $row->learn_lang,
                    'words' => (int) $row->words,
                    'level' => (int) $row->level,
                    'max_level' => (int) ($row->maxLevel ?? $row->max_level ?? 1),
                    'sound' => (bool) $row->sound,
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }

        $this->syncAutoIncrement('dictionaries');
    }

    private function importCategories(string $connection): void
    {
        $rows = DB::connection($connection)->table('wp_d_categories')->orderBy('id')->get();
        $this->info('Importing categories: '.$rows->count());
        $now = now();

        foreach ($rows as $row) {
            DB::table('dictionary_categories')->updateOrInsert(
                ['id' => (int) $row->id],
                [
                    'dictionary_id' => (int) $row->dictionary_id,
                    'name' => $row->name,
                    'parent_id' => null,
                    'order' => (int) ($row->order ?? 0),
                    'created_at' => $now,
                    'updated_at' => $now,
                ]
            );
        }

        foreach ($rows as $row) {
            if ($row->parent_id) {
                DB::table('dictionary_categories')->where('id', (int) $row->id)->update([
                    'parent_id' => (int) $row->parent_id,
                ]);
            }
        }

        $this->syncAutoIncrement('dictionary_categories');
    }

    private function importWords(string $connection): void
    {
        $query = DB::connection($connection)->table('wp_d_words')->orderBy('id');
        $total = (clone $query)->count();
        $this->info("Importing words: {$total}");
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $query->chunk(500, function ($rows) use ($bar) {
            $now = now();
            $payload = [];

            foreach ($rows as $row) {
                $payload[] = [
                    'id' => (int) $row->id,
                    'dictionary_id' => (int) $row->dictionary_id,
                    'word' => $row->word,
                    'learn_lang' => $row->learn_lang,
                    'is_phrase' => (bool) $row->is_phrase,
                    'translation_1' => $row->translation_1,
                    'translation_2' => $row->translation_2,
                    'translation_3' => $row->translation_3,
                    'translation_input_variable' => $row->translation_input_variable ?? null,
                    'difficult_translation' => $row->difficult_translation,
                    'info' => $row->info,
                    'sound_url' => $row->sound_url,
                    'level' => $row->level !== null ? (int) $row->level : null,
                    'max_level' => (int) ($row->maxLevel ?? 1),
                    'type' => $row->type,
                    'gender' => $row->gender,
                    'order' => (int) $row->order,
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            DictionaryWord::query()->upsert($payload, ['id'], [
                'dictionary_id', 'word', 'learn_lang', 'is_phrase', 'translation_1', 'translation_2',
                'translation_3', 'translation_input_variable', 'difficult_translation', 'info',
                'sound_url', 'level', 'max_level', 'type', 'gender', 'order', 'updated_at',
            ]);

            $bar->advance(count($payload));
        });

        $bar->finish();
        $this->newLine();
        $this->syncAutoIncrement('dictionary_words');
    }

    private function importWordCategories(string $connection): void
    {
        DB::table('dictionary_word_category')->delete();

        $query = DB::connection($connection)->table('wp_d_word_category');
        $total = (clone $query)->count();
        $this->info("Importing word-category links: {$total}");

        $query->orderBy('word_id')->chunk(1000, function ($rows) {
            $payload = [];
            foreach ($rows as $row) {
                $payload[] = [
                    'word_id' => (int) $row->word_id,
                    'category_id' => (int) $row->category_id,
                ];
            }
            DB::table('dictionary_word_category')->insertOrIgnore($payload);
        });
    }

    private function importUniqueWords(string $connection): void
    {
        UniqueWord::query()->delete();
        $rows = DB::connection($connection)->table('wp_unique_words')->orderBy('id')->get();
        $this->info('Importing unique words: '.$rows->count());

        $seen = [];
        $payload = [];
        $now = now();

        foreach ($rows as $row) {
            $key = mb_strtolower($row->word).'|'.$row->lang;
            if (isset($seen[$key])) {
                continue;
            }
            $seen[$key] = true;
            $payload[] = [
                'id' => (int) $row->id,
                'word' => $row->word,
                'lang' => $row->lang,
                'created_at' => $now,
                'updated_at' => $now,
            ];
            if (count($payload) >= 500) {
                UniqueWord::query()->insertOrIgnore($payload);
                $payload = [];
            }
        }

        if ($payload !== []) {
            UniqueWord::query()->insertOrIgnore($payload);
        }

        $this->syncAutoIncrement('unique_words');
    }

    private function importUsers(string $connection): void
    {
        $rows = DB::connection($connection)->table('wp_users')->orderBy('ID')->get();
        $this->info('Importing users: '.$rows->count());

        foreach ($rows as $row) {
            $email = trim((string) $row->user_email);
            if ($email === '') {
                continue;
            }

            $caps = DB::connection($connection)
                ->table('wp_usermeta')
                ->where('user_id', $row->ID)
                ->where('meta_key', 'wp_capabilities')
                ->value('meta_value');

            $isAdmin = is_string($caps) && str_contains($caps, 'administrator');

            $user = User::query()->where('wp_user_id', (int) $row->ID)->first()
                ?? User::query()->where('email', $email)->first();

            if (! $user) {
                $user = new User;
                $user->email = $email;
                $user->password = Hash::make(Str::password(32));
            }

            $user->wp_user_id = (int) $row->ID;
            $user->name = $row->display_name ?: $row->user_login;
            if ($row->user_registered && $row->user_registered !== '0000-00-00 00:00:00') {
                $user->email_verified_at = $user->email_verified_at ?? $row->user_registered;
            }
            $user->save();

            $role = $isAdmin ? 'admin' : 'user';
            if (! $user->hasRole($role)) {
                $user->syncRoles([$role]);
            }

            $this->userMap[(int) $row->ID] = (int) $user->id;
        }
    }

    private function importProgress(string $connection): void
    {
        UserDictionaryWord::query()->delete();

        $query = DB::connection($connection)->table('wp_user_dict_words')->orderBy('id');
        $total = (clone $query)->count();
        $this->info("Importing progress rows: {$total}");
        $bar = $this->output->createProgressBar($total);
        $bar->start();

        $query->chunk(500, function ($rows) use ($bar) {
            $now = now();
            $payload = [];

            foreach ($rows as $row) {
                $userId = $this->userMap[(int) $row->user_id] ?? null;
                if (! $userId) {
                    continue;
                }

                $payload[] = [
                    'user_id' => $userId,
                    'dict_word_id' => (int) $row->dict_word_id,
                    'attempts' => (int) $row->attempts,
                    'correct_attempts' => (int) $row->correct_attempts,
                    'last_shown' => $this->nullableDate($row->last_shown),
                    'last_shown_revert' => $this->nullableDate($row->last_shown_revert ?? null),
                    'easy_education' => (bool) $row->easy_education,
                    'mode_education' => (bool) ($row->mode_education ?? false),
                    'mode_education_revert' => (bool) ($row->mode_education_revert ?? false),
                    'cooldown_tier' => (int) ($row->cooldown_tier ?? 0),
                    'cooldown_tier_revert' => (int) ($row->cooldown_tier_revert ?? 0),
                    'dense_remaining_direct' => (int) ($row->dense_remaining_direct ?? 0),
                    'dense_remaining_revert' => (int) ($row->dense_remaining_revert ?? 0),
                    'attempts_all' => (int) $row->attempts_all,
                    'correct_attempts_all' => (int) $row->correct_attempts_all,
                    'attempts_revert' => (int) ($row->attempts_revert ?? 0),
                    'correct_attempts_revert' => (int) ($row->correct_attempts_revert ?? 0),
                    'statistic_attempts' => (int) ($row->statistic_attempts ?? 0),
                    'statistic_attempts_revert' => (int) ($row->statistic_attempts_revert ?? 0),
                    'statistic_correct_attempts' => (int) ($row->statistic_correct_attempts ?? 0),
                    'statistic_correct_attempts_revert' => (int) ($row->statistic_correct_attempts_revert ?? 0),
                    'easy_correct' => (bool) ($row->easy_correct ?? false),
                    'easy_correct_revert' => (bool) ($row->easy_correct_revert ?? false),
                    'is_reset' => (bool) ($row->is_reset ?? false),
                    'created_at' => $now,
                    'updated_at' => $now,
                ];
            }

            if ($payload !== []) {
                UserDictionaryWord::query()->insert($payload);
            }

            $bar->advance(count($rows));
        });

        $bar->finish();
        $this->newLine();
    }

    private function importDenseSessions(string $connection): void
    {
        DenseTrainingSession::query()->delete();
        $rows = DB::connection($connection)->table('wp_dense_training_sessions')->orderBy('id')->get();
        $this->info('Importing dense sessions: '.$rows->count());

        foreach ($rows as $row) {
            $userId = $this->userMap[(int) $row->user_id] ?? null;
            if (! $userId) {
                continue;
            }

            DenseTrainingSession::query()->create([
                'user_id' => $userId,
                'dictionary_id' => (int) $row->dictionary_id,
                'category_id' => (int) $row->category_id,
                'dense_word_ids_direct' => $row->dense_word_ids_direct,
                'dense_review_word_ids_direct' => $row->dense_review_word_ids_direct,
                'dense_word_ids_revert' => $row->dense_word_ids_revert,
                'dense_review_word_ids_revert' => $row->dense_review_word_ids_revert,
                'attempts_left' => (int) $row->attempts_left,
                'waiting_since' => $this->nullableDate($row->waiting_since),
                'use_random' => (bool) $row->use_random,
                'created_at' => $this->nullableDate($row->created_at) ?? now(),
                'updated_at' => $this->nullableDate($row->updated_at) ?? now(),
            ]);
        }
    }

    private function nullableDate(mixed $value): ?string
    {
        if ($value === null || $value === '' || $value === '0000-00-00 00:00:00') {
            return null;
        }

        return (string) $value;
    }

    private function syncAutoIncrement(string $table): void
    {
        $max = (int) DB::table($table)->max('id');
        if ($max > 0) {
            DB::statement("ALTER TABLE {$table} AUTO_INCREMENT = ".($max + 1));
        }
    }
}
