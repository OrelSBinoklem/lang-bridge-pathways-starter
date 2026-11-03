<?php

namespace Tests\Feature;

use App\Console\Commands\PublishCourseListeningRevision;
use App\Console\Commands\TrimCourseListeningQuestions;
use App\Console\Commands\TrimCourseReadingQuestions;
use Illuminate\Database\Connection;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use PHPUnit\Framework\Attributes\DataProvider;

class TrimCourseReadingQuestionsTest extends TrimCourseListeningQuestionsTest
{
    protected const SKILL = 'reading';

    protected const COMMAND_CLASS = TrimCourseReadingQuestions::class;

    protected const EVIDENCE_PREFIX = "Tekst\u{0101}: ";

    protected function setUp(): void
    {
        parent::setUp();
        foreach (range(1, 4) as $page) {
            $block = 100 + $page;
            DB::table('lesson_blocks')->insert(['id' => $block, 'lesson_page_id' => $page, 'type' => 'reading',
                'config' => '{"block":"translation untouched"}', 'bot_prompt' => 'translation prompt']);
            foreach (range(0, 4) as $position) {
                DB::table('lesson_block_variants')->insert([
                    'id' => 1000 + $page * 10 + $position, 'lesson_block_id' => $block,
                    'title' => 'Translation '.$position, 'seed_key' => 'translation:'.$position, 'position' => $position,
                    'config' => $this->encodeJson(['task_kind' => 'lv_to_ru', 'source_text' => 'Anna lasa gramatu.',
                        'reference_translation' => 'Unchanged reference translation', 'authoring' => ['ids' => [19, 23]]]),
                    'is_published' => true, 'practice_archived_at' => $position === 0 ? '2026-01-01 00:00:00' : null,
                    'created_at' => '2020-01-01 00:00:00', 'updated_at' => '2020-01-01 00:00:00',
                ]);
            }
            // Linked placements and unpublished variants must never enter the active scope.
            DB::table('lesson_blocks')->insert(['id' => 200 + $page, 'lesson_page_id' => $page,
                'type' => 'reading', 'source_block_id' => $page, 'config' => '{"source":"untouched"}']);
            DB::table('lesson_block_variants')->insert(['id' => 2000 + $page, 'lesson_block_id' => 200 + $page,
                'title' => 'Linked source', 'seed_key' => 'source:'.$page, 'config' => $this->encodeJson($this->fixtureConfig()),
                'is_published' => true]);
            DB::table('lesson_block_variants')->insert(['id' => $page * 10 + 5, 'lesson_block_id' => $page,
                'title' => 'Unpublished', 'seed_key' => 'unpublished:'.$page, 'position' => -1,
                'config' => '{"task_kind":"unpublished sentinel"}', 'is_published' => false]);
        }
        DB::table('lesson_block_progress')->insert(['user_id' => 5, 'lesson_block_id' => 101,
            'best_score' => 85, 'best_rank' => 'gold', 'assisted_variant_ids' => '[1011]']);
        DB::table('lesson_block_attempts')->insert(['user_id' => 5, 'lesson_block_id' => 101,
            'lesson_block_variant_id' => 1011, 'answer' => '"private translation"', 'score' => 85, 'rank' => 'gold',
            'scored_at' => '2026-01-01 00:00:00']);
        foreach ($this->pack['entries'] as &$entry) {
            $entry['explanation_evidence'] = [];
        }
    }

    protected function fixtureConfig(): array
    {
        return array_replace(parent::fixtureConfig(), [
            'task_kind' => 'reading_binary', 'text' => "Mani sauc Anna. J\u{0101}nis lasa tekstu. Anna brauc uz skolu. Autobusam p\u{0113}c saraksta bija j\u{0101}atiet pulksten trijos. Tas aties tikai \u{010D}etros.",
            'text_translations' => ['ru' => 'Existing Russian text', 'uk' => 'Existing Ukrainian text'],
        ]);
    }

    protected function concurrentCommand(string $kind): TrimCourseListeningQuestions
    {
        return new class($kind) extends TrimCourseReadingQuestions
        {
            public function __construct(private string $kind) { parent::__construct(); }

            protected function preflight(Connection $connection, array $entries, bool $lock = false): array
            {
                $plan = parent::preflight($connection, $entries, $lock);
                if (! $lock) {
                    $change = match ($this->kind) {
                        'title' => ['title' => 'Concurrent private title'],
                        'active_scope' => ['practice_archived_at' => '2026-01-01 00:00:00'],
                        default => ['config' => '{"private":"concurrent configuration"}'],
                    };
                    $connection->table('lesson_block_variants')->where('id', 43)->update($change);
                }

                return $plan;
            }
        };
    }

