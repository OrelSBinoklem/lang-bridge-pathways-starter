import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-relative-clause",
  "title": "Autors, kurš raksta pasakas",
  "subtitle": "Определяемое слово · роль внутри придаточного",
  "columns": [
    {
      "key": "noun",
      "title": "Слово",
      "width": 19
    },
    {
      "key": "link",
      "title": "Связь",
      "width": 17
    },
    {
      "key": "role",
      "title": "Роль",
      "width": 24
    },
    {
      "key": "clause",
      "title": "Придаточное",
      "width": 40
    }
  ],
  "rows": [
    {
      "key": "actor-male",
      "cells": [
        "autoru",
        "kurš",
        "кто пишет?",
        "kurš raksta pasakas"
      ]
    },
    {
      "key": "actor-female",
      "cells": [
        "rakstnieci",
        "kura",
        "кто говорит?",
        "kura runā ar bērniem"
      ]
    },
    {
      "key": "object",
      "cells": [
        "grāmatu",
        "kuru",
        "что читают?",
        "kuru draugs lasa"
      ]
    },
    {
      "key": "recipient",
      "cells": [
        "rakstnieks",
        "kuram",
        "кому пишут?",
        "kuram mēs rakstām"
      ]
    },
    {
      "key": "place",
      "cells": [
        "lasītava",
        "kurā",
        "где читают?",
        "kurā mēs lasām"
      ]
    },
    {
      "key": "places",
      "cells": [
        "grāmatas",
        "kurās",
        "где есть рисунки?",
        "kurās ir attēli"
      ]
    }
  ],
  "rule": "Придаточное уточняет существительное. Род и число kurš/kura соответствуют этому слову, а падеж зависит от роли местоимения внутри придаточного. Es pazīstu autoru, kurš raksta pasakas: autoru — винительный в главной части, kurš — именительный, потому что автор пишет. Между частями ставится запятая.",
  "warning": "Первый слой B1: формы kurš/kura в именительном, винительном, дательном и местном. Kas тоже может вводить относительное придаточное; в этих заданиях явно запрошена семья kurš/kura. Не переносим падеж существительного автоматически и не считаем заданный порядок единственным в свободной речи."
};

export default function TableRelativeClause() {
  return <SentencePatternTable {...pattern} />;
}
