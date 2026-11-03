'use client';

import React from 'react';
import VerbConjugationBase from './VerbConjugationBase';

/**
 * КАТЕГОРИЯ 3: dzert, strādāt, lasīt + ģērbties, gatavoties, mācīties
 * По 15 форм в каждой таблице (6 глаголов). customComponents.js → 20:1983
 */
const VerbConjugationCategory3 = (props) => {
  // ['forma', 'standard'] — standard = translation_1 в БД
  const verbs = {
    'dzert': {
      name: 'dzert - пить (I konjugācija, -t)',

      'es_past': ['dzēru', 'dzert es pag'],
      'es_present': ['dzeru', 'dzert es tag'],
      'es_future': ['dzeršu', 'dzert es nak'],
      'tu_past': ['dzēri', 'dzert tu pag'],
      'tu_present': ['dzer', 'dzert tu tag'],
      'tu_future': ['dzersi', 'dzert tu nak'],
      '3pers_past': ['dzēra', 'dzert 3p pag'],
      '3pers_present': ['dzer', 'dzert 3p tag'],
      '3pers_future': ['dzers', 'dzert 3p nak'],
      'we_past': ['dzērām', 'dzert mes pag'],
      'we_present': ['dzeram', 'dzert mes tag'],
      'we_future': ['dzersim', 'dzert mes nak'],
      'you_pl_past': ['dzērāt', 'dzert jus pag'],
      'you_pl_present': ['dzerat', 'dzert jus tag'],
      'you_pl_future': ['dzersiet', 'dzert jus nak'],
    },
    'strādāt': {
      name: 'strādāt - работать (II konjugācija, -āt)',

      'es_past': ['strādāju', 'strādāt es pag'],
      'es_present': ['strādāju', 'strādāt es tag'],
      'es_future': ['strādāšu', 'strādāt es nak'],
      'tu_past': ['strādāji', 'strādāt tu pag'],
      'tu_present': ['strādā', 'strādāt tu tag'],
      'tu_future': ['strādāsi', 'strādāt tu nak'],
      '3pers_past': ['strādāja', 'strādāt 3p pag'],
      '3pers_present': ['strādā', 'strādāt 3p tag'],
      '3pers_future': ['strādās', 'strādāt 3p nak'],
      'we_past': ['strādājām', 'strādāt mes pag'],
      'we_present': ['strādājam', 'strādāt mes tag'],
      'we_future': ['strādāsim', 'strādāt mes nak'],
      'you_pl_past': ['strādājāt', 'strādāt jus pag'],
      'you_pl_present': ['strādājat', 'strādāt jus tag'],
      'you_pl_future': ['strādāsiet', 'strādāt jus nak'],
    },
    'lasīt': {
      name: 'lasīt - читать (III konjugācija, -īt)',

      'es_past': ['lasīju', 'lasīt es pag'],
      'es_present': ['lasu', 'lasīt es tag'],
      'es_future': ['lasīšu', 'lasīt es nak'],
      'tu_past': ['lasīji', 'lasīt tu pag'],
      'tu_present': ['lasi', 'lasīt tu tag'],
      'tu_future': ['lasīsi', 'lasīt tu nak'],
      '3pers_past': ['lasīja', 'lasīt 3p pag'],
      '3pers_present': ['lasa', 'lasīt 3p tag'],
      '3pers_future': ['lasīs', 'lasīt 3p nak'],
      'we_past': ['lasījām', 'lasīt mes pag'],
      'we_present': ['lasām', 'lasīt mes tag'],
      'we_future': ['lasīsim', 'lasīt mes nak'],
      'you_pl_past': ['lasījāt', 'lasīt jus pag'],
      'you_pl_present': ['lasāt', 'lasīt jus tag'],
      'you_pl_future': ['lasīsiet', 'lasīt jus nak'],
    },
    'ģērbties': {
      name: 'ģērbties - одеваться (I konjugācija, atgriezenisks)',

      'es_past': ['ģērbos', 'ģērbties es pag'],
      'es_present': ['ģērbjos', 'ģērbties es tag'],
      'es_future': ['ģērbšos', 'ģērbties es nak'],
      'tu_past': ['ģērbies', 'ģērbties tu pag'],
      'tu_present': ['ģērbies', 'ģērbties tu tag'],
      'tu_future': ['ģērbsies', 'ģērbties tu nak'],
      '3pers_past': ['ģērbās', 'ģērbties 3p pag'],
      '3pers_present': ['ģērbjas', 'ģērbties 3p tag'],
      '3pers_future': ['ģērbsies', 'ģērbties 3p nak'],
      'we_past': ['ģērbāmies', 'ģērbties mes pag'],
      'we_present': ['ģērbjamies', 'ģērbties mes tag'],
      'we_future': ['ģērbsimies', 'ģērbties mes nak'],
      'you_pl_past': ['ģērbāties', 'ģērbties jus pag'],
      'you_pl_present': ['ģērbjaties', 'ģērbties jus tag'],
      'you_pl_future': ['ģērbsieties', 'ģērbties jus nak'],
    },
    'gatavoties': {
      name: 'gatavoties - готовиться (II konjugācija, atgriezenisks)',

      'es_past': ['gatavojos', 'gatavoties es pag'],
      'es_present': ['gatavojos', 'gatavoties es tag'],
      'es_future': ['gatavošos', 'gatavoties es nak'],
      'tu_past': ['gatavojies', 'gatavoties tu pag'],
      'tu_present': ['gatavojies', 'gatavoties tu tag'],
      'tu_future': ['gatavosies', 'gatavoties tu nak'],
      '3pers_past': ['gatavojās', 'gatavoties 3p pag'],
      '3pers_present': ['gatavojas', 'gatavoties 3p tag'],
      '3pers_future': ['gatavosies', 'gatavoties 3p nak'],
      'we_past': ['gatavojāmies', 'gatavoties mes pag'],
      'we_present': ['gatavojamies', 'gatavoties mes tag'],
      'we_future': ['gatavosimies', 'gatavoties mes nak'],
      'you_pl_past': ['gatavojāties', 'gatavoties jus pag'],
      'you_pl_present': ['gatavojaties', 'gatavoties jus tag'],
      'you_pl_future': ['gatavosieties', 'gatavoties jus nak'],
    },
    'mācīties': {
      name: 'mācīties - учиться (III konjugācija, atgriezenisks)',

      'es_past': ['mācījos', 'mācīties es pag'],
      'es_present': ['mācos', 'mācīties es tag'],
      'es_future': ['mācīšos', 'mācīties es nak'],
      'tu_past': ['mācījies', 'mācīties tu pag'],
      'tu_present': ['mācies', 'mācīties tu tag'],
      'tu_future': ['mācīsies', 'mācīties tu nak'],
      '3pers_past': ['mācījās', 'mācīties 3p pag'],
      '3pers_present': ['mācās', 'mācīties 3p tag'],
      '3pers_future': ['mācīsies', 'mācīties 3p nak'],
      'we_past': ['mācījāmies', 'mācīties mes pag'],
      'we_present': ['mācāmies', 'mācīties mes tag'],
      'we_future': ['mācīsimies', 'mācīties mes nak'],
      'you_pl_past': ['mācījāties', 'mācīties jus pag'],
      'you_pl_present': ['mācāties', 'mācīties jus tag'],
      'you_pl_future': ['mācīsieties', 'mācīties jus nak'],
    },
  };

  return <VerbConjugationBase verbs={verbs} {...props} />;
};

export default VerbConjugationCategory3;