import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-preposition-number",
  "title": "Ar ko? · Viens / vairāki",
  "subtitle": "С кем и на чём · ar + число",
  "columns": [
    {
      "key": "base",
      "title": "Исходное слово",
      "width": 23
    },
    {
      "key": "singular",
      "title": "Один / одна",
      "width": 25
    },
    {
      "key": "plural",
      "title": "Несколько",
      "width": 27
    },
    {
      "key": "role",
      "title": "Смысл",
      "width": 25
    }
  ],
  "rows": [
    {
      "key": "train",
      "cells": [
        "vilciens",
        "ar vilcienu",
        "ar vilcieniem",
        "на поезде / поездах"
      ]
    },
    {
      "key": "bus",
      "cells": [
        "autobuss",
        "ar autobusu",
        "ar autobusiem",
        "на автобусе / автобусах"
      ]
    },
    {
      "key": "ferry",
      "cells": [
        "prāmis",
        "ar prāmi",
        "ar prāmjiem",
        "на пароме / паромах"
      ]
    },
    {
      "key": "brother",
      "cells": [
        "brālis",
        "ar brāli",
        "ar brāļiem",
        "с братом / братьями"
      ]
    },
    {
      "key": "sister",
      "cells": [
        "māsa",
        "ar māsu",
        "ar māsām",
        "с сестрой / сёстрами"
      ]
    },
    {
      "key": "adjective",
      "cells": [
        "jauns vilciens",
        "ar jaunu vilcienu",
        "ar jauniem vilcieniem",
        "прилагательное + имя"
      ]
    }
  ],
  "rule": "После ar в единственном числе форма существительного совпадает с винительным, во множественном — с дательным: ar vilcienu / ar vilcieniem. Прилагательное принимает то же число и падеж: ar jaunu vilcienu / ar jauniem vilcieniem.",
  "warning": "Это только модель ar: средство передвижения или спутник. Не переносить правило единственного числа на все предлоги. В традиционном описании сочетание с ar называется инструменталисом; здесь формы сравниваются с винительным и дательным. Для prāmis и brālis во множественном есть чередование: prāmjiem, brāļiem."
};

export default function TablePrepositionNumber() {
  return <SentencePatternTable {...pattern} />;
}
