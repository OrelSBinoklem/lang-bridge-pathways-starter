import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-age-dative",
  "title": "Cik tev ir gadu?",
  "subtitle": "Возраст · кому + ir + число",
  "columns": [
    {
      "key": "holder",
      "title": "Кому?",
      "width": 19
    },
    {
      "key": "number",
      "title": "Число",
      "width": 19
    },
    {
      "key": "form",
      "title": "Год / годы",
      "width": 23
    },
    {
      "key": "sentence",
      "title": "Предложение",
      "width": 39
    }
  ],
  "rows": [
    {
      "key": "one",
      "cells": [
        "dēlam",
        "1",
        "gads",
        "Dēlam ir 1 gads."
      ]
    },
    {
      "key": "two",
      "cells": [
        "meitai",
        "2",
        "gadi",
        "Meitai ir 2 gadi."
      ]
    },
    {
      "key": "eleven",
      "cells": [
        "brālim",
        "11",
        "gadu / gadi",
        "Brālim ir 11 gadu."
      ]
    },
    {
      "key": "twenty",
      "cells": [
        "māsai",
        "20",
        "gadu / gadi",
        "Māsai ir 20 gadi."
      ]
    },
    {
      "key": "twenty-one",
      "cells": [
        "man",
        "21",
        "gads",
        "Man ir 21 gads."
      ]
    },
    {
      "key": "twenty-two",
      "cells": [
        "tev",
        "22",
        "gadi",
        "Tev ir 22 gadi."
      ]
    }
  ],
  "rule": "Человек стоит в дательном: man, tev, brālim, māsai. В модели возраста 1/21/31… — gads; 2–9 и составные числа с такой последней частью — gadi. С несклоняемыми 10–19, 20/30… принимаются gadu и gadi.",
  "warning": "Не смешивай эту модель с «он X лет от роду»: Viņam ir 5 gadi, но Viņš ir piecus gadus vecs. Все числа и люди в заданиях вымышленные; дробные возраста и другие падежные конструкции здесь не проверяются."
};

export default function TableAgeDative() {
  return <SentencePatternTable {...pattern} />;
}
