import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-comparison-pattern",
  "title": "Lielāks par · vislielākais",
  "subtitle": "Сравнение предметов и выбор из группы",
  "columns": [
    {
      "key": "object",
      "title": "Предмет",
      "width": 24
    },
    {
      "key": "base",
      "title": "Признак",
      "width": 20
    },
    {
      "key": "more",
      "title": "Сравнение",
      "width": 25
    },
    {
      "key": "most",
      "title": "В группе",
      "width": 31
    }
  ],
  "rows": [
    {
      "key": "forest",
      "cells": [
        "mežs",
        "liels",
        "lielāks",
        "vislielākais"
      ]
    },
    {
      "key": "river",
      "cells": [
        "upe",
        "gara",
        "garāka",
        "visgarākā"
      ]
    },
    {
      "key": "tree",
      "cells": [
        "koks",
        "augsts",
        "augstāks",
        "visaugstākais"
      ]
    },
    {
      "key": "path",
      "cells": [
        "taka",
        "gara",
        "garāka",
        "visgarākā"
      ]
    },
    {
      "key": "oak",
      "cells": [
        "ozols",
        "liels",
        "lielāks",
        "vislielākais"
      ]
    },
    {
      "key": "spruce",
      "cells": [
        "egle",
        "augsta",
        "augstāka",
        "visaugstākā"
      ]
    }
  ],
  "rule": "Сравнительная степень: основа + -āk- + окончание по роду и числу. Превосходная: vis- + сравнительная основа + определённое окончание. При сравнении с одним предметом после par нужен винительный: garāka par upi, augstāks par koku.",
  "warning": "Сравнение предполагает конкретную величину или признак, а «самый» — обозначенную группу. Здесь после par только единственное число; множественное имеет другую падежную модель. Формы существительных и прилагательных проверяются отдельно."
};

export default function TableComparisonPattern() {
  return <SentencePatternTable {...pattern} />;
}
