import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-modal-infinitive",
  "title": "Es gribu · es varu",
  "subtitle": "Хочу / могу + действие",
  "columns": [
    {
      "key": "subject",
      "title": "Кто?",
      "width": 16
    },
    {
      "key": "modal",
      "title": "Личная форма",
      "width": 23
    },
    {
      "key": "infinitive",
      "title": "Что делать?",
      "width": 24
    },
    {
      "key": "translation",
      "title": "Смысл",
      "width": 37
    }
  ],
  "rows": [
    {
      "key": "es-gribu",
      "classes": "tt-want",
      "cells": [
        "es",
        "gribu",
        "ceļot",
        "Я хочу путешествовать."
      ]
    },
    {
      "key": "tu-vari",
      "classes": "tt-can",
      "cells": [
        "tu",
        "vari",
        "braukt",
        "Ты можешь ехать."
      ]
    },
    {
      "key": "vina-grib",
      "classes": "tt-want",
      "cells": [
        "viņa",
        "grib",
        "nakšņot",
        "Она хочет переночевать."
      ]
    },
    {
      "key": "mes-varam",
      "classes": "tt-can",
      "cells": [
        "mēs",
        "varam",
        "rezervēt",
        "Мы можем забронировать."
      ]
    },
    {
      "key": "jus-gribat",
      "classes": "tt-want",
      "cells": [
        "jūs",
        "gribat",
        "zvanīt",
        "Вы хотите позвонить."
      ]
    },
    {
      "key": "vini-nevar",
      "classes": "tt-negative tt-can",
      "cells": [
        "viņi",
        "nevar",
        "braukt",
        "Они не могут ехать."
      ]
    }
  ],
  "rule": "Gribēt и varēt меняются по лицу и времени. Следующее действие — в инфинитиве: Es gribu braukt; Mēs varam braukt.",
  "warning": "Не общее правило любого второго глагола. Сравнивать с Man patīk braukt: у patīk человек в дательном, здесь подлежащее es/mēs."
};

export default function TableModalInfinitive() {
  return <SentencePatternTable {...pattern} />;
}
