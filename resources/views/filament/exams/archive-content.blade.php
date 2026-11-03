@php
    $content = $getState() ?? [];
    $skills = ['listening' => 'Слушание', 'reading' => 'Чтение', 'writing' => 'Письмо', 'speaking' => 'Говорение'];
@endphp
<div style="display:grid;gap:1rem;min-width:0;overflow-wrap:anywhere">
    @foreach ($content['sections'] ?? [] as $section)
        <details style="border-top:1px solid #9ca3af;padding-top:0.75rem">
            <summary style="cursor:pointer;font-weight:600">
                {{ $skills[$section['skill']] ?? $section['skill'] }} · {{ $section['seconds'] / 60 }} мин
            </summary>
            @foreach ($section['tasks'] as $task)
                <section style="padding-top:1rem">
                    <h3 style="font-weight:600">{{ $task['title'] }}</h3>
                    @if (!empty($task['text'])) <p lang="lv" style="white-space:pre-wrap;margin-top:0.5rem">{{ $task['text'] }}</p> @endif
                    @if (!empty($task['transcript']))
                        <details style="margin-top:0.5rem"><summary>Текст записи</summary><p lang="lv" style="white-space:pre-wrap">{{ $task['transcript'] }}</p></details>
                    @endif
                    @if (!empty($task['audio_path']))
                        <p style="overflow-wrap:anywhere">Аудио: <code>{{ $task['audio_path'] }}</code></p>
                        @isset($getRecord)
                            <a href="{{ route('admin.exam-archives.audio', ['archive' => $getRecord()->id, 'taskId' => $task['id']]) }}" style="text-decoration:underline">Скачать запись</a>
                        @endisset
                    @endif
                    @if (!empty($task['image'])) <p style="overflow-wrap:anywhere">Изображение: <code>{{ $task['image'] }}</code></p> @endif
                    <ol style="display:grid;gap:0.75rem;margin-top:0.75rem">
                        @foreach ($task['questions'] as $question)
                            <li>
                                <p lang="lv" style="font-weight:500;white-space:pre-wrap">{{ $question['prompt'] }}</p>
                                <small>{{ $question['id'] }} · {{ $question['points'] }} балл.</small>
                                @if ($question['type'] === 'choice')
                                    <ul>
                                        @foreach ($question['options'] as $option)
                                            <li lang="lv">{{ $option['id'] === $question['correct'] ? '✓' : '·' }} {{ $option['text'] }}</li>
                                        @endforeach
                                    </ul>
                                @elseif (!empty($question['accepted']))
                                    <p lang="lv">Ответ: {{ implode(' / ', $question['accepted']) }}</p>
                                @endif
                                @if (!empty($question['explanation'])) <p lang="lv">Комментарий: {{ $question['explanation'] }}</p> @endif
                                @foreach ($question['explanation_translations'] ?? [] as $language => $translation)
                                    <p lang="{{ $language }}">{{ strtoupper($language) }}: {{ $translation }}</p>
                                @endforeach
                                @if (!empty($question['rubric'])) <details><summary>Критерии оценки</summary><p style="white-space:pre-wrap">{{ $question['rubric'] }}</p></details> @endif
                            </li>
                        @endforeach
                    </ol>
                </section>
            @endforeach
        </details>
    @endforeach
</div>
