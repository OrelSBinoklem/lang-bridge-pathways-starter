import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-adjective-adverb",
  "title": "Dārga jaka · pirkt dārgi",
  "subtitle": "Свойство предмета или цена покупки",
  "columns": [
    {
      "key": "question",
      "title": "Вопрос",
      "width": 23
    },
    {
      "key": "noun",
      "title": "Предмет",
      "width": 22
    },
    {
      "key": "sentence",
      "title": "Фраза",
      "width": 30
    },
    {
      "key": "role",
      "title": "Роль формы",
      "width": 25
    }
  ],
  "rows": [
    {
      "key": "feminine",
      "cells": [
        "kāda?",
        "jaka",
        "Jaka ir dārga.",
        "прилагательное"
      ]
    },
    {
      "key": "masculine",
      "cells": [
        "kāds?",
        "krekls",
        "Krekls ir lēts.",
        "прилагательное"
      ]
    },
    {
      "key": "fplural",
      "cells": [
        "kādas?",
        "kurpes",
        "Kurpes ir lētas.",
        "прилагательное"
      ]
    },
    {
      "key": "mplural",
      "cells": [
        "kādi?",
        "zābaki",
        "Zābaki ir dārgi.",
        "прилагательное"
      ]
    },
    {
      "key": "buy",
      "cells": [
        "kā?",
        "jaku",
        "Es pērku jaku dārgi.",
        "наречие"
      ]
    },
    {
      "key": "buyplural",
      "cells": [
        "kā?",
        "zābakus",
        "Es pērku zābakus lēti.",
        "наречие"
      ]
    }
  ],
  "rule": "Прилагательное описывает предмет и согласуется: dārgs, dārga, dārgi, dārgas. Наречие описывает действие покупки и не согласуется с предметом: pirkt dārgi, pirkt lēti. Dārgi может быть и прилагательным, и наречием: решает связь в предложении.",
  "warning": "Первый этап — положительная степень и неопределённые прилагательные. Dārgāk / dārgāks, lētāk / lētāks и превосходная степень будут отдельным продолжением. Наречие не становится dārga только потому, что покупают jaku."
};

export default function TableAdjectiveVsAdverb() {
  return <SentencePatternTable {...pattern} />;
}

