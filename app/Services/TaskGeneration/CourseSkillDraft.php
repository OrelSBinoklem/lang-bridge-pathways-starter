<?php

namespace App\Services\TaskGeneration;

use Illuminate\Support\Facades\Validator;
use RuntimeException;

/** Authored reading/writing/speaking packages use the existing lesson block contracts. */
class CourseSkillDraft
{
    public function validate(array $draft, array $allowedWordIds): void
    {
        $rules = [
            'schema_version' => 'required|integer|in:1',
            'category_id' => 'required|integer|min:1', 'dictionary_id' => 'required|integer|min:1',
            'level' => 'required|in:A1,A2,B1,B2', 'elaipa_topic' => 'required|string',
            'image_url' => 'required|string', 'image_facts' => 'required|string',
            'variants' => 'required|array|size:5',
            'variants.*.title' => 'required|string|distinct',
            'variants.*.target_word_ids' => 'required|array|min:1',
            'variants.*.target_word_ids.*' => 'required|integer',
            'variants.*.reading.text' => 'required|string',
            'variants.*.reading.questions' => 'required|array|min:3|max:10',
            'variants.*.reading.questions.*' => 'required|array|size:3',
            'variants.*.reading.questions.*.0' => 'required|string',
            'variants.*.reading.questions.*.1' => 'required|boolean',
            'variants.*.reading.questions.*.2' => 'required|string',
        ];
        foreach (['translation.lv', 'translation.ru', 'writing_translation.lv', 'writing_translation.ru',
            'image.instruction', 'image.prompt', 'questions.instruction', 'questions.prompt',
            'roleplay.instruction', 'roleplay.prompt', 'speaking_questions.instruction', 'speaking_questions.prompt'] as $field) {
            $rules['variants.*.'.$field] = 'required|string';
        }
        Validator::make($draft, $rules)->validate();
        if (!preg_match('#^/course/[a-zA-Z0-9/_-]+\.(webp|png|jpg)$#D', $draft['image_url']) || !is_file(base_path('frontend/public'.$draft['image_url']))) {
            throw new RuntimeException('The task illustration must be an existing local course asset.');
        }
        foreach ($draft['variants'] as $index => $variant) {
            if (array_diff($variant['target_word_ids'], $allowedWordIds)) throw new RuntimeException('Unknown target vocabulary in variant '.($index + 1));
            $questions = $variant['reading']['questions'];
            if (!array_is_list($questions) || count(array_unique(array_column($questions, 0))) !== count($questions)
                || array_filter($questions, fn ($q) => !is_bool($q[1]))
                || abs(2 * count(array_filter($questions, fn ($q) => $q[1] === true)) - count($questions)) > 1) {
                throw new RuntimeException('Reading requires three to ten distinct statements with balanced boolean true/false answers.');
            }
        }
    }

