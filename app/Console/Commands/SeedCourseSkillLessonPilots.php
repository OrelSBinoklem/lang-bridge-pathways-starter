<?php

namespace App\Console\Commands;

use App\Models\CourseGroup;
use App\Models\LessonBlock;
use App\Models\LessonPage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use RuntimeException;
use Throwable;

class SeedCourseSkillLessonPilots extends Command
{
    protected $signature = 'course:seed-skill-lesson-pilots';
    protected $description = 'Create missing editable five-variant skill lesson pilots for A1 groups 1 and 2';

    public function handle(): int
    {
        try {
            $scripts = $this->listeningScripts();
            $audio = $this->listeningAudio($scripts);
        } catch (Throwable $exception) {
            $this->error('Ошибка сценариев слушанья: ' . $exception->getMessage());
            return self::FAILURE;
        }

        $groups = CourseGroup::query()->whereIn('category_id', [1763, 1764])->get()->keyBy('category_id');
        if ($groups->count() !== 2) {
            $this->error('Не найдены обе пилотные группы курса: категории 1763 и 1764.');
            return self::FAILURE;
        }

        DB::transaction(function () use ($groups, $scripts, $audio) {
            $this->seedGroup($groups[1763], $this->introductionVariants(), '/course/categories/1763-v2.webp', $scripts['1763'], $audio['1763']);
            $this->seedGroup($groups[1764], $this->worldVariants(), '/course/categories/1764-v1.webp', $scripts['1764'], $audio['1764']);
        });

        $this->info('Пилотные уроки навыков созданы. Существующие вручную изменённые варианты не перезаписывались.');
        return self::SUCCESS;
    }

