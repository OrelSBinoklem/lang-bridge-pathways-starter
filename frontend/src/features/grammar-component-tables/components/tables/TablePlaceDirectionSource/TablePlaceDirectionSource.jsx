import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-place-direction-source",
  "title": "Kur? · Uz kurieni? · No kurienes?",
  "subtitle": "Где, куда и откуда",
  "columns": [
    {
      "key": "question",
      "title": "Вопрос",
      "width": 23
    },
    {
      "key": "meaning",
      "title": "Значение",
      "width": 18
    },
    {
      "key": "form",
      "title": "Форма",
      "width": 25
    },
    {
      "key": "example",
      "title": "Пример",
      "width": 34
    }
  ],
  "rows": [
    {
      "key": "city-place",
      "classes": "tt-locative",
      "cells": [
        "Kur?",
        "Где?",
        "Rīgā",
        "Es esmu Rīgā."
      ]
    },
    {
      "key": "city-direction",
      "classes": "tt-accusative",
      "cells": [
        "Uz kurieni?",
        "Куда?",
        "uz Rīgu",
        "Es braucu uz Rīgu."
      ]
    },
    {
      "key": "city-source",
      "classes": "tt-genitive",
      "cells": [
        "No kurienes?",
        "Откуда?",
        "no Rīgas",
        "Es braucu no Rīgas."
      ]
    },
    {
      "key": "station-place",
      "classes": "tt-locative",
      "cells": [
        "Kur?",
        "Где?",
        "stacijā",
        "Es esmu stacijā."
      ]
    },
    {
      "key": "station-direction",
      "classes": "tt-accusative",
      "cells": [
        "Uz kurieni?",
        "Куда?",
        "uz staciju",
        "Es braucu uz staciju."
      ]
    },
    {
      "key": "station-source",
      "classes": "tt-genitive",
      "cells": [
        "No kurienes?",
        "Откуда?",
        "no stacijas",
        "Es braucu no stacijas."
      ]
    }
  ],
  "rule": "Для этих названий в единственном числе: где — местный без предлога; куда — uz + винительный; откуда — no + родительный.",
  "warning": "Не всякое направление выражается через uz. Для названий во множественном числе, например Cēsis, нужна отдельная модель; здесь только единственное число."
};

export default function TablePlaceDirectionSource() {
  return <SentencePatternTable {...pattern} />;
}
