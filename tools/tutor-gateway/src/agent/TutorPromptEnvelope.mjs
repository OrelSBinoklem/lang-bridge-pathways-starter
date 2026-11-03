import { buildTutorRules } from './TutorRulesBuilder.mjs';
import { getAssistantRouteGuideText } from '../commands/routes.mjs';
import { timelineInstruction } from '../context/orderedPrompt.mjs';
import { siteKeeperPrompt } from '../commands/siteCharacter.mjs';

const fullRules = buildTutorRules(), basicRules = buildTutorRules({ basic: true });

export const TUTOR_RESPONSE_FORMAT = {
  command: null,
  speech_segments: [{ style: 'neutral_teacher | warm_encouragement | gentle_correction | calm_explanation | playful_practice',
    speaker: 'tutor | dialogue_a | dialogue_b', text: 'string' }],
  reply: 'string',
};

/** The live request and administrative inspection use the same instruction factory. */
export function tutorDeveloperMessages(config = {}, extra = []) {
  return [
    { role: 'developer', content: (config.contextMode === 'basic' ? basicRules : fullRules) +
      (config.longMemoryEnabled === false ? '\nПоиск в старых беседах (memory.search_history, history.get_around_message) выключен. Используй резюме, важные заметки и текущую историю; остальные команды памяти доступны.' : '') },
    { role: 'developer', content: `Available routes, stable route guide:\n${getAssistantRouteGuideText()}\n\n${siteKeeperPrompt()}` },
    ...extra.filter(Boolean).map(content => ({ role: 'developer', content })),
  ];
}

export function flowCommandInstruction(policy) {
  return policy.allCommands ? `Лимит итераций ответа с командами: ${policy.maxSteps}. Заверши ответ в пределах этого лимита.`
    : `В этой схеме разрешены только команды: ${policy.allowedCommands.join(', ') || 'никакие'}. Не запрашивай другие команды. Лимит итераций: ${policy.maxSteps}.`;
}

export function tutorPromptManifest(config, policy) {
  const messages = tutorDeveloperMessages(config, [flowCommandInstruction(policy)]);
  messages.push({ role: 'developer', content: timelineInstruction(TUTOR_RESPONSE_FORMAT) });
  const descriptions = [
    ['base', 'Основные правила репетитора', 'tools/tutor-gateway/src/agent/TutorRulesBuilder.mjs'],
    ['routes', 'Смотритель: карта сайта и каталог страниц', 'tools/tutor-gateway/src/commands/siteCharacter.mjs'],
    ['policy', 'Команды и лимит шагов', 'tools/tutor-gateway/src/agent/TutorPromptEnvelope.mjs'],
    ['journal', 'Журнал и формат ответа', 'tools/tutor-gateway/src/context/orderedPrompt.mjs'],
  ];
  return { sections: messages.map((message, index) => ({ id: descriptions[index][0], title: descriptions[index][1],
    source: descriptions[index][2], role: message.role, text: message.content, characters: message.content.length })),
    responseFormat: TUTOR_RESPONSE_FORMAT,
    note: 'Серверный префикс. Подключённые карточки инструкций, данные, текущая реплика и возможный configuration_update добавляются отдельно; полный порядок виден в итоговом запросе.' };
}
