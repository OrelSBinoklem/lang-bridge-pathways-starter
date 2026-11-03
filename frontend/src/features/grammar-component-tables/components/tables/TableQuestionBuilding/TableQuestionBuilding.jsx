import SentencePatternTable from '../../SentencePatternTable.jsx';

const pattern = {
  "tableClass": "table-question-building",
  "title": "Kas? · Kā? · Kur? · Kad? · Vai?",
  "subtitle": "Вопрос к нужному смыслу",
  "columns": [
    {
      "key": "meaning",
      "title": "Смысл",
      "width": 23
    },
    {
      "key": "form",
      "title": "Начало",
      "width": 17
    },
    {
      "key": "question",
      "title": "Вопрос",
      "width": 34
    },
    {
      "key": "answer",
      "title": "Ответ",
      "width": 26
    }
  ],
  "rows": [
    {
      "key": "who",
      "cells": [
        "Кто / профессия",
        "kas",
        "Kas viņa ir?",
        "Viņa ir profesore."
      ]
    },
    {
      "key": "name",
      "cells": [
        "Как зовут",
        "kā",
        "Kā tevi sauc?",
        "Mani sauc Anna."
      ]
    },
    {
      "key": "where",
      "cells": [
        "Где",
        "kur",
        "Kur viņš ir?",
        "Viņš ir te."
      ]
    },
    {
      "key": "when",
      "cells": [
        "Когда",
        "kad",
        "Kad tiksimies?",
        "Citreiz."
      ]
    },
    {
      "key": "yes-no",
      "cells": [
        "Да / нет",
        "vai",
        "Vai tu esi profesors?",
        "Jā, es esmu profesors."
      ]
    },
    {
      "key": "plural",
      "cells": [
        "Как зовут вас",
        "kā",
        "Kā jūs sauc?",
        "Mūs sauc Anna un Līga."
      ]
    }
  ],
  "rule": "Выбирай вопрос по смыслу ответа. В Kā tevi sauc? лицо стоит в винительном: mani, tevi, viņu, mūs, jūs, viņus, viņas. Vai задаёт вопрос с ответом да / нет.",
  "warning": "Kas tevi sauc? значит «кто тебя зовёт?», не «как тебя зовут?». Порядок слов в латышском гибкий: здесь показаны нейтральные учебные модели, не единственно возможный порядок."
};

export default function TableQuestionBuilding() {
  return <SentencePatternTable {...pattern} />;
}

