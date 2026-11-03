<div>
    <p>{{ $attempt->student_name }} · {{ $attempt->snapshot['level'] }} · {{ $attempt->status }}</p>
    @foreach ($attempt->snapshot['sections'] as $index => $section)
        <h3 style="margin-top:1.5rem;font-weight:700">{{ $section['skill'] }}</h3>
        @foreach ($section['tasks'] as $task)
            <h4>{{ $task['title'] }}</h4>
            <p style="white-space:pre-wrap">{{ $task['text'] ?? '' }}</p>
            @foreach ($task['questions'] as $question)
                <div style="padding:0.75rem 0;border-bottom:1px solid #8885">
                    <strong>{{ $question['prompt'] }}</strong>
                    @php($answer = $attempt->answers[$question['id']]['text'] ?? '')
                    <p style="white-space:pre-wrap">{{ collect($question['options'] ?? [])->firstWhere('id', $answer)['text'] ?? ($answer ?: 'Нет ответа') }}</p>
                    <p>{{ $attempt->results[$index]['answers'][$question['id']]['points'] ?? '—' }} / {{ $question['points'] }}</p>
                    <p>{{ $attempt->results[$index]['answers'][$question['id']]['feedback'] ?? '' }}</p>
                </div>
            @endforeach
        @endforeach
    @endforeach
</div>
