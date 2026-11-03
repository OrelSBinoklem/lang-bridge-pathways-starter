'use client';

import React from 'react';
import VerbConjugationBase from './VerbConjugationBase';

/**
 * КАТЕГОРИЯ: Таблица спряжений глаголов
 * 
 * Использует базовый компонент VerbConjugationBase
 * Содержит глаголы из строк 159-338 (A1-A2)
 * 
 * Для использования:
 * 1. Зарегистрируйте в customComponents.js: 'category_id': VerbConjugationCategory
 * 2. Добавьте все формы спряжения через админку (см. CSV файлы)
 */
const VerbConjugationCategory = (props) => {
  // Ячейка: ['forma', 'standard'] — standard = translation_1 в БД (напр. 'būt es pag')
  const verbs = {
    'būt': {//+
      name: 'būt - быть',

      'es_past': ['biju', 'būt es pag'],
      'es_present': ['esmu', 'būt es tag'],
      //'es_future': ['būšu', 'būt es nak'],

      //'tu_past': ['biji', 'būt tu pag'],
      'tu_present': ['esi', 'būt tu tag'],
      //'tu_future': ['būsi', 'būt tu nak'],

      //'3pers_past': ['bija', 'būt 3p pag'],
      '3pers_present': ['ir', 'būt 3p tag'],
      //'3pers_future': ['būs', 'būt 3p nak'],

      //'we_past': ['bijām', 'būt mes pag'],
      'we_present': ['esam', 'būt mes tag'],
      //'we_future': ['būsim', 'būt mes nak'],

      //'you_pl_past': ['bijāt', 'būt jus pag'],
      'you_pl_present': ['esat', 'būt jus tag'],
      //'you_pl_future': ['būsiet', 'būt jus nak'],
    },
    'iet': {//+
      name: 'iet - идти',

      'es_past': ['gāju', 'iet es pag'],
      'es_present': ['eju', 'iet es tag'],
      //'es_future': ['iešu', 'iet es nak'],
//
      //'tu_past': ['gāji', 'iet tu pag'],
      //'tu_present': ['ej', 'iet tu tag'],
      //'tu_future': ['iesi', 'iet tu nak'],
//
      //'3pers_past': ['gāja', 'iet 3p pag'],
      '3pers_present': ['iet', 'iet 3p tag'],
      //'3pers_future': ['ies', 'iet 3p nak'],
//
      //'we_past': ['gājām', 'iet mes pag'],
      //'we_present': ['ejam', 'iet mes tag'],
      //'we_future': ['iesim', 'iet mes nak'],
//
      //'you_pl_past': ['gājāt', 'iet jus pag'],
      //'you_pl_present': ['ejat', 'iet jus tag'],
      //'you_pl_future': ['iesiet', 'iet jus nak'],
    },
    'patikt': {//+
      name: 'patikt - нравиться',

      //'es_past': ['patiku', 'patikt es pag'],
      'es_present': ['patīku', 'patikt es tag'],
      //'es_future': ['patikšu', 'patikt es nak'],
//
      //'tu_past': ['patiki', 'patikt tu pag'],
      'tu_present': ['patīc', 'patikt tu tag'],
      //'tu_future': ['patiksi', 'patikt tu nak'],
//
      //'3pers_past': ['patika', 'patikt 3p pag'],
      //'3pers_present': ['patīk', 'patikt 3p tag'],
      //'3pers_future': ['patiks', 'patikt 3p nak'],
//
      //'we_past': ['patikām', 'patikt mes pag'],
      //'we_present': ['patīkam', 'patikt mes tag'],
      //'we_future': ['patiksim', 'patikt mes nak'],
//
      //'you_pl_past': ['patikāt', 'patikt jus pag'],
      //'you_pl_present': ['patīkat', 'patikt jus tag'],
      //'you_pl_future': ['patiksiet', 'patikt jus nak'],
    },
    'pirkt': {//+
      name: 'pirkt - покупать',

      //'es_past': ['pirku', 'pirkt es pag'],
      'es_present': ['pērku', 'pirkt es tag'],
      //'es_future': ['pirkšu', 'pirkt es nak'],
//
      //'tu_past': ['pirki', 'pirkt tu pag'],
      'tu_present': ['pērc', 'pirkt tu tag'],
      //'tu_future': ['pirksi', 'pirkt tu nak'],
//
      //'3pers_past': ['pirka', 'pirkt 3p pag'],
      //'3pers_present': ['pērk', 'pirkt 3p tag'],
      //'3pers_future': ['pirks', 'pirkt 3p nak'],
//
      //'we_past': ['pirkām', 'pirkt mes pag'],
      //'we_present': ['pērkam', 'pirkt mes tag'],
      //'we_future': ['pirksim', 'pirkt mes nak'],
//
      //'you_pl_past': ['pirkāt', 'pirkt jus pag'],
      //'you_pl_present': ['pērkat', 'pirkt jus tag'],
      //'you_pl_future': ['pirksiet', 'pirkt jus nak'],
    },
    'pārdot': {//+
      name: 'pārdot - продать',

      'es_past': ['pārdevu', 'pārdot es pag'],
      'es_present': ['pārdodu', 'pārdot es tag'],
      //'es_future': ['pārdošu', 'pārdot es nak'],

      //'tu_past': ['pārdevi', 'pārdot tu pag'],
      //'tu_present': ['pārdod', 'pārdot tu tag'],
      //'tu_future': ['pārdosi', 'pārdot tu nak'],
//
      //'3pers_past': ['pārdeva', 'pārdot 3p pag'],
      //'3pers_present': ['pārdod', 'pārdot 3p tag'],
      //'3pers_future': ['pārdos', 'pārdot 3p nak'],
//
      //'we_past': ['pārdevām', 'pārdot mes pag'],
      //'we_present': ['pārdodam', 'pārdot mes tag'],
      //'we_future': ['pārdosim', 'pārdot mes nak'],
//
      //'you_pl_past': ['pārdevāt', 'pārdot jus pag'],
      //'you_pl_present': ['pārdodat', 'pārdot jus tag'],
      //'you_pl_future': ['pārdosiet', 'pārdot jus nak'],
    },
    'braukt': {//+
      name: 'braukt - ехать',

      'es_past': ['braucu', 'braukt es pag'],
      'es_present': ['braucu', 'braukt es tag'],
      //'es_future': ['braukšu', 'braukt es nak'],
//
      //'tu_past': ['brauci', 'braukt tu pag'],
      //'tu_present': ['brauc', 'braukt tu tag'],
      //'tu_future': ['brauksi', 'braukt tu nak'],
//
      //'3pers_past': ['brauca', 'braukt 3p pag'],
      //'3pers_present': ['brauc', 'braukt 3p tag'],
      //'3pers_future': ['brauks', 'braukt 3p nak'],
//
      //'we_past': ['braucām', 'braukt mes pag'],
      //'we_present': ['braucam', 'braukt mes tag'],
      //'we_future': ['brauksim', 'braukt mes nak'],
//
      //'you_pl_past': ['braucāt', 'braukt jus pag'],
      //'you_pl_present': ['braucat', 'braukt jus tag'],
      //'you_pl_future': ['brauksiet', 'braukt jus nak'],
    },
    'ēst': {//+
      name: 'ēst - кушать',

      'es_past': ['ēdu', 'ēst es pag'],
      'es_present': ['ēdu', 'ēst es tag'],
      'es_future': ['ēdīšu', 'ēst es nak'],

      //'tu_past': ['ēdi', 'ēst tu pag'],
      //'tu_present': ['ēd', 'ēst tu tag'],
      //'tu_future': ['ēdīsi', 'ēst tu nak'],
//
      //'3pers_past': ['ēda', 'ēst 3p pag'],
      //'3pers_present': ['ēd', 'ēst 3p tag'],
      //'3pers_future': ['ēdīs', 'ēst 3p nak'],
//
      //'we_past': ['ēdām', 'ēst mes pag'],
      //'we_present': ['ēdam', 'ēst mes tag'],
      //'we_future': ['ēdīsim', 'ēst mes nak'],
//
      //'you_pl_past': ['ēdāt', 'ēst jus pag'],
      //'you_pl_present': ['ēdat', 'ēst jus tag'],
      //'you_pl_future': ['ēdīsiet', 'ēst jus nak'],
    },
    'dzert': {//+
      name: 'dzert - пить',

      'es_past': ['dzēru', 'dzert es pag'],
      //'es_present': ['dzeru', 'dzert es tag'],
      //'es_future': ['dzeršu', 'dzert es nak'],
//
      //'tu_past': ['dzēri', 'dzert tu pag'],
      //'tu_present': ['dzer', 'dzert tu tag'],
      //'tu_future': ['dzersi', 'dzert tu nak'],
//
      //'3pers_past': ['dzēra', 'dzert 3p pag'],
      //'3pers_present': ['dzer', 'dzert 3p tag'],
      //'3pers_future': ['dzers', 'dzert 3p nak'],
//
      //'we_past': ['dzērām', 'dzert mes pag'],
      //'we_present': ['dzeram', 'dzert mes tag'],
      //'we_future': ['dzersim', 'dzert mes nak'],
//
      //'you_pl_past': ['dzērāt', 'dzert jus pag'],
      //'you_pl_present': ['dzerat', 'dzert jus tag'],
      //'you_pl_future': ['dzersiet', 'dzert jus nak'],
    },
    'atrast': {//+
      name: 'atrast - находить',

      'es_past': ['atradu', 'atrast es pag'],
      'es_present': ['atrodu', 'atrast es tag'],
      'es_future': ['atradīšu', 'atrast es nak'],

      //'tu_past': ['atradi', 'atrast tu pag'],
      //'tu_present': ['atrodi', 'atrast tu tag'],
      //'tu_future': ['atradīsi', 'atrast tu nak'],
//
      //'3pers_past': ['atrada', 'atrast 3p pag'],
      //'3pers_present': ['atrod', 'atrast 3p tag'],
      //'3pers_future': ['atradīs', 'atrast 3p nak'],
//
      //'we_past': ['atradām', 'atrast mes pag'],
      //'we_present': ['atrodam', 'atrast mes tag'],
      //'we_future': ['atradīsim', 'atrast mes nak'],
//
      //'you_pl_past': ['atradāt', 'atrast jus pag'],
      //'you_pl_present': ['atrodat', 'atrast jus tag'],
      //'you_pl_future': ['atradīsiet', 'atrast jus nak'],
    },
    'skriet': {//+
      name: 'skriet - бежать',

      'es_past': ['skrēju', 'skriet es pag'],
      'es_present': ['skrienu', 'skriet es tag'],
      //'es_future': ['skriešu', 'skriet es nak'],
//
      //'tu_past': ['skrēji', 'skriet tu pag'],
      //'tu_present': ['skrien', 'skriet tu tag'],
      //'tu_future': ['skriesi', 'skriet tu nak'],
//
      //'3pers_past': ['skrēja', 'skriet 3p pag'],
      //'3pers_present': ['skrien', 'skriet 3p tag'],
      //'3pers_future': ['skries', 'skriet 3p nak'],
//
      //'we_past': ['skrējām', 'skriet mes pag'],
      //'we_present': ['skrienam', 'skriet mes tag'],
      //'we_future': ['skriesim', 'skriet mes nak'],
//
      //'you_pl_past': ['skrējāt', 'skriet jus pag'],
      //'you_pl_present': ['skrienat', 'skriet jus tag'],
      //'you_pl_future': ['skriesiet', 'skriet jus nak'],
    },
  };

  return <VerbConjugationBase verbs={verbs} {...props} />;
};

export default VerbConjugationCategory;