    /** @param list<array<string, string>> $facts @param list<array<string, mixed>> $listeningScripts @param array<string, array<string, mixed>> $audio */
    private function seedGroup(CourseGroup $group, array $facts, string $imageUrl, array $listeningScripts, array $audio): void
    {
        $prefix = "course-skill-pilot:{$group->category_id}";
        $listening = $this->page($group, 'listening', 'Слушанье: проверь, что услышал', "{$prefix}:listening");
        $reading = $this->page($group, 'reading', 'Чтение: пойми текст', "{$prefix}:reading");
        $writing = $this->page($group, 'writing', 'Письмо: ответь по теме', "{$prefix}:writing");
        $speaking = $this->page($group, 'speaking', 'Говорение: короткий диалог', "{$prefix}:speaking");

        $this->variants($this->block($listening, 'listening', 'Пойми аудиотекст', "{$prefix}:listening:binary"), $facts,
            function (array $fact, int $index) use ($listeningScripts, $audio) {
                $script = $listeningScripts[$index - 1];
                $recording = $audio["variant:{$index}"];
                $segments = array_map(fn (array $segment) => [
                    'speaker' => $segment[0], 'text' => $segment[1],
                ], $script['segments']);
                return [
                    'title' => "Вариант {$index}: {$script['title']}",
                    'legacy_title' => "Вариант {$index}: {$fact['name']}",
                    'config' => [
                        'task_kind' => 'listening',
                        'audio_url' => $recording['audio_url'],
                        'dialogue_segments' => $segments,
                        'speaker_profiles' => $script['speakers'],
                        'transcript' => $this->transcript($segments),
                        'audio_generation' => $recording['audio_generation'],
                        'questions' => array_map(fn (array $question) => [
                            'statement' => $question[0], 'correct' => $question[1], 'explanation' => $question[2],
                        ], $script['questions']),
                    ],
                    'replace_if_configs' => [
                        [
                            'task_kind' => 'listening',
                            'audio_url' => '/audio/synthesis/en/audio/hello.mp3',
                            'transcript' => $this->listeningText($fact),
                            'questions' => $this->questions($fact),
                        ],
                        [
                            'task_kind' => 'listening',
                            'audio_url' => null,
                            'dialogue_segments' => $this->dialogueSegments($fact),
                            'transcript' => $this->transcript($this->dialogueSegments($fact)),
                            'questions' => $this->dialogueQuestions($fact),
                        ],
                    ],
                ];
            });

        $this->variants($this->block($reading, 'reading', 'Прочитай и выбери «да» или «нет»', "{$prefix}:reading:binary"), $facts,
            fn (array $fact, int $index) => [
                'title' => "Вариант {$index}: {$fact['name']}",
                'config' => [
                    'task_kind' => 'reading_binary',
                    'text' => $this->readingText($fact),
                    'questions' => $this->questions($fact),
                ],
            ]);

        $this->variants($this->block($reading, 'reading', 'Перевод с латышского на русский', "{$prefix}:reading:translation"), $facts,
            fn (array $fact, int $index) => [
                'title' => "Вариант {$index}: перевод", 'config' => [
                    'task_kind' => 'lv_to_ru',
                    'source_text' => $this->translationSource($fact),
                    'reference_translation' => $this->translationReference($fact),
                ],
            ]);

        $writingPrompt = 'Веди только текущее письменное задание. Сначала коротко напомни цель по-русски, затем жди ответ на латышском. Проверь смысл, обязательные факты и базовую грамматику. Не пиши готовый ответ раньше попытки ученика. Если ученик выполнил все требования, вызови lesson.block.complete; если нет, дай одну короткую поправку и попроси улучшить ответ.';
        $this->variants($this->block($writing, 'writing', 'Перевод с русского на латышский', "{$prefix}:writing:ru-lv", true, $writingPrompt), $facts,
            fn (array $fact, int $index) => [
                'title' => "Вариант {$index}: перевод", 'config' => [
                    'task_kind' => 'ru_to_lv',
                    'topic' => 'Перевод на латышский',
                    'instruction' => "Переведи на латышский: «Меня зовут {$fact['name']}. Я из {$fact['country_ru']} и живу в {$fact['city_ru']}.»",
                    'tutor_prompt' => "Ожидай фразу с именем {$fact['name']}, страной {$fact['country']} и городом {$fact['city']}. Допускай естественные варианты, но проверь предлог no и форму города.",
                ],
            ]);
        $this->variants($this->block($writing, 'writing', 'Опиши изображение', "{$prefix}:writing:image", true, $writingPrompt), $facts,
            fn (array $fact, int $index) => [
                'title' => "Вариант {$index}: описание", 'config' => [
                    'task_kind' => 'image_description',
                    'topic' => 'Описание изображения',
                    'image_url' => $imageUrl,
                    'instruction' => "Опиши картинку 3-4 простыми предложениями на латышском. Упомяни {$fact['name']} и {$fact['city']}.",
                    'tutor_prompt' => 'Попроси 3-4 законченных простых предложения. Проверяй наличие имени, города и понятной связной мысли; не требуй дословного описания картинки.',
                ],
            ]);
        $this->variants($this->block($writing, 'writing', 'Составь вопросы', "{$prefix}:writing:questions", true, $writingPrompt), $facts,
            fn (array $fact, int $index) => [
                'title' => "Вариант {$index}: вопросы", 'config' => [
                    'task_kind' => 'question_formation',
                    'topic' => 'Вопросы о новом знакомом',
                    'instruction' => "Составь по-латышски три вопроса, чтобы узнать имя, страну и город {$fact['name']}.",
                    'tutor_prompt' => 'Проверь три разных вопроса: про имя, страну и город. Подскажи вопросительные слова Kā, No kurienes и Kur, но не пиши все готовые вопросы до попытки.',
                ],
            ]);

        $speakingPrompt = 'Веди текущий разговорный сценарий как доброжелательный латышский собеседник. Начни на русском одной короткой инструкцией, затем предложи ученику отвечать голосом или текстом на латышском. Не переключай тему. Исправляй только одну самую важную ошибку за ход. Когда ученик выполнил цели сценария, вызови lesson.block.complete.';
        $this->variants($this->block($speaking, 'speaking', 'Ролевая беседа', "{$prefix}:speaking:roleplay", true, $speakingPrompt), $facts,
            fn (array $fact, int $index) => [
                'title' => "Вариант {$index}: знакомство", 'config' => [
                    'task_kind' => 'roleplay',
                    'topic' => 'Знакомство',
                    'instruction' => "Познакомься с собеседником. Скажи, что тебя зовут {$fact['name']}, что ты из {$fact['country']} и живёшь в {$fact['city']}. Затем спроси собеседника о нём.",
                    'tutor_prompt' => "Играй нового знакомого. Дождись, чтобы ученик назвал имя, страну {$fact['country']} и город {$fact['city']}, а потом задал хотя бы один вопрос тебе.",
                ],
            ]);
        $this->variants($this->block($speaking, 'speaking', 'Задай вопросы вслух', "{$prefix}:speaking:questions", true, $speakingPrompt), $facts,
            fn (array $fact, int $index) => [
                'title' => "Вариант {$index}: вопросы", 'config' => [
                    'task_kind' => 'question_formation',
                    'topic' => 'Вопросы в разговоре',
                    'instruction' => "Спроси собеседника по-латышски, как его зовут, откуда он и где он живёт. Произнеси три вопроса.",
                    'tutor_prompt' => 'Отвечай на вопросы кратко и естественно. Засчитывай, когда ученик сформулировал три различимых вопроса по теме имени, страны и города.',
                ],
            ]);
    }

