import TableCard from '../../TableCard.jsx';
import { Legend, TypeCard } from './Paligteikumi.jsx';

const TYPES = [
  {
    lv: 'Apzīmētāja', ru: 'определительное', q: 'Kāds? Kurš?',
    words: 'kas · kurš · kāds · ka · lai · kur · kad · kāpēc', pos: ['aiz'],
    lv_s: 'Viņš bija cilvēks, [[kas vienmēr meklēja ko jaunu]].', ru_s: 'Он был человеком, который всегда искал новое.',
  },
  {
    lv: 'Papildinātāja', ru: 'изъяснительное', q: 'Ko? Kam? Par ko?',
    words: 'ka · vai · kas · kurš · kā · kur · kad', pos: ['aiz', 'starp'],
    lv_s: 'Viņš redzēja, [[ka daudzi nepiekrīt]].', ru_s: 'Он видел, что многие не согласны.',
  },
  {
    lv: 'Vietas', ru: 'места', q: 'Kur? Kurp? No kurienes?',
    words: 'kur · kurp · no kurienes · uz kurieni', pos: ['aiz', 'starp', 'pirms'],
    lv_s: 'Es eju tur, [[kur acis rāda]].', ru_s: 'Я иду туда, куда глаза глядят.',
  },
  {
    lv: 'Laika', ru: 'времени', q: 'Kad? Cik ilgi?',
    words: 'kad · kamēr · līdz · kolīdz · tiklīdz · kopš · pirms', pos: ['aiz', 'starp', 'pirms'],
    lv_s: 'Bija jau vēls, [[kad pārnācām]].', ru_s: 'Было уже поздно, когда мы вернулись.',
  },
  {
    lv: 'Veida', ru: 'образа действия', q: 'Kā? Kādā veidā?',
    words: 'kā · ka · lai · cik', pos: ['aiz', 'starp', 'pirms'],
    lv_s: 'Mēs rakstām tā, [[kā mums mācīts]].', ru_s: 'Мы пишем так, как нас учили.',
  },
  {
    lv: 'Mēra', ru: 'меры', q: 'Cik? Kādā mērā?',
    words: 'cik · ka · lai', pos: ['aiz'],
    lv_s: 'Visi strādāja tik, [[cik bija spēkos]].', ru_s: 'Все работали столько, сколько было сил.',
  },
  {
    lv: 'Cēloņa', ru: 'причины', q: 'Kāpēc? Kālab?',
    words: 'tāpēc ka · tālab ka · tā kā · ka', pos: ['aiz', 'pirms'],
    lv_s: 'Pārbrauktuve bija slēgta, [[tāpēc ka tuvojās vilciens]].', ru_s: 'Переезд был закрыт, потому что шёл поезд.',
  },
  {
    lv: 'Nolūka', ru: 'цели', q: 'Kādēļ? Kādam nolūkam?',
    words: 'lai', pos: ['aiz', 'starp', 'pirms'],
    lv_s: 'Atvēru logu, [[lai izvēdinātu istabu]].', ru_s: 'Я открыл окно, чтобы проветрить комнату.',
  },
  {
    lv: 'Nosacījuma', ru: 'условия', q: 'Kādā gadījumā?',
    words: 'ja', pos: ['aiz', 'starp', 'pirms'],
    lv_s: '[[Ja vajadzēs]], mēs palīdzēsim.', ru_s: 'Если понадобится, мы поможем.',
  },
  {
    lv: 'Pamatojuma', ru: 'обоснования', q: '—',
    words: 'jo (или без союза)', pos: ['aiz'],
    lv_s: 'Es eju mājās, [[jo rīt ir eksāmens]].', ru_s: 'Я иду домой, ведь завтра экзамен.',
  },
  {
    lv: 'Pieļāvuma', ru: 'уступки', q: '—',
    words: 'kaut gan · kaut arī · lai gan · lai arī', pos: ['aiz', 'starp', 'pirms'],
    lv_s: '[[Kaut arī rīts bija saulains]], bija auksti.', ru_s: 'Хотя утро было солнечным, было холодно.',
  },
  {
    lv: 'Salīdzinājuma', ru: 'сравнения', q: '—',
    words: 'it kā · kā · nekā · jo … jo', pos: ['aiz', 'pirms'],
    lv_s: '[[Jo ātrāk sāksim]], jo ātrāk beigsim.', ru_s: 'Чем раньше начнём, тем раньше закончим.',
  },
  {
    lv: 'Seku', ru: 'следствия', q: '—',
    words: 'tā ka · ka (retāk)', pos: ['aiz'],
    lv_s: 'Ilgi staigājām, [[tā ka kājas bija nogurušas]].', ru_s: 'Мы долго гуляли, так что ноги устали.',
  },
];

export default function TablePaligteikumi2() {
  return (
    <TableCard>
      <div className="card table-paligteikumi">
        <header className="vs-head">
          <h2 className="vs-title">Придаточные предложения — расширенная таблица</h2>
        </header>

        <Legend />

        <div className="pt-grid">
          {TYPES.map((t) => <TypeCard t={t} key={t.lv} />)}
        </div>
      </div>
    </TableCard>
  );
}
