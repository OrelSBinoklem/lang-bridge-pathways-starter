import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-negation-patterns",
  "title": "Ne- · nav · neesmu",
  "subtitle": "Отрицание действия, профессии и наличия",
  "columns": [
    {
      "key": "model",
      "title": "Модель",
      "width": 23
    },
    {
      "key": "positive",
      "title": "Утверждение",
      "width": 26
    },
    {
      "key": "negative",
      "title": "Отрицание",
      "width": 26
    },
    {
      "key": "form",
      "title": "Что меняется",
      "width": 25
    }
  ],
  "rows": [
    {
      "key": "work",
      "cells": [
        "действие",
        "Es strādāju.",
        "Es nestrādāju.",
        "ne- + глагол"
      ]
    },
    {
      "key": "read",
      "cells": [
        "действие",
        "Tu lasi grāmatu.",
        "Tu nelasi grāmatu.",
        "объект остаётся винительным"
      ]
    },
    {
      "key": "first",
      "cells": [
        "профессия",
        "Es esmu pavārs.",
        "Es neesmu pavārs.",
        "esmu → neesmu"
      ]
    },
    {
      "key": "third",
      "cells": [
        "профессия",
        "Viņa ir ārste.",
        "Viņa nav ārste.",
        "ir → nav"
      ]
    },
    {
      "key": "have",
      "cells": [
        "наличие",
        "Man ir grāmata.",
        "Man nav grāmatas.",
        "предмет → генитив"
      ]
    },
    {
      "key": "plural",
      "cells": [
        "наличие",
        "Mums ir darbs.",
        "Mums nav darba.",
        "обладатель — дательный"
      ]
    }
  ],
  "rule": "Действие отрицается ne-: strādāju → nestrādāju. У būt в настоящем: neesmu, neesi, nav, neesam, neesat, nav. Профессия в схеме «кто есть кто» остаётся именительной. В схеме отсутствия «кому + nav + чего» предмет стоит в родительном.",
  "warning": "Не смешивай ne-, nav и nē. Отрицание глагола само по себе не переводит объект в родительный: nelasu grāmatu. Генитив здесь нужен именно при отсутствии с nav. Будущее и прошедшее отрицание būt, сложные отрицательные местоимения и другие конструкции — следующие этапы."
};

export default function TableNegationPatterns() {
  return <SentencePatternTable {...pattern} />;
}
