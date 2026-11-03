import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-dative-recipient",
  "title": "Kas dod? · Kam? · Ko?",
  "subtitle": "Кто даёт · кому · что",
  "columns": [
    {
      "key": "subject",
      "title": "Кто?",
      "width": 16
    },
    {
      "key": "action",
      "title": "Действие",
      "width": 19
    },
    {
      "key": "recipient",
      "title": "Кому?",
      "width": 31
    },
    {
      "key": "object",
      "title": "Что?",
      "width": 34
    }
  ],
  "rows": [
    {
      "key": "sister",
      "cells": [
        "Es",
        "dodu",
        "māsai",
        "tēju"
      ]
    },
    {
      "key": "brother",
      "cells": [
        "Tu",
        "dod",
        "brālim",
        "maizi"
      ]
    },
    {
      "key": "mother",
      "cells": [
        "Viņa",
        "dod",
        "mātei",
        "pienu"
      ]
    },
    {
      "key": "father",
      "cells": [
        "Mēs",
        "dodam",
        "tēvam",
        "sulu"
      ]
    },
    {
      "key": "grandmother",
      "cells": [
        "Jūs",
        "dodat",
        "vecmāmiņai",
        "zupu"
      ]
    },
    {
      "key": "parents",
      "cells": [
        "Viņi",
        "dod",
        "vecākiem",
        "minerālūdeni"
      ]
    }
  ],
  "rule": "В этой модели dot получатель отвечает на kam? и стоит в дательном; передаваемый предмет отвечает на ko? и стоит в винительном: Es dodu māsai tēju. Личная форма dot зависит от того, кто даёт.",
  "warning": "Не путай получателя и предмет: māsai — кому, tēju — что. Порядок слов может меняться; только в заданиях на сборку задан порядок «кому → что». Другие значения dot и конструкции с предлогами здесь не обобщаются."
};

export default function TableDativeRecipient() {
  return <SentencePatternTable {...pattern} />;
}

