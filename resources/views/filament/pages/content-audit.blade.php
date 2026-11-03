<x-filament-panels::page>
    <style>
        .ca-controls{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}.ca-field{display:flex;flex-direction:column;gap:6px;font-size:14px;min-width:0}
        .ca-field select{width:100%;min-width:0;border:1px solid #cbd5e1;border-radius:6px;padding:9px;background:#fff;color:#18212d;font:inherit}
        .ca-note{color:#64748b;font-size:14px;line-height:1.6}.ca-charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}
        .ca-strip{display:flex;flex-wrap:wrap;gap:12px 28px;border-block:1px solid #cbd5e1;padding:16px 0}.ca-section{padding:20px 0;border-top:1px solid #cbd5e1}.ca-section h2{font-size:18px;font-weight:600;margin-bottom:12px}
        .ca-scroll{overflow-x:auto}.ca-table{width:100%;border-collapse:collapse;font-size:14px}.ca-table th,.ca-table td{text-align:left;padding:9px 12px;border-bottom:1px solid #e2e8f0}.ca-table th{background:#f1f5f9}.ca-table td:first-child{min-width:180px}
        .ca-text{white-space:pre-wrap;line-height:2;overflow-wrap:anywhere}.ca-text button{border-bottom:2px solid var(--ca-color);padding:0 2px;color:inherit;border-radius:2px}.ca-text button:hover,.ca-text button:focus-visible{background:#dbeafe;outline:2px solid #2563eb}
        .ca-detail{border-left:3px solid #2563eb;padding:12px 18px;background:#f8fafc;margin:16px 0}.ca-detail ul{padding-left:18px;list-style:disc}.ca-dot{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:6px}
        .ca-wordlist{display:flex;flex-wrap:wrap;gap:8px}.ca-wordlist button{font-size:14px;padding:5px 8px;border:1px solid #cbd5e1;border-radius:4px}
        .dark .ca-field select{background:#18181b;color:#fafafa;border-color:#52525b}.dark .ca-table th{background:#27272a}.dark .ca-table td,.dark .ca-section,.dark .ca-strip{border-color:#52525b}.dark .ca-detail{background:#27272a}.dark .ca-text button:hover,.dark .ca-text button:focus-visible{background:#1e3a5f}.dark .ca-note{color:#a1a1aa}
        @media(max-width:900px){.ca-charts{grid-template-columns:minmax(0,1fr)}.ca-controls{grid-template-columns:repeat(2,minmax(0,1fr))}}
        @media(max-width:540px){.ca-controls{grid-template-columns:minmax(0,1fr)}}
    </style>
    <div class="ca-controls">
        <label class="ca-field">Страница задания<select wire:model.live="lesson"><option value="">Выберите страницу</option>@foreach($this->lessons as $id=>$label)<option value="{{ $id }}">{{ $label }}</option>@endforeach</select></label>
        <label class="ca-field">Блок<select wire:model.live="block"><option value="">Первый блок</option>@foreach($this->pageRecord?->blocks ?? [] as $item)<option value="{{ $item->id }}">{{ $item->title ?: $item->type }}</option>@endforeach</select></label>
        <label class="ca-field">Вариант<select wire:model.live="variant"><option value="">Первый вариант</option>@foreach($this->variants as $id=>$label)<option value="{{ $id }}">{{ $label }}</option>@endforeach</select></label>
        <label class="ca-field">Состав текста<select wire:model.live="scope"><option value="body">Основной текст и инструкция</option><option value="all">Также вопросы, ответы и комментарии</option></select></label>
        <label class="ca-field">Подсчёт<select wire:model.live="countMode"><option value="occurrences">Все употребления</option><option value="unique">Уникальные словоформы</option></select></label>
        <label class="ca-field">Приведение к начальной форме<select wire:model.live="mode"><option value="exact">Точные записи БД и JSON</option><option value="corpus">Точные + словоформы E-Laipa</option><option value="heuristic">Также предположения по окончаниям</option></select></label>
        @if($this->pageRecord && !$this->pageRecord->course_group_id)
            <label class="ca-field">Контекст для отдельной грамматической страницы<select wire:model.live="context"><option value="">Без порядка тем</option>@foreach($this->groups as $id=>$label)<option value="{{ $id }}">{{ $label }}</option>@endforeach</select></label>
        @endif
    </div>
    <div wire:loading role="status" class="ca-note">Пересчитываю лексику…</div>
    @php($report = $this->report)
    @if($report)
        <div class="ca-strip">
            <strong>{{ $report['selection']['level'] }} · {{ $report['selection']['context'] ?: 'Без темы курса' }}</strong>
            <span>{{ $report['total'] }} {{ $report['count_mode']==='unique' ? 'уникальных словоформ' : 'употреблений' }}</span>
            <span>Форм через нормализацию: {{ $report['new_forms'] }}</span>
            <span>Требуют проверки: {{ $report['review'] }}</span>
            @if($report['selection']['draft'])<span>Черновик</span>@endif
        </div>
        <p class="ca-note">Проценты от {{ $report['total'] }} лексических единиц. Фраза из словаря считается одной единицей. Имена учитываются; числа и русский текст исключены. Наличие слова в теме не означает, что ученик его выучил.</p>
        <p class="ca-note" role="note">{{ $report['elaipa_contract']['warning'] }}</p>
        @if(!$report['has_context'])<p class="ca-note">Нет опубликованного контекста группы: нельзя отличить предыдущие темы от будущих. Для отдельной грамматической страницы контекст можно выбрать выше.</p>@endif
        @if(!$report['total'])<p role="status">Латышский текст в выбранных полях не найден. Для перевода с русского выберите состав «Также вопросы, ответы и комментарии». Русская инструкция не показывает лексику будущего свободного ответа ученика. Кастомные React-категории без текстовых данных пока не индексируются.</p>@endif
        <div class="ca-charts">
            @livewire(\App\Filament\Widgets\ContentTopicChart::class, ['series'=>$report['topic_chart']], key('topics-'.$report['revision']))
            @livewire(\App\Filament\Widgets\ContentSkillChart::class, ['series'=>$report['skill_chart']], key('skills-'.$report['revision']))
        </div>
        <section class="ca-section">
            <h2>Учебная последовательность</h2>
            <p class="ca-note">Порядок определяется только фактическими категориями БД. E-Laipa помогает найти лексему, но её первое появление не подтверждает принадлежность всем темам. Однозначно найдено в тематическом JSON E-Laipa: {{ $report['elaipa_found'] }} из {{ $report['total'] }} единиц.</p>
            <div class="ca-scroll"><table class="ca-table"><thead><tr><th>Источник</th><th>Доля</th><th>Количество</th></tr></thead><tbody>
            @foreach($report['summary'] as $row)<tr><td><span class="ca-dot" style="background:{{ $row['color'] }}"></span>{{ $row['label'] }}</td><td>{{ $row['db_percent'] }}%</td><td>{{ $row['db_count'] }}</td></tr>@endforeach
            </tbody></table></div>
        </section>
        <section class="ca-section">
            <h2>Темы словаря</h2>
            <div class="ca-scroll"><table class="ca-table"><thead><tr><th>Первое появление</th><th>Количество</th><th>Доля</th></tr></thead><tbody>
                @foreach($report['topic_chart'] as $row)<tr><td>{{ $row['label'] }}</td><td>{{ $row['count'] }}</td><td>{{ $row['percent'] }}%</td></tr>@endforeach
            </tbody></table></div>
        </section>
        <section class="ca-section">
            <h2>Повторение в предыдущих темах по навыкам</h2>
            <div class="ca-scroll"><table class="ca-table"><thead><tr><th>Навык</th><th>Количество</th><th>Доля</th></tr></thead><tbody>
                @foreach($report['skill_chart'] as $row)<tr><td>{{ $row['label'] }}</td><td>{{ $row['count'] }}</td><td>{{ $row['percent'] }}%</td></tr>@endforeach
            </tbody></table></div>
        </section>
        <section class="ca-section">
            <h2>Все найденные категории словарей</h2>
            <p class="ca-note">Здесь показаны все совпадения, включая вложенные категории и другие словари. Категории пересекаются, поэтому проценты не складываются в 100%.</p>
            <div class="ca-scroll"><table class="ca-table"><thead><tr><th>Словарь</th><th>Категория</th><th>Количество</th><th>Доля</th></tr></thead><tbody>
                @foreach($report['category_rows'] as $row)<tr><td>{{ $row['dictionary'] }}</td><td>{{ $row['label'] }}</td><td>{{ $row['count'] }}</td><td>{{ $row['percent'] }}%</td></tr>@endforeach
            </tbody></table></div>
        </section>
        <section class="ca-section">
            <h2>Слова задания</h2>
            @foreach($report['segments'] as $segment)
                <p class="ca-note">{{ $segment['label'] }}</p><div class="ca-text">@foreach($segment['pieces'] as $piece)@if($piece['key']!==null)<button type="button" wire:click="selectWord({{ \Illuminate\Support\Js::from($piece['key']) }})" style="--ca-color:{{ \App\Services\ContentAudit\CourseContentAudit::COLORS[$report['words'][$piece['key']]['bucket']] }}" title="{{ \App\Services\ContentAudit\CourseContentAudit::BUCKETS[$report['words'][$piece['key']]['bucket']] }}">{{ $piece['text'] }}</button>@else{{ $piece['text'] }}@endif@endforeach</div>
            @endforeach
            @php($word = $report['words'][$selectedWord] ?? null)
            <x-filament::modal id="content-audit-word" width="3xl" heading="Слово и источники">
            @if($word)
                <div class="ca-detail">
                    <strong>{{ $word['surface'] }} → {{ implode(' / ', $word['match']['lemmas']) ?: 'не найдено' }}</strong>
                    <p>{{ $word['count'] }} употреблений · {{ \App\Services\ContentAudit\CourseContentAudit::BUCKETS[$word['bucket']] }}</p>
                    <p class="ca-note">{{ ['exact'=>'Точная запись БД или JSON', 'corpus_form'=>'Форма из JSON морфологии E-Laipa: изолированный анализ, требуется проверка', 'heuristic'=>'Предположение по окончанию: требуется проверка', 'unmatched'=>'Совпадения не найдены'][$word['match']['method']] }}</p>
                    @if($word['match']['review_required'])<p class="ca-note">Начальная форма или корпусная привязка требуют редакторской проверки.</p>@endif
                    @foreach($word['entries'] as $lemma=>$entry)
                        <strong>{{ $lemma }}</strong><ul>
                            @foreach($entry['db'] as $db)<li>{{ $db['dictionary'] }} · слово #{{ $db['id'] }}: {{ $db['word'] }}@foreach($db['categories'] as $category)<div>{{ $category['path'] }}</div>@endforeach</li>@endforeach
                            @foreach($entry['elaipa'] as $corpus)<li>E-Laipa: первое появление в JSON {{ $corpus['level'] }} · {{ $corpus['topic'] }} · общая частота по корпусу: {{ $corpus['frequency'] }}</li>@endforeach
                        </ul>
                    @endforeach
                </div>
            @endif
            </x-filament::modal>
            <h2 style="margin-top:20px">На редакторскую проверку</h2>
            <div class="ca-wordlist">@foreach($report['words'] as $key=>$word)@if(in_array($word['bucket'], ['future','unknown','ambiguous']) || $word['match']['review_required'])<button type="button" wire:click="selectWord({{ \Illuminate\Support\Js::from($key) }})">{{ $word['surface'] }} · {{ $word['count'] }}</button>@endif@endforeach</div>
        </section>
        <details class="ca-note"><summary>Источники и ограничения</summary>
            @foreach($report['sources'] as $source)<p>{{ $source['path'] }} · SHA256 {{ substr($source['sha256'],0,12) }}</p>@endforeach
            @if($report['unmapped_groups'])<p>Темы без однозначной связи с E-Laipa: {{ implode('; ', $report['unmapped_groups']) }}</p>@endif
            <p>Словари, категории, порядок тем и опубликованные задания читаются из текущей БД. JSON E-Laipa дополняет лексику, но не заменяет редакционную проверку. Анализ не читает личный прогресс и не обращается к платным моделям. Частоты E-Laipa не являются уровнем сложности слова. Собственные задания сохраняются без изменений.</p>
        </details>
    @else
        <p class="ca-note">{{ $this->pageRecord ? 'На этой странице пока нет блоков для анализа.' : 'Выберите страницу либо откройте статистику из её блока задания.' }}</p>
    @endif
</x-filament-panels::page>
