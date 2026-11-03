import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-quantity-genitive",
  "title": "Cik? · Kā?",
  "subtitle": "Мера и содержимое",
  "columns": [
    {
      "key": "measure",
      "title": "Мера",
      "width": 18
    },
    {
      "key": "form",
      "title": "Чего?",
      "width": 22
    },
    {
      "key": "phrase",
      "title": "Группа",
      "width": 32
    },
    {
      "key": "meaning",
      "title": "Смысл",
      "width": 28
    }
  ],
  "rows": [
    {
      "key": "milk",
      "cells": [
        "glāze",
        "piena",
        "glāze piena",
        "стакан молока"
      ]
    },
    {
      "key": "tea",
      "cells": [
        "krūze",
        "tējas",
        "krūze tējas",
        "кружка чая"
      ]
    },
    {
      "key": "juice",
      "cells": [
        "pudele",
        "sulas",
        "pudele sulas",
        "бутылка сока"
      ]
    },
    {
      "key": "soup",
      "cells": [
        "šķīvis",
        "zupas",
        "šķīvis zupas",
        "тарелка супа"
      ]
    },
    {
      "key": "sugar",
      "cells": [
        "karote",
        "cukura",
        "karote cukura",
        "ложка сахара"
      ]
    },
    {
      "key": "acc",
      "cells": [
        "glāzi",
        "piena",
        "Es redzu glāzi piena.",
        "вижу стакан молока"
      ]
    }
  ],
  "rule": "В этих сочетаниях содержимое стоит в родительном: glāze piena, krūze tējas. Падеж слова-меры зависит от предложения: glāze piena → Es redzu glāzi piena. Содержимое остаётся в родительном.",
  "warning": "Это модель «мера/сосуд + содержимое», не правило «после любого количества только родительный». Слово меры и содержимое имеют разные роли; piena glāze может обозначать стакан для молока, а не количество молока."
};

export default function TableQuantityGenitive() {
  return <SentencePatternTable {...pattern} />;
}

