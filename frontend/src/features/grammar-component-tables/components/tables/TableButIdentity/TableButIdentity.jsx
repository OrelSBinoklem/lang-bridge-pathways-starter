import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-but-identity",
  "title": "Būt · nebūt",
  "subtitle": "Кто я? Кто мы? · настоящее время",
  "columns": [
    {
      "key": "subject",
      "title": "Кто?",
      "width": 17
    },
    {
      "key": "form",
      "title": "Есть",
      "width": 18
    },
    {
      "key": "negative",
      "title": "Отрицание",
      "width": 23
    },
    {
      "key": "identity",
      "title": "Кто / кем является",
      "width": 42
    }
  ],
  "rows": [
    {
      "key": "es",
      "cells": [
        "es",
        "esmu",
        "neesmu",
        "Es esmu profesors."
      ]
    },
    {
      "key": "tu",
      "cells": [
        "tu",
        "esi",
        "neesi",
        "Tu esi profesore."
      ]
    },
    {
      "key": "vins",
      "cells": [
        "viņš / viņa",
        "ir",
        "nav",
        "Viņa ir profesore."
      ]
    },
    {
      "key": "mes",
      "cells": [
        "mēs",
        "esam",
        "neesam",
        "Mēs esam profesori."
      ]
    },
    {
      "key": "jus",
      "cells": [
        "jūs",
        "esat",
        "neesat",
        "Jūs esat profesores."
      ]
    },
    {
      "key": "vini",
      "cells": [
        "viņi / viņas",
        "ir",
        "nav",
        "Viņas nav profesores."
      ]
    }
  ],
  "rule": "Es esmu, tu esi, viņš/viņa ir, mēs esam, jūs esat, viņi/viņas ir. Название профессии здесь стоит в именительном и соответствует роду и числу людей.",
  "warning": "В третьем лице отрицание ir → nav, не neir. Viņa nav profesore — «она не профессор»; это не конструкция принадлежности Man nav profesora."
};

export default function TableButIdentity() {
  return <SentencePatternTable {...pattern} />;
}

