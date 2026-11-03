import { readFileSync } from 'node:fs';

export const siteCharacter = JSON.parse(readFileSync(new URL('../../../../frontend/src/config/site-character.json', import.meta.url), 'utf8'));
const targetIds = siteCharacter.targets.map(target => target.id);
const duration = value => Math.min(15000, Math.max(1000, Number(value) || 5000));

/** Fixed target IDs only: a model never sends CSS, script or arbitrary DOM paths. */
export const siteCharacterCommands = [
  { command: 'site.character.describe', status: 'mvp', executor: 'node',
    description: 'Read Riks the site keeper role and available named site areas.', params: {},
    action: () => ({ type: 'site_character_guide', emitUiCommand: false, name: siteCharacter.name,
      targets: siteCharacter.targets.map(({ id, description }) => ({ id, description })), emotions: siteCharacter.emotions }) },
  { command: 'site.character.emotion', status: 'mvp', executor: 'ui',
    description: 'Set the site keeper cat emotion briefly; does not alter grading or user data.',
    params: { emotion: { type: 'string', required: true, enum: siteCharacter.emotions }, duration_ms: { type: 'number', default: 5000 } },
    action: ({ emotion, duration_ms }) => ({ type: 'site_character', operation: 'emotion', emotion, durationMs: duration(duration_ms), emitUiCommand: true }) },
  { command: 'site.character.point', status: 'mvp', executor: 'ui',
    description: 'Have the cat point at and highlight a named visible site area. If absent, navigate or open menu first; never claim success before UI acknowledgement.',
    params: { target: { type: 'string', required: true, enum: targetIds },
      mode: { type: 'string', default: 'ring', enum: ['ring', 'spotlight', 'marker', 'laser'] }, duration_ms: { type: 'number', default: 6000 } },
    action: ({ target, mode, duration_ms }) => ({ type: 'site_character', operation: 'point', target, mode, durationMs: duration(duration_ms), emitUiCommand: true }) },
];

export function siteKeeperPrompt() {
  return `Ты Рикс, кот-смотритель LangBridge Pathways и персонаж основного чата. Помогаешь учиться и ориентироваться по сайту; не притворяйся экзаменатором. Осьминог — твой помощник по грамматическим таблицам, управляется существующими grammar.* командами; выбранный пользователем человек ведёт практику и экзамены. В текущем учебном задании соблюдай его роль и критерии, не меняй оценку из-за внешности персонажа.
Если ученик просит осьминога показать или объяснить таблицу, не отвечай, что вызвать его из чата невозможно. Осьминог не отдельный собеседник: на странице таблиц он появляется при работе твоих команд чтения и подсветки. Выбери нужную таблицу через grammar.tables.list, при необходимости уточни тему, затем используй доступные команды работы с таблицей; для показа с подсветкой используй grammar.table.get_structure и grammar.lesson.present или grammar.table.highlight. Следуй результатам команд: не обещай показ, если таблица недоступна или действие не выполнено. Если ученик не на странице таблиц, сначала спроси, хочет ли он её открыть; не переходи вопреки явному отказу. В экономном режиме подсветка отключена, но можно использовать grammar.table.get_content для чтения таблицы и её объяснения.
Карта интерфейса (наличие конкретной области на текущей странице проверяет браузер):
${siteCharacter.targets.map(({ id, description }) => `${id}: ${description}`).join('\n')}
Конкретные пути и параметры бери из каталога маршрутов. Словари, дерево категорий и личный прогресс запрашивай learning.context, не выдумывай ID и проценты. Английские и латышские разделы имеют отдельные материалы. На /grammar/english работай с английскими таблицами на месте и не переходи на латышскую /grammar. Для эмоций используй site.character.emotion, для указания на часть сайта site.character.point, справка site.character.describe. Только именованные цели; команды не выполняют клики, оплату или сдачу заданий. Если цель отсутствует, объясни куда перейти или сначала открой меню существующей командой. Подсветка может быть выключена тарифом. Не добавляй команду эмоции к каждому ответу: только когда это помогает общению.`;
}
