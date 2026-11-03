import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-time-sequence",
  "title": "Vakar · tagad · rīt",
  "subtitle": "Три времени · действия и спорт",
  "columns": [
    {
      "key": "subject",
      "title": "Кто?",
      "width": 16
    },
    {
      "key": "past",
      "title": "Vakar · вчера",
      "width": 28
    },
    {
      "key": "present",
      "title": "Tagad · сейчас",
      "width": 28
    },
    {
      "key": "future",
      "title": "Rīt · завтра",
      "width": 28
    }
  ],
  "rows": [
    {
      "key": "first",
      "cells": [
        "es",
        "slēpoju",
        "slēpoju",
        "slēpošu"
      ]
    },
    {
      "key": "second",
      "cells": [
        "tu",
        "slēpoji",
        "slēpo",
        "slēposi"
      ]
    },
    {
      "key": "third",
      "cells": [
        "viņš / viņa",
        "slēpoja",
        "slēpo",
        "slēpos"
      ]
    },
    {
      "key": "we",
      "cells": [
        "mēs",
        "slēpojām",
        "slēpojam",
        "slēposim"
      ]
    },
    {
      "key": "you",
      "cells": [
        "jūs",
        "slēpojāt",
        "slēpojat",
        "slēposiet / slēposit"
      ]
    },
    {
      "key": "they",
      "cells": [
        "viņi / viņas",
        "slēpoja",
        "slēpo",
        "slēpos"
      ]
    }
  ],
  "rule": "В этих заданиях время задано явно: vakar — прошедшее, tagad — настоящее, rīt — будущее. Затем выбирается лицо. У slēpot, slidot, sportot, vingrot и nūjot в первом лице единственного числа настоящее и прошедшее совпадают; в третьем лице оба числа имеют одну форму.",
  "warning": "Это проверенный набор глаголов, а не универсальные окончания всех спряжений. В обычной речи время зависит от контекста, не только от одного наречия. Будущее второго лица множественного принимается с -siet и -sit; настоящее/прошедшее различаются долготой в -jam / -jām."
};

export default function TableTimeSequence() {
  return <SentencePatternTable {...pattern} />;
}