    private function page(CourseGroup $group, string $skill, string $suffix, string $seedKey): LessonPage
    {
        return LessonPage::firstOrCreate(['seed_key' => $seedKey], [
            'course_group_id' => $group->id,
            'title' => "{$group->display_title} - {$suffix}",
            'slug' => "course-{$group->category_id}-{$skill}",
            'level' => $group->level,
            'learn_lang' => $group->learn_lang,
            'skill' => $skill,
            'status' => 'published',
            'description' => null,
            'is_published' => true,
        ]);
    }

    private function block(LessonPage $page, string $type, string $title, string $seedKey, bool $required = true, ?string $botPrompt = null): LessonBlock
    {
        return $page->blocks()->firstOrCreate(['seed_key' => $seedKey], [
            'type' => $type,
            'title' => $title,
            'is_required' => $required,
            'weight' => $required ? 100 : 0,
            'position' => $page->blocks()->count() * 10 + 10,
            'bot_prompt' => $botPrompt,
            'config' => [],
        ]);
    }

    /** @param list<array<string, string>> $facts @param callable(array<string, string>, int): array{title: string, config: array<string, mixed>, legacy_title?: string, replace_if_configs?: list<array<string, mixed>>} $build */
    private function variants(LessonBlock $block, array $facts, callable $build): void
    {
        foreach ($facts as $offset => $fact) {
            $variant = $build($fact, $offset + 1);
            $record = $block->variants()->firstOrCreate(['seed_key' => "variant:" . ($offset + 1)], [
                'title' => $variant['title'],
                'position' => ($offset + 1) * 10,
                'config' => $variant['config'],
                'is_published' => true,
            ]);
            if (!$record->wasRecentlyCreated && isset($variant['replace_if_configs'])
                && in_array($record->config, $variant['replace_if_configs'], true)) {
                $updates = ['config' => $variant['config']];
                if ($record->title === ($variant['legacy_title'] ?? null)) {
                    $updates['title'] = $variant['title'];
                }
                $record->update($updates);
            }
        }
    }

