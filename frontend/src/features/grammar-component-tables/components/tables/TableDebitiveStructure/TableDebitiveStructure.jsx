import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-debitive-structure",
  "title": "Man ir jālasa grāmata",
  "subtitle": "Кому нужно · действие · объект",
  "columns": [
    {
      "key": "person",
      "title": "Кому?",
      "width": 20
    },
    {
      "key": "time",
      "title": "Время",
      "width": 17
    },
    {
      "key": "action",
      "title": "Действие",
      "width": 28
    },
    {
      "key": "object",
      "title": "Что?",
      "width": 35
    }
  ],
  "rows": [
    {
      "key": "present",
      "cells": [
        "man",
        "ir",
        "jālasa",
        "grāmata"
      ]
    },
    {
      "key": "past",
      "cells": [
        "tev",
        "bija",
        "jāraksta",
        "apsveikums"
      ]
    },
    {
      "key": "future",
      "cells": [
        "viņai",
        "būs",
        "jāmeklē",
        "darbs"
      ]
    },
    {
      "key": "negative",
      "cells": [
        "mums",
        "nav",
        "jāņem",
        "dokumenti"
      ]
    },
    {
      "key": "reflexive",
      "cells": [
        "jums",
        "ir",
        "jāmācās",
        "действие без объекта"
      ]
    },
    {
      "key": "exception",
      "cells": [
        "viņam",
        "ir",
        "jābūt",
        "būt → jābūt"
      ]
    }
  ],
  "rule": "Кому необходимо действие — дательный падеж. У большинства глаголов форма jā- образуется от третьего лица настоящего: raksta → jāraksta, mācās → jāmācās. Исключение būt → jābūt. Время выражается ir / bija / būs, отрицание необходимости — nav / nebija / nebūs. В этой прямой конструкции существительное, называющее объект действия, стоит в именительном.",
  "warning": "Здесь только прямая конструкция с существительным. Личные местоимения mani/tevi и объект после добавленного инфинитива — отдельные случаи. Не переносим именительный на любую фразу с jā-. Nav jā- означает отсутствие необходимости, не запрет. В настоящем ir можно опустить; в отрицании nav сохраняется."
};

export default function TableDebitiveStructure() {
  return <SentencePatternTable {...pattern} />;
}