    /** @return array<string, array{title: string, blocks: array}> */
    public function pages(array $draft): array
    {
        $writingPrompt = 'Работай только с текущим заданием A1. Дождись ответа ученика на латышском, не выдавай готовый ответ заранее. Принимай естественные перефразирования и проверяй смысл. Объясняй по-русски одну существенную ошибку за ход, затем проси исправить. Следуй существующему механизму завершения задания; не выдумывай проценты, ранг или сохранённый результат. Не создавай новый вариант задания.';
        $speakingPrompt = 'Веди короткую ролевую беседу A1 на латышском в рамках текущего задания. При необходимости объясняй по-русски. Задавай по одному вопросу, жди реплики ученика. Не произноси обе роли за ученика и не раскрывай все ответы заранее. Принимай голосовой или текстовый ответ. Исправляй одну важную ошибку за ход. Следуй существующему механизму завершения; не придумывай проценты или ранг и не генерируй новое задание.';
        if ($draft['level'] !== 'A1') {
            $level = $draft['level'];
            $shared = ' Используй сохранённый вариант и его цели, не генерируй новое задание. Пассивный запас предполагается по текущей и предыдущим темам, фактическое знание слов ученика неизвестно. Принимай естественные грамматически правильные перефразирования. Не раскрывай эталон до попытки. Объясняй на языке интерфейса ученика. Исправляй одну существенную ошибку за ход и проси исправить. Используй существующий механизм завершения; не выдумывай проценты, ранг или сохранённый результат.';
            $writingPrompt = "Проверяй письменное задание уровня {$level}. Дождись самостоятельного ответа на латышском. Проверяй выполнение коммуникативных целей, связность и уместные формы, а не редкость слов.".$shared;
            $speakingPrompt = "Веди ролевую беседу уровня {$level} на латышском по сохранённому сценарию. Соблюдай имя и пол персонажа. Задавай один вопрос за ход и жди ответа; не говори за ученика. Принимай голосовой или текстовый ответ. Используй более простую продуктивную лексику, чем в чтении.".$shared;
        }
        $translationCheck = $draft['level'] === 'A1'
            ? ' Проверь передачу всех трёх предложений и формы после предлогов; принимай другие грамматически правильные варианты.'
            : ' Проверь передачу всех смысловых частей и грамматику; принимай естественные варианты, не требуй дословного совпадения.';
        $block = fn ($key, $title, $required, $prompt, $build) => [
            'key' => $key, 'title' => $title, 'is_required' => $required, 'bot_prompt' => $prompt,
            'variants' => array_map(fn ($variant) => ['title' => $variant['title'], 'config' => $build($variant)], $draft['variants']),
        ];
        $practice = fn ($kind, $source, $variant) => [
            'task_kind' => $kind, 'topic' => $variant['title'],
            'instruction' => $variant[$source]['instruction'], 'tutor_prompt' => $variant[$source]['prompt'],
        ];

        return [
            'reading' => ['title' => 'Чтение: пойми текст', 'blocks' => [
                $block('binary', 'Прочитай и выбери «да» или «нет»', true, null, fn ($v) => [
                    'task_kind' => 'reading_binary', 'text' => $v['reading']['text'],
                    'questions' => array_map(fn ($q) => ['statement' => $q[0], 'correct' => $q[1], 'explanation' => $q[2]], $v['reading']['questions']),
                ]),
                $block('translation', 'Перевод с латышского на русский', false, null, fn ($v) => [
                    'task_kind' => 'lv_to_ru', 'source_text' => $v['translation']['lv'], 'reference_translation' => $v['translation']['ru'],
                ]),
            ]],
            'writing' => ['title' => $draft['writing_title'] ?? 'Письмо: город и деревня', 'blocks' => [
                $block('ru-lv', 'Перевод с русского на латышский', true, $writingPrompt, fn ($v) => [
                    'task_kind' => 'ru_to_lv', 'topic' => $v['title'],
                    'instruction' => 'Переведи на латышский: '.$v['writing_translation']['ru'],
                    'tutor_prompt' => 'Эталон для проверки, не выдавай его до попытки: '.$v['writing_translation']['lv'].$translationCheck,
                ]),
                $block('image', 'Опиши изображение', true, $writingPrompt, fn ($v) => [
                    ...$practice('image_description', 'image', $v), 'image_url' => $draft['image_url'],
                    'tutor_prompt' => $v['image']['prompt'].' Проверенные факты изображения: '.$draft['image_facts'],
                ]),
                $block('questions', 'Составь вопросы', true, $writingPrompt, fn ($v) => $practice('question_formation', 'questions', $v)),
            ]],
            'speaking' => ['title' => $draft['speaking_title'] ?? 'Говорение: город и деревня', 'blocks' => [
                $block('roleplay', 'Ролевая беседа', true, $speakingPrompt, fn ($v) => $practice('roleplay', 'roleplay', $v)),
                $block('questions', 'Задай вопросы вслух', true, $speakingPrompt, fn ($v) => $practice('question_formation', 'speaking_questions', $v)),
            ]],
        ];
    }
}