    public function test_noncontiguous_keep_and_evidence_use_original_indices_and_parallel_assistance(): void
    {
        $this->pack['entries'][0]['keep'] = [2, 3, 5, 7, 10];
        $this->rehash();
        $before = $this->snapshot();
        $this->assertSame(0, $this->runCommand(), $this->commandOutput);
        $this->assertStringContainsString('changed=12', $this->commandOutput);
        $row = DB::table('lesson_block_variants')->find(11);
        $config = json_decode($row->config, true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame(['Assisted 2', 'Assisted 3', 'Assisted 5', 'Assisted 7', 'Assisted 10'], $config['assisted_questions']);
        $this->assertSame(['Explanation 2', 'Explanation 3', 'Explanation 5', 'Explanation 7', 'Explanation 10'], array_column($config['questions'], 'explanation'));
        $this->assertSame([2, 3, 5, 7, 10], array_column(array_column($config['questions'], 'retained_metadata'), 'index'));
        unset($config['questions'], $config['assisted_questions']);
        $original = $this->pack['entries'][0]['before']['config'];
        unset($original['questions'], $original['assisted_questions']);
        $this->assertEquals(json_decode($this->encodeJson($original), true), $config);
        $after = $this->snapshot();
        foreach ($before as $table => $rows) {
            if ($table !== 'lesson_block_variants') {
                $this->assertSame($rows, $after[$table], $table);
            }
        }
        $active = array_column($this->pack['entries'], 'variant_id');
        foreach ($before['lesson_block_variants'] as $index => $variant) {
            if (! in_array($variant['id'], $active, true)) {
                $this->assertSame($variant, $after['lesson_block_variants'][$index]);
            }
        }
        $this->assertSame(0, $this->runCommand(), $this->commandOutput);
        $this->assertStringContainsString('already_applied=12', $this->commandOutput);
        $this->assertSame($after, $this->snapshot());
    }

    public static function wrongManifestKinds(): array
    {
        return [['lv_to_ru'], ['listening'], ['exam_reading'], [null], [42], [['reading_binary']]];
    }

    #[DataProvider('wrongManifestKinds')]
    public function test_wrong_kind_injection_is_rejected_even_with_matching_hashes(mixed $kind): void
    {
        $this->pack['entries'][0]['before']['config']['task_kind'] = $kind;
        DB::table('lesson_block_variants')->where('id', 11)->update([
            'config' => $this->encodeJson($this->pack['entries'][0]['before']['config']),
        ]);
        $this->rehash();
        $this->assertRejectedWithoutWrites('Reading requires');
    }

    public static function malformedScopeKinds(): array
    {
        $cases = [];
        foreach ([11, 1011] as $id) {
            foreach (['{}', 'null', '[]', '"reading_binary"', '{invalid', '{"task_kind":null}',
                '{"task_kind":["reading_binary"]}', '{"task_kind":"exam_reading"}',
                $id === 11 ? '{"task_kind":"lv_to_ru"}' : '{"task_kind":"reading_binary"}'] as $config) {
                $cases[] = [$id, $config];
            }
        }

        return $cases;
    }

    #[DataProvider('malformedScopeKinds')]
    public function test_malformed_or_mixed_active_kinds_cannot_be_silently_omitted(int $id, string $config): void
    {
        DB::table('lesson_block_variants')->where('id', $id)->update(['config' => $config]);
        if ($id === 11) {
            array_shift($this->pack['entries']);
        }
        $this->assertRejectedWithoutWrites();
        $this->assertStringNotContainsString('Manifest must match', $this->commandOutput);
    }

    public static function excludedVariants(): array
    {
        return [[1011, 101], [1010, 101], [1014, 101], [2001, 201], [15, 1]];
    }

    #[DataProvider('excludedVariants')]
    public function test_translation_source_and_unpublished_variants_cannot_be_injected(int $id, int $block): void
    {
        $entry = $this->pack['entries'][0];
        $entry['variant_id'] = $id;
        $entry['block_id'] = $block;
        $this->pack['entries'][] = $entry;
        $this->assertRejectedWithoutWrites('exact complete active reading variant scope');
    }

    public static function validReadingEvidence(): array
    {
        $quotes = ["Autobusam p\u{0113}c saraksta bija j\u{0101}atiet pulksten trijos.", "Tas aties tikai \u{010D}etros."];

        return [[range(1, 10), $quotes], [[2, 4, 5, 7, 10], $quotes],
            [[2, 4, 5, 7, 10], ['Anna brauc uz skolu.']],
            [[2, 4, 5, 7, 10], [...$quotes, 'Mani sauc Anna.']]];
    }

    #[DataProvider('validReadingEvidence')]
    public function test_exact_reading_quotes_change_only_retained_explanation_and_are_idempotent(array $keep, array $quotes): void
    {
        foreach ($this->pack['entries'] as &$entry) {
            $entry['keep'] = range(1, 10);
        }
        unset($entry);
        $this->pack['entries'][0]['keep'] = $keep;
        $this->pack['entries'][0]['explanation_evidence'] = [['index' => 4, 'quotes' => $quotes]];
        $this->rehash();
        $before = $this->snapshot();
        $this->assertSame(0, $this->runCommand(), $this->commandOutput);
        $this->assertStringContainsString('changed=1 kept=11', $this->commandOutput);
        $after = $this->snapshot();
        $expected = $before;
        foreach ($expected['lesson_block_variants'] as &$row) {
            if ($row['id'] === 11) {
                $row['config'] = PublishCourseListeningRevision::canonicalJson($this->expectedAfter($this->pack['entries'][0])['config']);
                $row['updated_at'] = DB::table('lesson_block_variants')->find(11)->updated_at;
            }
        }
        unset($row);
        $this->assertSame($expected, $after);
        $config = json_decode(DB::table('lesson_block_variants')->find(11)->config, true);
        $this->assertSame("Tekst\u{0101}: ".implode(' / ', $quotes), $config['questions'][array_search(4, $keep, true)]['explanation']);
        $this->assertSame('Explanation 4', $this->pack['entries'][0]['before']['config']['questions'][3]['explanation']);
        $backups = $this->backups();
        $this->assertCount(1, $backups);
        $backup = json_decode(File::get($backups[0]), false, 512, JSON_THROW_ON_ERROR);
        $this->assertSame(11, $backup->entries[0]->variant_id);
        $this->assertSame($this->pack['entries'][0]['before_sha256'], PublishCourseListeningRevision::fingerprint($backup->entries[0]->before));
        $this->assertSame(0, $this->runCommand(), $this->commandOutput);
        $this->assertStringContainsString('already_applied=1', $this->commandOutput);
        $this->assertSame($after, $this->snapshot());
        $this->assertSame($backups, $this->backups());
    }

    public static function invalidReadingQuotes(): array
    {
        return [['Invented reading quote.'], ['Autobuss pienak septinos.'], ['Es esmu Janis.'],
            ['anna brauc uz skolu.'], ['Existing Russian text'], ['Unchanged reference translation']];
    }

    #[DataProvider('invalidReadingQuotes')]
    public function test_evidence_must_come_from_reading_text_not_transcript_dialogue_or_translation(string $quote): void
    {
        $this->pack['entries'][0]['explanation_evidence'] = [['index' => 1, 'quotes' => [$quote]]];
        $this->rehash();
        $this->assertRejectedWithoutWrites('Evidence quotes must be nonempty verbatim');
    }

    public function test_omitted_evidence_is_accepted_without_changing_explanations(): void
    {
        foreach ($this->pack['entries'] as &$entry) {
            unset($entry['explanation_evidence']);
        }
        unset($entry);
        $this->assertSame(0, $this->runCommand(), $this->commandOutput);
        $config = json_decode(DB::table('lesson_block_variants')->find(11)->config, true);
        $this->assertSame(
            PublishCourseListeningRevision::canonicalJson(array_slice($this->pack['entries'][0]['before']['config']['questions'], 0, 5)),
            PublishCourseListeningRevision::canonicalJson($config['questions'])
        );
    }

    public function test_reading_rejects_listening_manifest_root(): void
    {
        $root = $this->temporary.'/resources/course/listening-revisions';
        File::ensureDirectoryExists($root);
        File::put($root.'/manifest.json', $this->encodeJson($this->pack));
        $before = $this->snapshot();
        $this->assertSame(1, Artisan::call($this->commandName(), ['manifest' => $root.'/manifest.json', '--apply' => true]));
        $this->assertSame($before, $this->snapshot());
        $this->assertSame([], $this->backups());
    }

    private function assertRejectedWithoutWrites(?string $message = null): void
    {
        $before = $this->snapshot();
        $this->assertSame(1, $this->runCommand(), $this->commandOutput);
        $this->assertSame($before, $this->snapshot());
        $this->assertSame([], $this->backups());
        if ($message !== null) {
            $this->assertStringContainsString($message, $this->commandOutput);
        }
    }
}
