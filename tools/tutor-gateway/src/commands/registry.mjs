import {
  buildNavigationAction,
  getAssistantRouteGuide,
  getAssistantRouteGuideText,
  navigationRoutes,
} from './routes.mjs';
import {
  buildGrammarHighlightAction,
  buildGrammarLessonAction,
  buildGrammarTableHintAction,
  buildGrammarTableReadAction,
  getGrammarTableDoc,
  listGrammarTableDocs,
  validateGrammarHighlightParams,
  validateGrammarTableDocParams,
  validateGrammarLessonParams,
} from './grammarTables.mjs';
import { webReferenceCommands } from './webReferences.mjs';
import { siteCharacterCommands } from './siteCharacter.mjs';

export const commandRegistry = [
  ...webReferenceCommands,
  ...siteCharacterCommands,
  {
    command: 'commands.list',
    status: 'mvp',
    executor: 'node',
    description: 'List available MCP commands with one-line descriptions; use this when choosing a tool.',
    params: {
      format: {
        type: 'string',
        required: false,
        default: 'compact',
        enum: ['compact', 'text'],
      },
    },
    action: ({ format = 'compact' }) => ({
      type: 'commands_guide',
      emitUiCommand: false,
      commands: format === 'text' ? undefined : listAssistantCommands(),
      guideText: format === 'text' ? getAssistantCommandCatalogText() : undefined,
    }),
    hints: ['commands', 'tools', 'команды', 'инструменты'],
  },
  {
    command: 'commands.describe',
    status: 'mvp',
    executor: 'node',
    description: 'Get detailed schema, params, defaults, and usage notes for one MCP command.',
    params: {
      command: { type: 'string', required: true },
    },
    validate: ({ command }) => (findCommand(command) ? [] : [{
      code: 'command_not_found',
      message: `Command is not registered: ${command}`,
      path: 'command',
    }]),
    action: ({ command }) => ({
      type: 'command_doc',
      emitUiCommand: false,
      command: describeAssistantCommand(command),
    }),
    hints: ['describe command', 'schema', 'params', 'описание команды', 'параметры команды'],
  },
  {
    command: 'routes.list',
    status: 'mvp',
    executor: 'node',
    description: 'Get route ids, route params, paths, and navigation hints.',
    params: {
      format: {
        type: 'string',
        required: false,
        default: 'compact',
        enum: ['compact', 'text'],
      },
    },
    action: ({ format = 'compact' }) => ({
      type: 'route_guide',
      emitUiCommand: false,
      routes: format === 'text' ? undefined : getAssistantRouteGuide(),
      guideText: format === 'text' ? getAssistantRouteGuideText() : undefined,
    }),
    hints: ['routes', 'роуты', 'маршруты', 'страницы'],
  },
  {
    command: 'navigate',
    status: 'mvp',
    executor: 'ui',
    description: 'Navigate the browser to a known route using route and route_params.',
    params: {
      route: {
        type: 'string',
        required: true,
        enum: navigationRoutes.map((route) => route.id),
      },
      route_params: { type: 'object', required: false, default: {} },
    },
    action: buildNavigationAction,
    hints: navigationRoutes.flatMap((route) => route.hints),
  },
  {
    command: 'memory.get',
    status: 'mvp',
    executor: 'ui',
    description: 'Read compact saved tutor memory: difficult words and CEFR progress estimates.',
    params: {},
    action: () => ({
      type: 'client_api',
      emitUiCommand: true,
      method: 'GET',
      endpoint: '/tutor/memory',
      body: null,
      description: 'Read compact tutor memory for the current authenticated user.',
    }),
    hints: ['memory', 'память', 'progress', 'difficult words'],
  },
  {
    command: 'learning.context',
    status: 'mvp',
    executor: 'ui',
    description: 'Read site learning context: languages, dictionaries, full category trees, and level-2 category progress percent.',
    params: {},
    action: () => ({
      type: 'client_api',
      emitUiCommand: true,
      method: 'GET',
      endpoint: '/tutor/learning-context',
      body: null,
      description: 'Read dictionaries, category trees, languages, and progress stats for the current authenticated user.',
    }),
    hints: ['learning context', 'dictionaries tree', 'языки сайта', 'дерево категорий', 'прогресс категорий'],
  },
  {
    command: 'learning.category_vocabulary',
    status: 'mvp',
    executor: 'ui',
    description: 'Read unique vocabulary before one category in the published course sequence plus all vocabulary in the current category and its descendants.',
    params: {
      category_id: { type: 'number', required: true },
      dictionary_id: { type: 'number', required: false },
    },
    action: ({ category_id, dictionary_id }) => ({
      type: 'client_api',
      emitUiCommand: true,
      method: 'GET',
      endpoint: `/tutor/category-vocabulary?category_id=${category_id}${dictionary_id ? `&dictionary_id=${dictionary_id}` : ''}`,
      body: null,
      description: 'Read prior and current category vocabulary for creating a focused task.',
    }),
    hints: ['category vocabulary', 'prior words', 'current category words', 'слова до категории', 'слова текущей категории'],
  },
  {
    command: 'site.menu.describe',
    status: 'mvp',
    executor: 'node',
    description: 'Describe available main menu controls and which menu actions the tutor may activate.',
    params: {},
    action: () => ({
      type: 'site_menu_guide',
      emitUiCommand: false,
      menu: siteMenuGuide,
    }),
    hints: ['menu', 'меню', 'фишки меню', 'menu controls'],
  },
  {
    command: 'site.menu.activate',
    status: 'mvp',
    executor: 'ui',
    description: 'Activate a safe main menu control through the browser bridge.',
    params: {
      action: {
        type: 'string',
        required: true,
        enum: [
          'open_menu',
          'close_menu',
          'toggle_menu',
          'navigate_dictionaries',
          'navigate_grammar',
          'navigate_profile',
          'open_filament',
          'set_answer_mode',
          'set_cooldown',
          'set_large_font',
          'set_ui_lang',
          'set_learn_lang',
          'toggle_theme',
        ],
      },
      value: { type: 'string', required: false },
    },
    action: (params) => ({
      type: 'site_menu_activate',
      emitUiCommand: true,
      ...params,
    }),
    hints: ['activate menu', 'нажми меню', 'переключи режим', 'выбери язык'],
  },
  {
    command: 'verb.search.open',
    status: 'mvp',
    executor: 'ui',
    description: 'Type/search a Latvian verb and open the conjugation modal when a match is found.',
    params: {
      query: { type: 'string', required: true },
    },
    action: ({ query }) => ({
      type: 'verb_search_open',
      emitUiCommand: true,
      query,
    }),
    hints: ['verb search', 'найди глагол', 'спряжение глагола', 'verb modal'],
  },
  {
    command: 'verb.form.highlight',
    status: 'mvp',
    executor: 'ui',
    description: 'Highlight one verb conjugation cell in the open verb modal by tense and person.',
    params: {
      tense: { type: 'string', required: true, enum: ['past', 'present', 'future'] },
      person: { type: 'string', required: true, enum: ['1sg', '2sg', '3', '1pl', '2pl'] },
      table: { type: 'string', required: false, default: 'generated', enum: ['generated', 'reference', 'any'] },
      duration_ms: { type: 'number', required: false, default: 5000 },
    },
    action: ({ tense, person, table = 'generated', duration_ms = 4500 }) => ({
      type: 'verb_form_highlight',
      emitUiCommand: true,
      tense,
      person,
      table,
      durationMs: duration_ms,
    }),
    hints: ['highlight verb form', 'подсвети форму глагола', 'время лицо глагола'],
  },
  {
    command: 'memory.search_history',
    status: 'mvp',
    executor: 'ui',
    description: 'Semantic vector search over old tutor chat messages; default returns 5 hits, max 10.',
    params: {
      query: { type: 'string', required: true },
      limit: { type: 'number', required: false, default: 5 },
    },
    action: (params) => ({
      type: 'client_api',
      emitUiCommand: true,
      method: 'POST',
      endpoint: '/tutor/memory/search-history',
      body: params,
      description: 'Vector search over raw tutor messages and summaries for the current authenticated user.',
    }),
    hints: ['search history', 'vector memory', 'найди в истории', 'поищи в памяти'],
  },
  {
    command: 'memory.notes.search',
    status: 'mvp',
    executor: 'ui',
    description: 'Search curated important notes about the user, preferences, agreements, voice, UI, or learning context.',
    params: {
      query: { type: 'string', required: true },
      category: {
        type: 'string',
        required: false,
        enum: ['general', 'preference', 'learning', 'agreement', 'voice', 'ui', 'technical'],
      },
      limit: { type: 'number', required: false, default: 5 },
    },
    action: (params) => ({
      type: 'client_api',
      emitUiCommand: true,
      method: 'POST',
      endpoint: '/tutor/memory/notes/search',
      body: params,
      description: 'Search important memory notes for the current authenticated user.',
    }),
    hints: ['memory notes', 'important notes', 'важные заметки', 'памятка'],
  },
  {
    command: 'history.get_around_message',
    status: 'mvp',
    executor: 'ui',
    description: 'Load neighboring messages around a vector search hit; defaults to 5 before and 5 after.',
    params: {
      message_id: { type: 'number', required: true },
      before: { type: 'number', required: false, default: 5 },
      after: { type: 'number', required: false, default: 5 },
    },
    action: ({ message_id, before = 5, after = 5 }) => ({
      type: 'client_api',
      emitUiCommand: true,
      method: 'GET',
      endpoint: `/tutor/memory/history-around/${message_id}?before=${before}&after=${after}`,
      body: null,
      description: 'Load nearby messages around a vector-memory hit for the current authenticated user.',
    }),
    hints: ['history around message', 'сообщения рядом', 'контекст сообщения'],
  },
  {
    command: 'memory.save_difficult_word',
    status: 'mvp',
    executor: 'ui',
    description: 'Save or update one difficult Latvian word or repeated lexical mistake.',
    params: {
      word: { type: 'string', required: true },
      lemma: { type: 'string', required: false },
      language: { type: 'string', required: false, default: 'lv' },
      translation_ru: { type: 'string', required: false },
      status: {
        type: 'string',
        required: false,
        default: 'difficult',
        enum: ['difficult', 'learning', 'review', 'known'],
      },
      difficulty: { type: 'number', required: false, default: 3 },
      confidence: { type: 'number', required: false },
      examples: { type: 'array', required: false, default: [] },
    },
    action: (params) => ({
      type: 'client_api',
      emitUiCommand: true,
      method: 'POST',
      endpoint: '/tutor/memory/difficult-words',
      body: params,
      description: 'Save or update one difficult word for the current authenticated user.',
    }),
    hints: ['save difficult word', 'трудное слово', 'сложное слово'],
  },
  {
    command: 'memory.note.save',
    status: 'mvp',
    executor: 'ui',
    description: 'Save or update one durable important note about the user, project, preferences, agreements, or tutor behavior.',
    params: {
      category: {
        type: 'string',
        required: false,
        default: 'general',
        enum: ['general', 'preference', 'learning', 'agreement', 'voice', 'ui', 'technical'],
      },
      key: { type: 'string', required: true },
      content: { type: 'string', required: true },
      importance: { type: 'number', required: false, default: 3 },
      evidence: { type: 'array', required: false, default: [] },
    },
    action: (params) => ({
      type: 'client_api',
      emitUiCommand: true,
      method: 'POST',
      endpoint: '/tutor/memory/notes',
      body: params,
      description: 'Save or update an important memory note for the current authenticated user.',
    }),
    hints: ['save memory note', 'remember important', 'запомни важное', 'важная заметка'],
  },
  {
    command: 'memory.save_progress_estimate',
    status: 'mvp',
    executor: 'ui',
    description: 'Save an A1-B2 CEFR progress estimate when the dialogue gives enough evidence.',
    params: {
      cefr_level: { type: 'string', required: true, enum: ['A1', 'A2', 'B1', 'B2'] },
      confidence: { type: 'number', required: false },
      summary: { type: 'string', required: false },
      evidence: { type: 'array', required: false, default: [] },
    },
    action: (params) => ({
      type: 'client_api',
      emitUiCommand: true,
      method: 'POST',
      endpoint: '/tutor/memory/progress-estimates',
      body: params,
      description: 'Save CEFR A1-B2 progress estimate for the current authenticated user.',
    }),
    hints: ['save progress', 'cefr', 'уровень', 'прогресс'],
  },
  {
    command: 'lesson.block.complete',
    status: 'mvp',
    executor: 'ui',
    description: 'Submit the actual learner writing or speaking answer for server assessment (0-100). For dialogue include learner turns only, with enough context to evaluate goals; never insert tutor answers. Server returns score, feedback, target_reached and can_improve. Report only the returned score; completion is not guaranteed. May assess a revised answer even after completion. Identical answers are deduplicated.',
    params: {
      lesson_block_id: { type: 'number', required: true },
      answer_text: { type: 'string', required: false },
      feedback: { type: 'string', required: false },
    },
    action: ({ lesson_block_id, answer_text, feedback }) => ({
      type: 'client_api',
      emitUiCommand: true,
      method: 'POST',
      endpoint: `/tutor/lesson-blocks/${lesson_block_id}/complete`,
      body: { answer_text, feedback },
      description: 'Mark a lesson block as completed for the current authenticated user.',
    }),
    hints: ['lesson complete', 'mark done', 'зачесть', 'зачёт', 'задание выполнено'],
  },
  {
    command: 'grammar.tables.list',
    status: 'mvp',
    executor: 'node',
    description: 'List available React grammar tables that can be inspected or highlighted.',
    params: {},
    action: () => ({
      type: 'grammar_tables_guide',
      emitUiCommand: false,
      tables: listGrammarTableDocs(),
    }),
    hints: ['grammar tables', 'таблицы грамматики', 'подсветка таблиц'],
  },
  {
    command: 'grammar.table.get_structure',
    status: 'mvp',
    executor: 'node',
    description: 'Get the highlight targets (with descriptions and selectors) and structure of one grammar table without touching the page.',
    params: {
      table_key: { type: 'string', required: true },
    },
    validate: validateGrammarTableDocParams,
    action: ({ table_key }) => ({
      type: 'grammar_table_doc',
      emitUiCommand: false,
      table: getGrammarTableDoc(table_key),
    }),
    hints: ['grammar table structure', 'структура таблицы', 'цели подсветки'],
  },
  {
    command: 'grammar.table.doc',
    status: 'alias',
    executor: 'node',
    description: 'Alias for grammar.table.get_structure.',
    params: {
      table_key: { type: 'string', required: true },
    },
    validate: validateGrammarTableDocParams,
    action: ({ table_key }) => ({
      type: 'grammar_table_doc',
      emitUiCommand: false,
      table: getGrammarTableDoc(table_key),
    }),
    hints: ['grammar table doc', 'дока таблицы', 'описание таблицы'],
  },
  {
    command: 'grammar.table.highlight',
    status: 'mvp',
    executor: 'ui',
    description: 'Highlight one supported target in one grammar table.',
    params: {
      table_key: { type: 'string', required: true },
      target: { type: 'string', required: false, default: 'all' },
      duration_ms: { type: 'number', required: false, default: 4500 },
      color: { type: 'string', required: false, default: 'yellow' },
    },
    validate: validateGrammarHighlightParams,
    action: buildGrammarHighlightAction,
    hints: ['highlight grammar table', 'подсвети таблицу', 'подсветка грамматики'],
  },
  {
    command: 'grammar.table.get_content',
    status: 'mvp',
    executor: 'ui',
    description: 'Read the text content of one grammar table that is currently rendered on the page (headings, rows, notes, examples) so it can be explained without inventing words.',
    params: {
      table_key: { type: 'string', required: true },
      max_chars: { type: 'number', required: false, default: 6000 },
    },
    validate: validateGrammarTableDocParams,
    action: buildGrammarTableReadAction,
    hints: ['read grammar table', 'прочитай таблицу', 'что в таблице', 'содержимое таблицы'],
  },
  {
    command: 'grammar.table.get_hint',
    status: 'mvp',
    executor: 'ui',
    description: 'Read the detailed "?" hint document of one grammar table (rules with examples) in the current site language.',
    params: {
      table_key: { type: 'string', required: true },
      max_chars: { type: 'number', required: false, default: 8000 },
    },
    validate: validateGrammarTableDocParams,
    action: buildGrammarTableHintAction,
    hints: ['grammar table hint', 'подсказка к таблице', 'прочитай подсказку', 'объясни правило по таблице'],
  },
  {
    command: 'grammar.lesson.present',
    status: 'mvp',
    executor: 'ui',
    description: 'Present one or more grammar tables with timed highlight steps aligned to speech.',
    params: {
      table_keys: { type: 'array', required: false, default: [] },
      steps: { type: 'array', required: true },
    },
    validate: validateGrammarLessonParams,
    action: buildGrammarLessonAction,
    hints: ['show grammar lesson', 'покажи таблицы', 'объясни по таблицам'],
  },
];

