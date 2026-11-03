import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-definite-context",
  "title": "Maza dāvana · mazā dāvana",
  "subtitle": "Известный предмет или ещё не выделенный",
  "columns": [
    {
      "key": "context",
      "title": "Смысл",
      "width": 27
    },
    {
      "key": "form",
      "title": "Форма",
      "width": 22
    },
    {
      "key": "noun",
      "title": "Предмет",
      "width": 20
    },
    {
      "key": "phrase",
      "title": "Пример",
      "width": 31
    }
  ],
  "rows": [
    {
      "key": "new-male",
      "cells": [
        "ещё не выделенный",
        "mazs",
        "galds",
        "Te ir mazs galds."
      ]
    },
    {
      "key": "known-male",
      "cells": [
        "тот самый стол",
        "mazais",
        "galds",
        "Mazais galds ir te."
      ]
    },
    {
      "key": "new-female",
      "cells": [
        "ещё не выделенный",
        "maza",
        "dāvana",
        "Te ir maza dāvana."
      ]
    },
    {
      "key": "known-female",
      "cells": [
        "тот самый подарок",
        "mazā",
        "dāvana",
        "Mazā dāvana ir tev."
      ]
    },
    {
      "key": "new-acc",
      "cells": [
        "неопределённый · ko?",
        "mazu",
        "dāvanu",
        "Es redzu mazu dāvanu."
      ]
    },
    {
      "key": "known-acc",
      "cells": [
        "определённый · ko?",
        "mazo",
        "dāvanu",
        "Es redzu mazo dāvanu."
      ]
    }
  ],
  "rule": "Неопределённое окончание здесь вводит ещё не выделенный предмет, определённое — указывает на уже известный и выделяемый среди других. Сначала читаем ситуацию, затем выбираем окончание и согласуем форму с существительным. Это учебный контраст, не правило «первое упоминание всегда неопределённое»: терминология, превосходная степень и устойчивые сочетания имеют свои условия.",
  "warning": "В заданиях нужный тип окончания задан прямо вместе с ситуацией. Без контекста не объявляем одну из двух грамматически возможных форм неверной. Здесь единственное число, именительный и винительный; остальные падежи доступны в общей таблице окончаний."
};

export default function TableDefiniteContext() {
  return <SentencePatternTable {...pattern} />;
}

