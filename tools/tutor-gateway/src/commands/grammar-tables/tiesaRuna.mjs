import { sel } from './shared/pronoun.mjs';

/**
 * tiesaRuna — «Прямая речь» (TableTiesaRuna): intro, legend (речь / слова автора / знаки), three numbered patterns
 * (tr-row + tt-pattern-before | after | middle) each with title, scheme, rule and samples (Latvian + Russian).
 * Inside samples: tr-runa (quoted speech), tr-piebilde (author's words), tr-pn (punctuation).
 */
export default {
  tableKey: 'tiesaRuna',
  summaryRu:
    'Прямая речь (tiešā runa) — точные слова человека в кавычках „…”; главное — знаки препинания. Три схемы. 1) Слова автора → речь: piebilde: „Runa.” — после слов автора двоеточие, точка внутри кавычек (Tēvs teica: „Rīt brauksim uz jūru.”). 2) Речь → слова автора: „Runa,” piebilde. — в кавычках запятая (или ? !), слова автора с маленькой буквы („Kur ir manas atslēgas?” brālis jautāja. „Tās ir uz galda,” atbildēja māsa.). 3) Слова автора внутри речи: „Runa,” piebilde, „runa.” — одна фраза: продолжение с маленькой буквы („Ja būs saulains,” tēvs piebilda, „ņemsim līdzi laivu.”); две фразы: точка и заглавная („Labi,” tēvs nolēma. „Brauksim agri.”).',
  notesRu: [
    'Цвета: речь, слова автора (piebilde) и знаки препинания выделены разными цветами, есть легенда над схемами.',
    'К каждому латышскому примеру дан русский перевод.',
  ],
  highlightTargets: {
    all: { labelRu: 'Вся таблица про прямую речь', selectors: sel('.card.table-tiesa-runa') },
    title: { labelRu: 'Заголовок «Прямая речь»', selectors: sel('.vs-head') },
    intro: { labelRu: 'Вступление: что такое tiešā runa', selectors: sel('.tr-intro') },
    legend: { labelRu: 'Легенда цветов: речь, слова автора, знаки', selectors: sel('.tr-legend') },
    pattern_before: { labelRu: 'Схема 1: слова автора → речь', selectors: sel('.tt-pattern-before') },
    pattern_after: { labelRu: 'Схема 2: речь → слова автора', selectors: sel('.tt-pattern-after') },
    pattern_middle: { labelRu: 'Схема 3: слова автора внутри речи', selectors: sel('.tt-pattern-middle') },
    pattern_titles: { labelRu: 'Названия схем', selectors: sel('.tr-title') },
    schemes: { labelRu: 'Схемы записи (piebilde: „Runa.” и т. д.)', selectors: sel('.tr-scheme') },
    rules: { labelRu: 'Правила пунктуации под каждой схемой', selectors: sel('.tr-rule') },
    samples_lv: { labelRu: 'Латышские примеры', selectors: sel('.tr-sample-lv') },
    samples_ru: { labelRu: 'Русские переводы примеров', selectors: sel('.tr-sample-ru') },
    speech: { labelRu: 'Сама речь в кавычках (выделена цветом)', selectors: sel('.tr-runa') },
    author_words: { labelRu: 'Слова автора (piebilde)', selectors: sel('.tr-piebilde') },
    punctuation: { labelRu: 'Знаки препинания и кавычки (выделены)', selectors: sel('.tr-pn') },
    pattern_before_rule: { labelRu: 'Правило схемы 1: после слов автора двоеточие', selectors: sel('.tt-pattern-before .tr-rule') },
    pattern_after_rule: { labelRu: 'Правило схемы 2: запятая в кавычках, слова автора с маленькой', selectors: sel('.tt-pattern-after .tr-rule') },
    pattern_middle_rule: { labelRu: 'Правило схемы 3: одна фраза или две', selectors: sel('.tt-pattern-middle .tr-rule') },
  },
};
