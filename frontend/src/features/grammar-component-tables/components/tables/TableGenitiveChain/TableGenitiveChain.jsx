import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-genitive-chain",
  "title": "Tēva brāļa māja",
  "subtitle": "Цепочка генитива · две связи",
  "columns": [
    {
      "key": "first",
      "title": "Чей?",
      "width": 19
    },
    {
      "key": "second",
      "title": "Кто?",
      "width": 19
    },
    {
      "key": "head",
      "title": "Предмет",
      "width": 22
    },
    {
      "key": "phrase",
      "title": "Полная связь",
      "width": 40
    }
  ],
  "rows": [
    {
      "key": "uncle",
      "cells": [
        "tēva",
        "brāļa",
        "māja",
        "tēva brāļa māja"
      ]
    },
    {
      "key": "aunt",
      "cells": [
        "mātes",
        "māsas",
        "grāmata",
        "mātes māsas grāmata"
      ]
    },
    {
      "key": "nephew",
      "cells": [
        "brāļa",
        "dēla",
        "soma",
        "brāļa dēla soma"
      ]
    },
    {
      "key": "niece",
      "cells": [
        "māsas",
        "meitas",
        "krēsls",
        "māsas meitas krēsls"
      ]
    },
    {
      "key": "neighbor",
      "cells": [
        "vecmāmiņas",
        "kaimiņa",
        "gulta",
        "vecmāmiņas kaimiņa gulta"
      ]
    },
    {
      "key": "place",
      "cells": [
        "tēva",
        "brāļa",
        "mājā",
        "tēva brāļa mājā"
      ]
    }
  ],
  "rule": "Главное слово называет предмет. Ближайший генитив указывает его владельца, а предыдущий генитив уточняет, о каком владельце речь: māja ← brāļa ← tēva. В этой модели оба зависимых существительных стоят в генитиве единственного числа.",
  "warning": "При переходе главного слова в местный зависимые генитивы сохраняются. Не переставляй владельцев: tēva brāļa māja и brāļa tēva māja описывают разные связи. Здесь только заранее заданные семейные и соседские отношения, не любая последовательность трёх существительных."
};

export default function TableGenitiveChain() {
  return <SentencePatternTable {...pattern} />;
}

