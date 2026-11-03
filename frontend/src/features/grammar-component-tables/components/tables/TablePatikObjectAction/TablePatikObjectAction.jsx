import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-patik-object-action",
  "title": "Patīk · priekšmets vai darbība",
  "subtitle": "Нравится вещь или действие",
  "columns": [
    {
      "key": "holder",
      "title": "Кому?",
      "width": 19
    },
    {
      "key": "verb",
      "title": "Нравится",
      "width": 19
    },
    {
      "key": "form",
      "title": "Что / делать что",
      "width": 30
    },
    {
      "key": "meaning",
      "title": "Смысл",
      "width": 32
    }
  ],
  "rows": [
    {
      "key": "book",
      "cells": [
        "man",
        "patīk",
        "grāmata",
        "мне нравится книга"
      ]
    },
    {
      "key": "books",
      "cells": [
        "tev",
        "patīk",
        "grāmatas",
        "тебе нравятся книги"
      ]
    },
    {
      "key": "music",
      "cells": [
        "māsai",
        "patīk",
        "mūzika",
        "сестре нравится музыка"
      ]
    },
    {
      "key": "read",
      "cells": [
        "brālim",
        "patīk",
        "lasīt",
        "брату нравится читать"
      ]
    },
    {
      "key": "dance",
      "cells": [
        "meitai",
        "patīk",
        "dejot",
        "дочери нравится танцевать"
      ]
    },
    {
      "key": "negative",
      "cells": [
        "mums",
        "nepatīk",
        "dziedāt",
        "нам не нравится петь"
      ]
    }
  ],
  "rule": "Кому нравится — дательный. Если нравится предмет, его название в именительном: Man patīk grāmata / grāmatas. Если нравится действие — инфинитив: Man patīk lasīt. В этой модели patīk не меняется при смене человека и числа предмета; отрицание — nepatīk.",
  "warning": "Это продолжение таблицы patīk + инфинитив, а не её замена. Формы patīku и patīc существуют в других конструкциях, но не вместо patīk в показанной схеме. После инфинитива его собственный объект может быть винительным: patīk lasīt grāmatu."
};

export default function TablePatikObjectAction() {
  return <SentencePatternTable {...pattern} />;
}
