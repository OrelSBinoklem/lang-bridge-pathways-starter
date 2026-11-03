import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-determiner-noun",
  "title": "Tas · tā · tie · tās",
  "subtitle": "Указательное слово и существительное",
  "columns": [
    {
      "key": "case",
      "title": "Падеж",
      "width": 28
    },
    {
      "key": "features",
      "title": "Род / число",
      "width": 22
    },
    {
      "key": "form",
      "title": "Форма",
      "width": 14
    },
    {
      "key": "phrase",
      "title": "Группа",
      "width": 36
    }
  ],
  "rows": [
    {
      "key": "nom-m",
      "cells": [
        "Именительный",
        "муж. ед.",
        "tas",
        "tas koks"
      ]
    },
    {
      "key": "nom-f",
      "cells": [
        "Именительный",
        "жен. ед.",
        "tā",
        "tā māja"
      ]
    },
    {
      "key": "nom-mp",
      "cells": [
        "Именительный",
        "муж. мн.",
        "tie",
        "tie koki"
      ]
    },
    {
      "key": "nom-fp",
      "cells": [
        "Именительный",
        "жен. мн.",
        "tās",
        "tās mājas"
      ]
    },
    {
      "key": "acc",
      "cells": [
        "Винительный",
        "муж. мн.",
        "tos",
        "Es redzu tos kokus."
      ]
    },
    {
      "key": "loc",
      "cells": [
        "Местный",
        "жен. мн.",
        "tajās",
        "Es dzīvoju tajās mājās."
      ]
    }
  ],
  "rule": "Указательное слово согласуется с существительным в роде, числе и падеже. Винительный: to / to / tos / tās. Местный: tajā / tajā / tajos / tajās.",
  "warning": "Здесь модель tas / tā. Šis / šī и mans / mana изучаются отдельно. Окончания определителя и существительного не обязательно совпадают; у местного есть допустимые альтернативные формы."
};

export default function TableDeterminerNounAgreement() {
  return <SentencePatternTable {...pattern} />;
}