    /** @return array<string, list<array<string, mixed>>> */
    private function listeningScripts(): array
    {
        $path = base_path('resources/course/listening-pilot-a1.json');
        $scripts = json_decode(File::get($path), true, 512, JSON_THROW_ON_ERROR);
        foreach (['1763', '1764'] as $categoryId) {
            if (!is_array($scripts[$categoryId] ?? null) || count($scripts[$categoryId]) !== 5) {
                throw new RuntimeException("Для категории {$categoryId} требуется пять сценариев.");
            }
            foreach ($scripts[$categoryId] as $script) {
                if (!is_string($script['title'] ?? null)
                    || !is_array($script['segments'] ?? null) || count($script['segments']) < 2
                    || !is_array($script['questions'] ?? null) || count($script['questions']) !== 10
                    || !isset($script['speakers']['a'], $script['speakers']['b'])) {
                    throw new RuntimeException("Неполный сценарий в категории {$categoryId}.");
                }
                $spokenCharacters = 0;
                $speakers = [];
                foreach ($script['segments'] as $segment) {
                    if (!is_array($segment) || count($segment) !== 2
                        || !in_array($segment[0], ['a', 'b'], true)
                        || !is_string($segment[1]) || trim($segment[1]) === '') {
                        throw new RuntimeException("Некорректная реплика в категории {$categoryId}.");
                    }
                    $speakers[$segment[0]] = true;
                    $spokenCharacters += mb_strlen($segment[1]);
                }
                if (count($speakers) !== 2 || $spokenCharacters > 2000) {
                    throw new RuntimeException("В сценарии категории {$categoryId} нужны два голоса и не более 2000 символов.");
                }
                $answers = [];
                foreach ($script['questions'] as $question) {
                    if (!is_array($question) || count($question) !== 3
                        || !is_string($question[0]) || !is_bool($question[1])
                        || !is_string($question[2])) {
                        throw new RuntimeException("Некорректный вопрос в категории {$categoryId}.");
                    }
                    $answers[] = $question[1];
                }
                if (count(array_filter($answers)) !== 5) {
                    throw new RuntimeException("В сценарии категории {$categoryId} нужно пять ответов «да» и пять «нет».");
                }
            }
        }
        return $scripts;
    }

    /** @param array<string, list<array<string, mixed>>> $scripts @return array<string, array<string, array<string, mixed>>> */
    private function listeningAudio(array $scripts): array
    {
        $manifest = json_decode(File::get(base_path('resources/course/listening-pilot-a1-audio.json')), true, 512, JSON_THROW_ON_ERROR);
        foreach ($scripts as $categoryId => $groupScripts) {
            foreach ($groupScripts as $offset => $script) {
                $key = 'variant:' . ($offset + 1);
                $recording = $manifest[$categoryId][$key] ?? null;
                $url = $recording['audio_url'] ?? null;
                $path = is_string($url) && str_starts_with($url, '/audio/course/listening/')
                    ? base_path('frontend/public' . $url) : null;
                $segments = array_map(fn (array $segment) => ['speaker' => $segment[0], 'text' => $segment[1]], $script['segments']);
                if (!$path || !File::exists($path)
                    || hash_file('sha256', $path) !== ($recording['file_sha256'] ?? null)
                    || hash('sha256', $this->transcript($segments)) !== ($recording['transcript_sha256'] ?? null)
                    || !is_array($recording['audio_generation'] ?? null)) {
                    throw new RuntimeException("Аудио {$categoryId}/{$key} отсутствует или не соответствует сценарию.");
                }
            }
        }
        return $manifest;
    }

    /** @return list<array<string, string>> */
    private function introductionVariants(): array
    {
        return [
            ['name' => 'Anna', 'country' => 'Latvijas', 'country_ru' => 'Латвии', 'city' => 'Rīgā', 'city_ru' => 'Риге', 'language' => 'latviski', 'friend' => 'Jānis'],
            ['name' => 'Jānis', 'country' => 'Latvijas', 'country_ru' => 'Латвии', 'city' => 'Liepājā', 'city_ru' => 'Лиепае', 'language' => 'latviski', 'friend' => 'Anna'],
            ['name' => 'Olga', 'country' => 'Ukrainas', 'country_ru' => 'Украины', 'city' => 'Rīgā', 'city_ru' => 'Риге', 'language' => 'krieviski', 'friend' => 'Māra'],
            ['name' => 'Māra', 'country' => 'Latvijas', 'country_ru' => 'Латвии', 'city' => 'Jelgavā', 'city_ru' => 'Елгаве', 'language' => 'latviski', 'friend' => 'Olga'],
            ['name' => 'Pēteris', 'country' => 'Igaunijas', 'country_ru' => 'Эстонии', 'city' => 'Rīgā', 'city_ru' => 'Риге', 'language' => 'igauņu valodā', 'friend' => 'Jānis'],
        ];
    }

