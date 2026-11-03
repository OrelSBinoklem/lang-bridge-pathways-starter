import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-verb-government",
  "title": "Par ko? · Ar ko? · Kas?",
  "subtitle": "Интересуюсь · занимаюсь · нравится",
  "columns": [
    {
      "key": "verb",
      "title": "Модель",
      "width": 25
    },
    {
      "key": "link",
      "title": "Связь",
      "width": 16
    },
    {
      "key": "form",
      "title": "Форма",
      "width": 21
    },
    {
      "key": "phrase",
      "title": "Пример",
      "width": 38
    }
  ],
  "rows": [
    {
      "key": "interest",
      "cells": [
        "Es interesējos",
        "par",
        "sportu",
        "Es interesējos par sportu."
      ]
    },
    {
      "key": "activity",
      "cells": [
        "Es nodarbojos",
        "ar",
        "sportu",
        "Es nodarbojos ar sportu."
      ]
    },
    {
      "key": "like",
      "cells": [
        "Man patīk",
        "без предлога",
        "sports",
        "Man patīk sports."
      ]
    },
    {
      "key": "musicinterest",
      "cells": [
        "Es interesējos",
        "par",
        "mūziku",
        "Es interesējos par mūziku."
      ]
    },
    {
      "key": "musicactivity",
      "cells": [
        "Es nodarbojos",
        "ar",
        "mūziku",
        "Es nodarbojos ar mūziku."
      ]
    },
    {
      "key": "musiclike",
      "cells": [
        "Man patīk",
        "без предлога",
        "mūzika",
        "Man patīk mūzika."
      ]
    }
  ],
  "rule": "Interesēties par — интересоваться темой; nodarboties ar — заниматься деятельностью. В этом наборе после par / ar существительные только в единственном числе, форма совпадает с винительным. После patīk предмет интереса стоит в именительном, а человек — в дательном.",
  "warning": "Не меняй предлог по русскому переводу. Увлечение можно любить, не занимаясь им. Формы множественного числа после предлогов имеют другую модель и здесь не проверяются. Другие значения глаголов и инфинитив после patīk — отдельные подэтапы."
};

export default function TableVerbGovernment() {
  return <SentencePatternTable {...pattern} />;
}

