import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-reflexive-pattern",
  "title": "Vēlēties · vēlos · vēlēšos",
  "subtitle": "Возвратный глагол в трёх временах",
  "columns": [
    {
      "key": "person",
      "title": "Кто?",
      "width": 18
    },
    {
      "key": "present",
      "title": "Сейчас",
      "width": 25
    },
    {
      "key": "past",
      "title": "Раньше",
      "width": 27
    },
    {
      "key": "future",
      "title": "Потом",
      "width": 30
    }
  ],
  "rows": [
    {
      "key": "first",
      "cells": [
        "es",
        "vēlos",
        "vēlējos",
        "vēlēšos"
      ]
    },
    {
      "key": "second",
      "cells": [
        "tu",
        "vēlies",
        "vēlējies",
        "vēlēsies"
      ]
    },
    {
      "key": "third",
      "cells": [
        "viņš / viņa",
        "vēlas",
        "vēlējās",
        "vēlēsies"
      ]
    },
    {
      "key": "we",
      "cells": [
        "mēs",
        "vēlamies",
        "vēlējāmies",
        "vēlēsimies"
      ]
    },
    {
      "key": "you",
      "cells": [
        "jūs",
        "vēlaties",
        "vēlējāties",
        "vēlēsieties / vēlēsities"
      ]
    },
    {
      "key": "they",
      "cells": [
        "viņi / viņas",
        "vēlas",
        "vēlējās",
        "vēlēsies"
      ]
    }
  ],
  "rule": "Vēlēties — возвратный глагол «хотеть, желать». Окончание зависит от лица и времени. Третье лицо одинаково в единственном и множественном числе. После личной формы можно поставить инфинитив: Es vēlos īrēt dzīvokli.",
  "warning": "Это парадигма именно vēlēties, а не универсальные формы всех возвратных глаголов. Обе формы будущего jūs vēlēsieties и jūs vēlēsities засчитываются. Прошедшее ещё не означает, что желание исполнилось."
};

export default function TableReflexiveVerbPattern() {
  return <SentencePatternTable {...pattern} />;
}

