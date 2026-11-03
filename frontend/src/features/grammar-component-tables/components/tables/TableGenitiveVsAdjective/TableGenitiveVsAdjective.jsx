import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-genitive-adjective",
  "title": "Vilnas jaka · silta jaka",
  "subtitle": "Генитив или согласуемое прилагательное",
  "columns": [
    {
      "key": "meaning",
      "title": "Признак",
      "width": 24
    },
    {
      "key": "nom",
      "title": "Kas?",
      "width": 25
    },
    {
      "key": "loc",
      "title": "Kur?",
      "width": 25
    },
    {
      "key": "change",
      "title": "Изменение",
      "width": 26
    }
  ],
  "rows": [
    {
      "key": "material",
      "cells": [
        "материал",
        "vilnas jaka",
        "vilnas jakā",
        "vilnas не меняется"
      ]
    },
    {
      "key": "season",
      "cells": [
        "сезон",
        "ziemas mētelis",
        "ziemas mētelī",
        "ziemas не меняется"
      ]
    },
    {
      "key": "purpose",
      "cells": [
        "назначение",
        "sporta krekls",
        "sporta kreklā",
        "sporta не меняется"
      ]
    },
    {
      "key": "rubber",
      "cells": [
        "материал",
        "gumijas zābaki",
        "gumijas zābakos",
        "gumijas не меняется"
      ]
    },
    {
      "key": "adjective",
      "cells": [
        "качество",
        "silta jaka",
        "siltā jakā",
        "прилагательное согласуется"
      ]
    },
    {
      "key": "both",
      "cells": [
        "два признака",
        "jauni vilnas cimdi",
        "jaunos vilnas cimdos",
        "меняется только jauni"
      ]
    }
  ],
  "rule": "В этих сочетаниях материал, сезон или назначение выражены существительным в генитиве: vilnas, ziemas, sporta. При смене падежа главного слова этот генитив сохраняется. Прилагательное согласуется с главным словом в роде, числе и падеже.",
  "warning": "Здесь тренируем неопределённые окончания прилагательных: silta → siltā, jauni → jaunos. Определённые формы siltajā и jaunajos существуют, но относятся к следующему этапу. Не распространяй неизменность зависимого генитива на любые конструкции."
};

export default function TableGenitiveVsAdjective() {
  return <SentencePatternTable {...pattern} />;
}