export function findCommand(command) {
  return commandRegistry.find((entry) => entry.command === command) || null;
}

export function listAssistantCommands() {
  return commandRegistry.map((entry) => ({
    command: entry.command,
    status: entry.status,
    executor: entry.executor,
    description: entry.description || '',
    params: Object.fromEntries(
      Object.entries(entry.params || {}).map(([name, schema]) => [
        name,
        {
          type: schema.type,
          required: Boolean(schema.required),
          ...(schema.default !== undefined ? { default: schema.default } : {}),
          ...(schema.enum ? { enum: schema.enum } : {}),
        },
      ]),
    ),
  }));
}

export function describeAssistantCommand(command) {
  const entry = findCommand(command);
  if (!entry) return null;

  return {
    command: entry.command,
    status: entry.status,
    executor: entry.executor,
    description: entry.description || '',
    params: entry.params || {},
    hints: entry.hints || [],
    usage: commandUsageNotes[entry.command] || '',
  };
}

export function getAssistantCommandCatalogText() {
  return listAssistantCommands()
    .map((entry) => `- ${entry.command}: ${entry.description}`)
    .join('\n');
}

export function getAllowedCommandNames() {
  return commandRegistry.map((entry) => entry.command);
}

export const commandUsageNotes = {
  'web.sources': 'Lists recommended sources only; use web.reference for a real lookup.',
  'web.reference': 'Use {operation:"analyze",query:"mājā"} for a form; {operation:"inflect",query:"māja"} for a lemma; read accepts only trusted source URLs; search accepts a short generic language question. Never send whole student answers. Cite actual returned sources and preserve uncertainty.',
  'commands.list': 'Use when command names alone are not enough to choose confidently.',
  'commands.describe': 'Use before unfamiliar or parameter-heavy commands, or when params/defaults are unclear.',
  'routes.list': 'Use only if current route ids/params are unknown or ambiguous.',
  navigate: 'Call directly when the route id and required params are known.',
  'memory.get': 'Use for explicit saved learning memory, not for full chat history.',
  'learning.context': 'Use when you need available languages, dictionary ids, category trees, or level-2 category progress.',
  'learning.category_vocabulary': 'Use before creating an exercise for a known category. It returns the earlier published course vocabulary and the category’s own recursive vocabulary; duplicate word IDs are marked separately.',
  'site.menu.describe': 'Use before manipulating the main menu if you are unsure which controls exist.',
  'site.menu.activate': 'Use only for explicit user requests to open/navigate/toggle a visible menu feature.',
  'verb.search.open': 'Use when the user asks for a Latvian verb conjugation or wants a verb typed into the search field.',
  'verb.form.highlight': 'Use after verb.search.open when the conjugation modal is visible and one tense/person should be highlighted.',
  'memory.search_history': 'Use a short semantic query. Default limit is 5; request up to 10 if needed.',
  'memory.notes.search': 'Use before answering when stable preferences, agreements, voice/UI choices, or learning notes may matter.',
  'history.get_around_message': 'Use after memory.search_history when a hit needs surrounding dialogue. You may request wider before/after values.',
  'memory.save_difficult_word': 'Use for Latvian words/forms the user struggles with repeatedly or explicitly asks to remember.',
  'memory.note.save': 'Use for durable facts/preferences/agreements worth remembering across chats. Keep content atomic and concise.',
  'memory.save_progress_estimate': 'Use only with enough evidence; include confidence and short evidence.',
  'grammar.tables.list': 'Use before table work if table_key is unknown.',
  'grammar.table.get_structure': 'Use before highlight/presentation so targets are not invented.',
  'grammar.table.doc': 'Compatibility alias for grammar.table.get_structure.',
  'grammar.table.highlight': 'Use for one quick visual highlight. Default duration is 5000 ms.',
  'grammar.lesson.present': 'Use for spoken explanations with one or more timed table highlights. Default highlight duration is 5000 ms when omitted.',
};

