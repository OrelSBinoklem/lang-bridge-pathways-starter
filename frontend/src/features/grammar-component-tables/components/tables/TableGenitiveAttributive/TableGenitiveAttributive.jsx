import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-genitive-attributive",
  "title": "Brāļa māja",
  "subtitle": "Зависимый родительный падеж",
  "columns": [
    {
      "key": "owner",
      "title": "Чьё? · исходное слово",
      "width": 22
    },
    {
      "key": "genitive",
      "title": "Генитив",
      "width": 20
    },
    {
      "key": "head",
      "title": "Главное слово",
      "width": 22
    },
    {
      "key": "example",
      "title": "Словосочетание",
      "width": 36
    }
  ],
  "rows": [
    {
      "key": "brother",
      "classes": "tt-genitive-singular",
      "cells": [
        "brālis",
        "brāļa",
        "māja",
        "brāļa māja"
      ]
    },
    {
      "key": "sister",
      "classes": "tt-genitive-singular",
      "cells": [
        "māsa",
        "māsas",
        "istaba",
        "māsas istaba"
      ]
    },
    {
      "key": "mother",
      "classes": "tt-genitive-singular",
      "cells": [
        "māte",
        "mātes",
        "galds",
        "mātes galds"
      ]
    },
    {
      "key": "father",
      "classes": "tt-genitive-singular",
      "cells": [
        "tēvs",
        "tēva",
        "krēsls",
        "tēva krēsls"
      ]
    },
    {
      "key": "head-accusative",
      "classes": "tt-accusative",
      "cells": [
        "brālis",
        "brāļa",
        "māju",
        "Es redzu brāļa māju."
      ]
    },
    {
      "key": "head-locative",
      "classes": "tt-locative",
      "cells": [
        "brālis",
        "brāļa",
        "mājā",
        "Es esmu brāļa mājā."
      ]
    }
  ],
  "rule": "Чьё? Зависимое существительное стоит в родительном перед главным: brāļa māja. Меняем роль главного слова — brāļa сохраняется.",
  "warning": "Это не согласование прилагательного: liela māja → lielā mājā, но brāļa māja → brāļa mājā. Не правило всех употреблений генитива."
};

export default function TableGenitiveAttributive() {
  return <SentencePatternTable {...pattern} />;
}
