import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-necessity-vajag",
  "title": "Man vajag mācīties",
  "subtitle": "Кому нужно · действие в инфинитиве",
  "columns": [
    {
      "key": "person",
      "title": "Кому?",
      "width": 20
    },
    {
      "key": "need",
      "title": "Когда?",
      "width": 24
    },
    {
      "key": "action",
      "title": "Действие",
      "width": 27
    },
    {
      "key": "phrase",
      "title": "Связь",
      "width": 29
    }
  ],
  "rows": [
    {
      "key": "first",
      "cells": [
        "man",
        "vajag",
        "mācīties",
        "man + vajag + инфинитив"
      ]
    },
    {
      "key": "second",
      "cells": [
        "tev",
        "vajag",
        "atpūsties",
        "tev + vajag + инфинитив"
      ]
    },
    {
      "key": "we",
      "cells": [
        "mums",
        "vajag",
        "tīrīt istabu",
        "лицо не меняет vajag"
      ]
    },
    {
      "key": "past",
      "cells": [
        "viņai",
        "vajadzēja",
        "celties",
        "прошедшее"
      ]
    },
    {
      "key": "future",
      "cells": [
        "jums",
        "vajadzēs",
        "doties mājās",
        "будущее"
      ]
    },
    {
      "key": "negative",
      "cells": [
        "viņam",
        "nevajag",
        "gaidīt",
        "отрицание"
      ]
    }
  ],
  "rule": "Кому нужна деятельность — дательный падеж: man, tev, viņam, viņai, mums, jums, viņiem, viņām. Действие после vajag — инфинитив, в том числе возвратный. Vajag не меняется по лицам: Man vajag mācīties. Mums vajag mācīties.",
  "warning": "Время выражается vajag / vajadzēja / vajadzēs; отрицание — nevajag / nevajadzēja / nevajadzēs. В заданиях запрошена литературная форма настоящего vajag; разговорное vajaga существует. Существительное без инфинитива и конструкция с jā- — отдельные модели."
};

export default function TableNecessityVajag() {
  return <SentencePatternTable {...pattern} />;
}