export const siteMenuGuide = [
  {
    action: 'open_menu',
    description: 'Open the main menu panel.',
  },
  {
    action: 'close_menu',
    description: 'Close the main menu panel.',
  },
  {
    action: 'toggle_menu',
    description: 'Toggle the main menu panel.',
  },
  {
    action: 'navigate_dictionaries',
    description: 'Open the dictionaries area.',
  },
  {
    action: 'navigate_grammar',
    description: 'Open grammar tables.',
  },
  {
    action: 'navigate_profile',
    description: 'Open the user profile/dashboard.',
  },
  {
    action: 'open_filament',
    description: 'Open Filament admin in a new tab when the user is an admin.',
  },
  {
    action: 'set_answer_mode',
    value: 'type | select',
    description: 'Switch training between typed answers and word-choice answers.',
  },
  {
    action: 'set_cooldown',
    value: '2 | 0',
    description: 'Switch training cooldown between 3 hours (2) and 20 hours (0).',
  },
  {
    action: 'set_large_font',
    value: 'true | false',
    description: 'Enable or disable enlarged mobile font.',
  },
  {
    action: 'set_ui_lang',
    value: 'ru | uk',
    description: 'Switch interface language.',
  },
  {
    action: 'set_learn_lang',
    value: 'lv | en',
    description: 'Switch learning language and return to the home dictionary list.',
  },
  {
    action: 'toggle_theme',
    description: 'Toggle light/dark theme.',
  },
];
