import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-subject-predicate",
  "title": "Kas dara?",
  "subtitle": "Подлежащее и глагол · настоящее время",
  "columns": [
    {
      "key": "subject",
      "title": "Кто?",
      "width": 16
    },
    {
      "key": "person",
      "title": "Лицо / число",
      "width": 23
    },
    {
      "key": "form",
      "title": "Глагол",
      "width": 26
    },
    {
      "key": "sentence",
      "title": "Предложение",
      "width": 35
    }
  ],
  "rows": [
    {
      "key": "es",
      "cells": [
        "es",
        "1-е, ед.",
        "mazgāju",
        "Es mazgāju traukus."
      ]
    },
    {
      "key": "tu",
      "cells": [
        "tu",
        "2-е, ед.",
        "mazgā",
        "Tu mazgā traukus."
      ]
    },
    {
      "key": "vins",
      "cells": [
        "viņš / viņa",
        "3-е, ед.",
        "mazgā",
        "Viņa mazgā traukus."
      ]
    },
    {
      "key": "mes",
      "cells": [
        "mēs",
        "1-е, мн.",
        "mazgājam",
        "Mēs mazgājam traukus."
      ]
    },
    {
      "key": "jus",
      "cells": [
        "jūs",
        "2-е, мн.",
        "mazgājat",
        "Jūs mazgājat traukus."
      ]
    },
    {
      "key": "vini",
      "cells": [
        "viņi / viņas",
        "3-е, мн.",
        "mazgā",
        "Viņi mazgā traukus."
      ]
    }
  ],
  "rule": "Форма глагола зависит от лица подлежащего. Для отрицания: ne- + личная форма, например mēs nemazgājam. Третье лицо имеет одну форму в обоих числах.",
  "warning": "Это не универсальные окончания всех глаголов. Формы разных глаголов сверяются со своим спряжением; отрицание būt имеет особую форму nav."
};

export default function TableSubjectPredicateAgreement() {
  return <SentencePatternTable {...pattern} />;
}