    /** @return list<array<string, string>> */
    private function worldVariants(): array
    {
        return [
            ['name' => 'Iryna', 'country' => 'Ukrainas', 'country_ru' => 'Украины', 'city' => 'Rīgā', 'city_ru' => 'Риге', 'language' => 'ukrainiski', 'friend' => 'Anna'],
            ['name' => 'Toms', 'country' => 'Polijas', 'country_ru' => 'Польши', 'city' => 'Daugavpilī', 'city_ru' => 'Даугавпилсе', 'language' => 'poliski', 'friend' => 'Jānis'],
            ['name' => 'Sofija', 'country' => 'Vācijas', 'country_ru' => 'Германии', 'city' => 'Rīgā', 'city_ru' => 'Риге', 'language' => 'vāciski', 'friend' => 'Māra'],
            ['name' => 'Luka', 'country' => 'Lietuvas', 'country_ru' => 'Литвы', 'city' => 'Ventspilī', 'city_ru' => 'Вентспилсе', 'language' => 'lietuviešu valodā', 'friend' => 'Olga'],
            ['name' => 'Emīlija', 'country' => 'Somijas', 'country_ru' => 'Финляндии', 'city' => 'Liepājā', 'city_ru' => 'Лиепае', 'language' => 'somiski', 'friend' => 'Pēteris'],
        ];
    }

    /** @param array<string, string> $fact */
    private function listeningText(array $fact): string
    {
        return "Sveiki! Mani sauc {$fact['name']}. Es esmu no {$fact['country']}, bet tagad dzīvoju {$fact['city']}. Es runāju {$fact['language']} un mācos latviešu valodu. Mans draugs ir {$fact['friend']}. Mēs bieži runājam un dzeram tēju kopā.";
    }

    /** @param array<string, string> $fact @return list<array{speaker: string, text: string}> */
    private function dialogueSegments(array $fact): array
    {
        return [
            ['speaker' => 'a', 'text' => "Sveiki! Mani sauc {$fact['friend']}. Kā tevi sauc?"],
            ['speaker' => 'b', 'text' => "Sveiki! Mani sauc {$fact['name']}."],
            ['speaker' => 'a', 'text' => 'No kurienes tu esi?'],
            ['speaker' => 'b', 'text' => "Es esmu no {$fact['country']}, bet tagad dzīvoju {$fact['city']}."],
            ['speaker' => 'a', 'text' => 'Kādā valodā tu runā?'],
            ['speaker' => 'b', 'text' => "Es runāju {$fact['language']} un mācos latviešu valodu."],
            ['speaker' => 'a', 'text' => 'Prieks iepazīties! Mēs varam būt draugi. Rīt dzersim tēju?'],
            ['speaker' => 'b', 'text' => "Jā, {$fact['friend']}, ar prieku!"],
        ];
    }

    /** @param array<string, string> $fact */
    private function transcript(array $segments): string
    {
        return implode("\n", array_map(
            fn (array $segment) => strtoupper($segment['speaker']) . ': ' . $segment['text'],
            $segments,
        ));
    }

