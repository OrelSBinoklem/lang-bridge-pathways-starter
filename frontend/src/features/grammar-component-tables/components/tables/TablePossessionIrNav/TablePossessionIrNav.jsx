import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-possession-ir-nav",
  "title": "Man ir · man nav",
  "subtitle": "У кого есть и нет",
  "columns": [
    {
      "key": "holder",
      "title": "Кому? · Kam?",
      "width": 18
    },
    {
      "key": "link",
      "title": "Есть / нет",
      "width": 17
    },
    {
      "key": "object",
      "title": "Предмет",
      "width": 24
    },
    {
      "key": "example",
      "title": "Предложение",
      "width": 41
    }
  ],
  "rows": [
    {
      "key": "man-ir",
      "classes": "tt-affirmative",
      "cells": [
        "man",
        "ir",
        "brālis · Kas?",
        "Man ir brālis."
      ]
    },
    {
      "key": "man-nav",
      "classes": "tt-negative",
      "cells": [
        "man",
        "nav",
        "brāļa · Kā?",
        "Man nav brāļa."
      ]
    },
    {
      "key": "tev-ir",
      "classes": "tt-affirmative",
      "cells": [
        "tev",
        "ir",
        "māsa",
        "Tev ir māsa."
      ]
    },
    {
      "key": "vinai-nav",
      "classes": "tt-negative",
      "cells": [
        "viņai",
        "nav",
        "datora",
        "Viņai nav datora."
      ]
    },
    {
      "key": "mums-ir",
      "classes": "tt-affirmative",
      "cells": [
        "mums",
        "ir",
        "māja",
        "Mums ir māja."
      ]
    },
    {
      "key": "jums-nav",
      "classes": "tt-negative",
      "cells": [
        "jums",
        "nav",
        "mājas",
        "Jums nav mājas."
      ]
    }
  ],
  "rule": "Обладатель — дательный: man, tev, viņam, viņai, mums, jums, viņiem, viņām. После ir предмет в именительном, после nav — в родительном.",
  "warning": "Nav здесь отрицает наличие предмета. Не переносить это управление на любое отрицание: Es neredzu māju — винительный."
};

export default function TablePossessionIrNav() {
  return <SentencePatternTable {...pattern} />;
}
