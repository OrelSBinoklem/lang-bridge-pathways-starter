import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-transitive-object",
  "title": "Kas pērk? · Ko pērk?",
  "subtitle": "Кто покупает что · винительный объекта",
  "columns": [
    {
      "key": "subject",
      "title": "Кто?",
      "width": 17
    },
    {
      "key": "action",
      "title": "Действие",
      "width": 20
    },
    {
      "key": "form",
      "title": "Что покупают?",
      "width": 30
    },
    {
      "key": "base",
      "title": "Исходное слово",
      "width": 33
    }
  ],
  "rows": [
    {
      "key": "milk",
      "cells": [
        "Es",
        "pērku",
        "pienu",
        "piens"
      ]
    },
    {
      "key": "bread",
      "cells": [
        "Tu",
        "pērc",
        "maizi",
        "maize"
      ]
    },
    {
      "key": "tea",
      "cells": [
        "Viņa",
        "pērk",
        "tēju",
        "tēja"
      ]
    },
    {
      "key": "carrots",
      "cells": [
        "Mēs",
        "pērkam",
        "burkānus",
        "burkāni"
      ]
    },
    {
      "key": "plums",
      "cells": [
        "Jūs",
        "pērkat",
        "plūmes",
        "plūmes"
      ]
    },
    {
      "key": "adjective",
      "cells": [
        "Viņi",
        "pērk",
        "lētas plūmes",
        "lēts + plūmes"
      ]
    }
  ],
  "rule": "В модели pirkt покупаемый предмет отвечает на ko? и стоит в винительном: piens → pienu, maize → maizi. Прилагательное согласуется с предметом: lētu maizi, lētus burkānus, lētas plūmes.",
  "warning": "Не любое дополнение любого глагола — винительный. Здесь только покупка pirkt. У части существительных форма винительного совпадает с именительным; это не отменяет роли объекта. Прилагательные здесь неопределённые."
};

export default function TableTransitiveObject() {
  return <SentencePatternTable {...pattern} />;
}

