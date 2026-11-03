import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-adjective-attachment",
  "title": "Jaunā brāļa māja · brāļa jaunā māja",
  "subtitle": "К кому относится прилагательное",
  "columns": [
    {
      "key": "target",
      "title": "Признак",
      "width": 22
    },
    {
      "key": "person",
      "title": "Человек",
      "width": 22
    },
    {
      "key": "thing",
      "title": "Предмет",
      "width": 22
    },
    {
      "key": "phrase",
      "title": "Фраза",
      "width": 34
    }
  ],
  "rows": [
    {
      "key": "youngbrother",
      "cells": [
        "молодой брат",
        "jaunā brāļa",
        "māja",
        "jaunā brāļa māja"
      ]
    },
    {
      "key": "newhouse",
      "cells": [
        "новый дом",
        "brāļa",
        "jaunā māja",
        "brāļa jaunā māja"
      ]
    },
    {
      "key": "youngsister",
      "cells": [
        "молодая сестра",
        "jaunās māsas",
        "skapis",
        "jaunās māsas skapis"
      ]
    },
    {
      "key": "newwardrobe",
      "cells": [
        "новый шкаф",
        "māsas",
        "jaunais skapis",
        "māsas jaunais skapis"
      ]
    },
    {
      "key": "youngplace",
      "cells": [
        "молодой брат",
        "jaunā brāļa",
        "mājā",
        "jaunā brāļa mājā"
      ]
    },
    {
      "key": "newplace",
      "cells": [
        "новый дом",
        "brāļa",
        "jaunajā mājā",
        "brāļa jaunajā mājā"
      ]
    }
  ],
  "rule": "Сначала выбираем, кого описывает прилагательное. Если человека-владельца, оно принимает генитив вместе с ним: jaunā brāļa, jaunās māsas. Если предмет, согласуется с предметом: jaunā māja, jaunais skapis, jaunajā mājā.",
  "warning": "Здесь специально тренируем определённые окончания и заданные связи, а не правило «в латышском всегда один порядок слов». Jauns о человеке — молодой, о предмете — новый. Генитив владельца не становится местным только потому, что главное слово стоит в местном."
};

export default function TableAdjectiveAttachment() {
  return <SentencePatternTable {...pattern} />;
}

