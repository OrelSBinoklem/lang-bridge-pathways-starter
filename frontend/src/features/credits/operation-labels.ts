type Operation = { purpose?: string; kind: string };
const labels: Record<string, [string, string]> = {
  grant: ['Пополнение', 'Поповнення'],
  subscription: ['Обычный доступ на 3 месяца', 'Звичайний доступ на 3 місяці'],
  bot_answer: ['Ответ бота', 'Відповідь бота'],
  speech: ['Озвучка ответа', 'Озвучення відповіді'],
  transcription: ['Распознавание вашей речи', 'Розпізнавання вашого мовлення'],
  translation_check: ['Проверка перевода', 'Перевірка перекладу'],
  task_check: ['Проверка задания', 'Перевірка завдання'],
  exam_check: ['Проверка экзамена', 'Перевірка іспиту'],
  memory: ['Память бота и поиск по истории', 'Пам’ять бота та пошук в історії'],
  conversation_summary: ['Обновление контекста беседы', 'Оновлення контексту бесіди'],
  reference_search: ['Проверка по языковым источникам', 'Перевірка за мовними джерелами'],
  ai_request: ['AI-запрос', 'AI-запит'],
};

export function operationLabel(operation: Operation, uk = false): string {
  const fallback = operation.kind === 'embedding' ? 'memory' : operation.kind;
  return (labels[operation.purpose || ''] || labels[fallback] || labels.ai_request)[uk ? 1 : 0];
}