    /** @param array<string, string> $fact @return list<array{statement: string, correct: bool, explanation: string}> */
    private function dialogueQuestions(array $fact): array
    {
        return [
            ['statement' => "Otru sarunas biedru sauc {$fact['name']}.", 'correct' => true, 'explanation' => 'Viņš vai viņa nosauc savu vārdu.'],
            ['statement' => "{$fact['name']} ir no {$fact['country']}.", 'correct' => true, 'explanation' => 'Viņš vai viņa saka, no kurienes ir.'],
            ['statement' => "{$fact['name']} dzīvo {$fact['city']}.", 'correct' => true, 'explanation' => 'Sarunā ir nosaukta dzīvesvieta.'],
            ['statement' => "{$fact['name']} runā {$fact['language']}.", 'correct' => true, 'explanation' => 'Sarunā ir nosaukta valoda.'],
            ['statement' => "{$fact['name']} mācās latviešu valodu.", 'correct' => true, 'explanation' => 'To saka otrais sarunas biedrs.'],
            ['statement' => "{$fact['name']} dzīvo Amerikā.", 'correct' => false, 'explanation' => 'Ir nosaukta cita dzīvesvieta.'],
            ['statement' => "{$fact['name']} nemācās latviešu valodu.", 'correct' => false, 'explanation' => 'Sarunā teikts pretējais.'],
            ['statement' => "Pirmo sarunas biedru sauc {$fact['name']}.", 'correct' => false, 'explanation' => "Pirmo sarunas biedru sauc {$fact['friend']}."],
            ['statement' => 'Viņi nolemj dzert tēju šodien.', 'correct' => false, 'explanation' => 'Viņi runā par rītdienu.'],
            ['statement' => 'Viņi atsakās būt draugi.', 'correct' => false, 'explanation' => 'Viņi priecājas par iepazīšanos.'],
        ];
    }

    /** @param array<string, string> $fact */
    private function readingText(array $fact): string
    {
        return "{$this->listeningText($fact)} Šodien {$fact['name']} ir mājās, jo vakar bija darbā. Rīt {$fact['name']} ies uz pilsētu un satiks {$fact['friend']}.";
    }

    /** @param array<string, string> $fact */
    private function translationSource(array $fact): string
    {
        return "Mani sauc {$fact['name']}. Es esmu no {$fact['country']}, bet dzīvoju {$fact['city']}. Es mācos latviešu valodu.";
    }

    /** @param array<string, string> $fact */
    private function translationReference(array $fact): string
    {
        return "Меня зовут {$fact['name']}. Я из {$fact['country_ru']}, но живу в {$fact['city_ru']}. Я учу латышский язык.";
    }

    /** @param array<string, string> $fact @return list<array{statement: string, correct: bool, explanation: string}> */
    private function questions(array $fact): array
    {
        return [
            ['statement' => "Personu sauc {$fact['name']}.", 'correct' => true, 'explanation' => 'Tas ir teikts tekstā.'],
            ['statement' => "{$fact['name']} ir no {$fact['country']}.", 'correct' => true, 'explanation' => 'Tas ir teikts tekstā.'],
            ['statement' => "{$fact['name']} dzīvo {$fact['city']}.", 'correct' => true, 'explanation' => 'Tas ir teikts tekstā.'],
            ['statement' => "{$fact['name']} runā {$fact['language']}.", 'correct' => true, 'explanation' => 'Tas ir teikts tekstā.'],
            ['statement' => "{$fact['name']} mācas latviešu valodu.", 'correct' => true, 'explanation' => 'Tas ir teikts tekstā.'],
            ['statement' => "{$fact['name']} draugs ir {$fact['friend']}.", 'correct' => true, 'explanation' => 'Tas ir teikts tekstā.'],
            ['statement' => "{$fact['name']} dzīvo Amerikā.", 'correct' => false, 'explanation' => 'Tekstā ir nosaukta cita pilsēta.'],
            ['statement' => "{$fact['name']} nemācās latviešu valodu.", 'correct' => false, 'explanation' => 'Tekstā teikts pretējais.'],
            ['statement' => "{$fact['name']} draugs ir skolotājs.", 'correct' => false, 'explanation' => 'Tekstā tas nav teikts.'],
            ['statement' => "{$fact['name']} runā tikai angliski.", 'correct' => false, 'explanation' => 'Tekstā ir nosaukta cita valoda.'],
        ];
    }
}
