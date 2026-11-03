import { sel } from './shared/pronoun.mjs';

/**
 * vienlidzigi1 — «Однородные члены предложения» (TableVienlidzigi1): intro with an example, three rows
 * vl-row + tt-rule-none | un | bet (conjunction group + badge with/without comma + samples; the "un" row also has an
 * extra case vl-extra). Members = vl-mem, punctuation = vl-pn, badges vl-badge--yes / --no.
 */
export default {
  tableKey: 'vienlidzigi1',
  summaryRu:
    'Однородные члены предложения отвечают на один и тот же вопрос и относятся к одному слову (Jaunieši reti apmeklē teātri, operu vai izstādes. — Ko apmeklē? — театр, оперу или выставки). Запятая между ними зависит от союза. 1) Без союза — с запятой: Vecais vīrs sniedza lielu, sastrādātu roku. 2) Союзы un · vai · jeb — без запятой: Vecais vīrs sniedza lielu un sastrādātu roku.; но если союз повторяется — запятая перед повтором: Vīrietis atskatījās un pamāja, un devās tālāk. 3) Bet · taču · tomēr · toties · kā arī · nevis · lai gan · tāpat — с запятой: Nopirku maizi, kā arī pienu. / Tas ir lēts, taču kvalitatīvs telefons.',
  notesRu: ['Однородные члены в примерах выделены цветом, запятые и двоеточия отмечены отдельно.'],
  highlightTargets: {
    all: { labelRu: 'Вся таблица про однородные члены', selectors: sel('.card.table-vienlidzigi') },
    title: { labelRu: 'Заголовок «Однородные члены предложения»', selectors: sel('.vs-head') },
    intro: { labelRu: 'Вступление с примером Jaunieši reti apmeklē teātri, operu vai izstādes', selectors: sel('.vl-intro') },
    rows: { labelRu: 'Все три случая (без союза, un/vai/jeb, bet/taču…)', selectors: sel('.vl-row') },
    rule_no_conjunction: { labelRu: 'Без союза — запятая', selectors: sel('.tt-rule-none') },
    rule_un: { labelRu: 'Союзы un · vai · jeb — без запятой', selectors: sel('.tt-rule-un') },
    rule_bet: { labelRu: 'Союзы bet · taču · tomēr · toties · kā arī · nevis · lai gan · tāpat — с запятой', selectors: sel('.tt-rule-bet') },
    conjunction_groups: { labelRu: 'Названия групп союзов', selectors: sel('.vl-when') },
    comma_yes: { labelRu: 'Значки «✓ с запятой»', selectors: sel('.vl-badge--yes') },
    comma_no: { labelRu: 'Значок «✗ без запятой»', selectors: sel('.vl-badge--no') },
    extra_case: { labelRu: 'Исключение: повторяющийся союз un — запятая перед повтором', selectors: sel('.vl-extra') },
    members: { labelRu: 'Однородные члены в примерах (выделены)', selectors: sel('.vl-mem') },
    punctuation: { labelRu: 'Запятые в примерах', selectors: sel('.vl-pn') },
    samples: { labelRu: 'Все примеры предложений', selectors: sel('.vl-sample', '.vl-block') },
    translations: { labelRu: 'Русские переводы', selectors: sel('.vl-ru') },
  },
};
