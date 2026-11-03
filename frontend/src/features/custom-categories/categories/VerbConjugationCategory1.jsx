'use client';

import React from 'react';
import VerbConjugationBase from './VerbConjugationBase';

/**
 * КАТЕГОРИЯ 1: Таблица спряжений глаголов (первая группа)
 * 
 * Использует базовый компонент VerbConjugationBase
 * Содержит глаголы из строк 159-338
 */
const VerbConjugationCategory1 = (props) => {
  // Ячейка: ['forma', 'standard'] — standard = translation_1 в БД (напр. 'satikt es tag')
  const verbs = {
    /*A2*/


    'satikt': {//+
      name: 'satikt - встретить',

      //'es_past': ['satiku', 'satikt es pag'],
      'es_present': ['satieku', 'satikt es tag'],
      //'es_future': ['satikšu', 'satikt es nak'],
//
      //'tu_past': ['satiki', 'satikt tu pag'],
      'tu_present': ['satiec', 'satikt tu tag'],
      //'tu_future': ['satiksi', 'satikt tu nak'],
//
      //'3pers_past': ['satika', 'satikt 3p pag'],
      //'3pers_present': ['satiek', 'satikt 3p tag'],
      //'3pers_future': ['satiks', 'satikt 3p nak'],
//
      //'we_past': ['satikām', 'satikt mes pag'],
      //'we_present': ['satiekam', 'satikt mes tag'],
      //'we_future': ['satiksim', 'satikt mes nak'],
//
      //'you_pl_past': ['satikāt', 'satikt jus pag'],
      //'you_pl_present': ['satiekat', 'satikt jus tag'],
      //'you_pl_future': ['satiksiet', 'satikt jus nak'],
    },
    'nākt': {//+
      name: 'nākt - приходить',

      'es_past': ['nācu', 'nākt es pag'],
      //'es_present': ['nāku', 'nākt es tag'],
      //'es_future': ['nākšu', 'nākt es nak'],
//
      //'tu_past': ['nāci', 'nākt tu pag'],
      'tu_present': ['nāc', 'nākt tu tag'],
      //'tu_future': ['nāksi', 'nākt tu nak'],
//
      //'3pers_past': ['nāca', 'nākt 3p pag'],
      //'3pers_present': ['nāk', 'nākt 3p tag'],
      //'3pers_future': ['nāks', 'nākt 3p nak'],
//
      //'we_past': ['nācām', 'nākt mes pag'],
      //'we_present': ['nākam', 'nākt mes tag'],
      //'we_future': ['nāksim', 'nākt mes nak'],
//
      //'you_pl_past': ['nācāt', 'nākt jus pag'],
      //'you_pl_present': ['nākat', 'nākt jus tag'],
      //'you_pl_future': ['nāksiet', 'nākt jus nak'],
    },
    'ņemt': {//+
      name: 'ņemt - брать',

      'es_past': ['ņēmu', 'ņemt es pag'],
      //'es_present': ['ņemu', 'ņemt es tag'],
      //'es_future': ['ņemšu', 'ņemt es nak'],
//
      //'tu_past': ['ņēmi', 'ņemt tu pag'],
      //'tu_present': ['ņem', 'ņemt tu tag'],
      //'tu_future': ['ņemsi', 'ņemt tu nak'],
//
      //'3pers_past': ['ņēma', 'ņemt 3p pag'],
      //'3pers_present': ['ņem', 'ņemt 3p tag'],
      //'3pers_future': ['ņems', 'ņemt 3p nak'],
//
      //'we_past': ['ņēmām', 'ņemt mes pag'],
      //'we_present': ['ņemam', 'ņemt mes tag'],
      //'we_future': ['ņemsim', 'ņemt mes nak'],
//
      //'you_pl_past': ['ņēmāt', 'ņemt jus pag'],
      //'you_pl_present': ['ņemat', 'ņemt jus tag'],
      //'you_pl_future': ['ņemsiet', 'ņemt jus nak'],
    },

    'prast': {//+
      name: 'prast - уметь',

      'es_past': ['pratu', 'prast es pag'],
      'es_present': ['protu', 'prast es tag'],
      'es_future': ['pratīšu', 'prast es nak'],

      //'tu_past': ['prati', 'prast tu pag'],
      //'tu_present': ['proti', 'prast tu tag'],
      //'tu_future': ['pratīsi', 'prast tu nak'],
//
      //'3pers_past': ['prata', 'prast 3p pag'],
      //'3pers_present': ['prot', 'prast 3p tag'],
      //'3pers_future': ['pratīs', 'prast 3p nak'],
//
      //'we_past': ['pratām', 'prast mes pag'],
      //'we_present': ['protam', 'prast mes tag'],
      //'we_future': ['pratīsim', 'prast mes nak'],
//
      //'you_pl_past': ['pratāt', 'prast jus pag'],
      //'you_pl_present': ['protat', 'prast jus tag'],
      //'you_pl_future': ['pratīsiet', 'prast jus nak'],
    },
    "nest": {//+
      name: "nest - нести",

      //"es_past": ["nesu", "nest es pag"],
      //"es_present": ["nesu", "nest es tag"],
      "es_future": ["nesīšu", "nest es nak"],

      //"tu_past": ["nesi", "nest tu pag"],
      //"tu_present": ["nes", "nest tu tag"],
      //"tu_future": ["nesīsi", "nest tu nak"],

      //"3pers_past": ["nesa", "nest 3p pag"],
      //"3pers_present": ["nes", "nest 3p tag"],
      //"3pers_future": ["nesīs", "nest 3p nak"],

      //"we_past": ["nesām", "nest mes pag"],
      //"we_present": ["nesam", "nest mes tag"],
      //"we_future": ["nesīsim", "nest mes nak"],

      //"you_pl_past": ["nesāt", "nest jus pag"],
      //"you_pl_present": ["nesat", "nest jus tag"],
      //"you_pl_future": ["nesīsiet", "nest jus nak"]
    },
    'atrasties': {//+
      name: 'atrasties - находиться',

      'es_past': ['atrados', 'atrasties es pag'],
      'es_present': ['atrodos', 'atrasties es tag'],
      'es_future': ['atradīšos', 'atrasties es nak'],

      //'tu_past': ['atradies', 'atrasties tu pag'],
      //'tu_present': ['atrodies', 'atrasties tu tag'],
      //'tu_future': ['atradīsies', 'atrasties tu nak'],
//
      //'3pers_past': ['atradās', 'atrasties 3p pag'],
      //'3pers_present': ['atrodas', 'atrasties 3p tag'],
      //'3pers_future': ['atradīsies', 'atrasties 3p nak'],
//
      //'we_past': ['atradāmies', 'atrasties mes pag'],
      //'we_present': ['atrodamies', 'atrasties mes tag'],
      //'we_future': ['atradīsimies', 'atrasties mes nak'],
//
      //'you_pl_past': ['atradāties', 'atrasties jus pag'],
      //'you_pl_present': ['atrodaties', 'atrasties jus tag'],
      //'you_pl_future': ['atradīsieties', 'atrasties jus nak'],
    },
    'doties': {//+
      name: 'doties - направляться',

      'es_past': ['devos', 'doties es pag'],
      'es_present': ['dodos', 'doties es tag'],
      //'es_future': ['došos', 'doties es nak'],
//
      //'tu_past': ['devies', 'doties tu pag'],
      //'tu_present': ['dodies', 'doties tu tag'],
      //'tu_future': ['dosies', 'doties tu nak'],
//
      //'3pers_past': ['devās', 'doties 3p pag'],
      //'3pers_present': ['dodas', 'doties 3p tag'],
      //'3pers_future': ['dosies', 'doties 3p nak'],
//
      //'we_past': ['devāmies', 'doties mes pag'],
      //'we_present': ['dodamies', 'doties mes tag'],
      //'we_future': ['dosimies', 'doties mes nak'],
//
      //'you_pl_past': ['devāties', 'doties jus pag'],
      //'you_pl_present': ['dodaties', 'doties jus tag'],
      //'you_pl_future': ['dosieties', 'doties jus nak'],
    },
    'beigties': {//+
      name: 'beigties - (за)кончиться',

      'es_past': ['beidzos', 'beigties es pag'],
      'es_present': ['beidzos', 'beigties es tag'],
      //'es_future': ['beigšos', 'beigties es nak'],
//
      //'tu_past': ['beidzies', 'beigties tu pag'],
      //'tu_present': ['beidzies', 'beigties tu tag'],
      //'tu_future': ['beigsies', 'beigties tu nak'],
//
      //'3pers_past': ['beidzās', 'beigties 3p pag'],
      //'3pers_present': ['beidzas', 'beigties 3p tag'],
      //'3pers_future': ['beigsies', 'beigties 3p nak'],
//
      //'we_past': ['beidzāmies', 'beigties mes pag'],
      //'we_present': ['beidzamies', 'beigties mes tag'],
      //'we_future': ['beigsimies', 'beigties mes nak'],
//
      //'you_pl_past': ['beidzāties', 'beigties jus pag'],
      //'you_pl_present': ['beidzaties', 'beigties jus tag'],
      //'you_pl_future': ['beigsieties', 'beigties jus nak'],
    },
    'sākties': {//+
      name: 'sākties - начаться',

      //'es_past': ['sākos', 'sākties es pag'],
      //'es_present': ['sākos', 'sākties es tag'],
      //'es_future': ['sākšos', 'sākties es nak'],
//
      //'tu_past': ['sākies', 'sākties tu pag'],
      'tu_present': ['sācies', 'sākties tu tag'],
      //'tu_future': ['sāksies', 'sākties tu nak'],
//
      //'3pers_past': ['sākās', 'sākties 3p pag'],
      //'3pers_present': ['sākas', 'sākties 3p tag'],
      //'3pers_future': ['sāksies', 'sākties 3p nak'],
//
      //'we_past': ['sākāmies', 'sākties mes pag'],
      //'we_present': ['sākamies', 'sākties mes tag'],
      //'we_future': ['sākšimies', 'sākties mes nak'],
//
      //'you_pl_past': ['sākāties', 'sākties jus pag'],
      //'you_pl_present': ['sākaties', 'sākties jus tag'],
      //'you_pl_future': ['sāksieties', 'sākties jus nak'],
    },
    'lūgt': {//+
      name: 'lūgt - просить (пригласить)',

      'es_past': ['lūdzu', 'lūgt es pag'],
      'es_present': ['lūdzu', 'lūgt es tag'],
      //'es_future': ['lūgšu', 'lūgt es nak'],
//
      //'tu_past': ['lūdzi', 'lūgt tu pag'],
      //'tu_present': ['lūdz', 'lūgt tu tag'],
      //'tu_future': ['lūgsi', 'lūgt tu nak'],
//
      //'3pers_past': ['lūdza', 'lūgt 3p pag'],
      //'3pers_present': ['lūdz', 'lūgt 3p tag'],
      //'3pers_future': ['lūgs', 'lūgt 3p nak'],
//
      //'we_past': ['lūdzām', 'lūgt mes pag'],
      //'we_present': ['lūdzam', 'lūgt mes tag'],
      //'we_future': ['lūgsim', 'lūgt mes nak'],
//
      //'you_pl_past': ['lūdzāt', 'lūgt jus pag'],
      //'you_pl_present': ['lūdzat', 'lūgt jus tag'],
      //'you_pl_future': ['lūgsiet', 'lūgt jus nak'],
    },
    'dot': {
      name: 'dot - давать',

      'es_past': ['devu', 'dot es pag'],
      'es_present': ['dodu', 'dot es tag'],
      //'es_future': ['došu', 'dot es nak'],
//
      //'tu_past': ['devi', 'dot tu pag'],
      //'tu_present': ['dod', 'dot tu tag'],
      //'tu_future': ['dosi', 'dot tu nak'],
//
      //'3pers_past': ['deva', 'dot 3p pag'],
      //'3pers_present': ['dod', 'dot 3p tag'],
      //'3pers_future': ['dos', 'dot 3p nak'],
//
      //'we_past': ['devām', 'dot mes pag'],
      //'we_present': ['dodam', 'dot mes tag'],
      //'we_future': ['dosim', 'dot mes nak'],
//
      //'you_pl_past': ['devāt', 'dot jus pag'],
      //'you_pl_present': ['dodat', 'dot jus tag'],
      //'you_pl_future': ['dosiet', 'dot jus nak'],
    },
    'likt': {//+
      name: 'likt - класть, ставить',

      //'es_past': ['liku', 'likt es pag'],
      'es_present': ['lieku', 'likt es tag'],
      //'es_future': ['likšu', 'likt es nak'],
//
      //'tu_past': ['liki', 'likt tu pag'],
      'tu_present': ['liec', 'likt tu tag'],
      //'tu_future': ['liksi', 'likt tu nak'],
//
      //'3pers_past': ['lika', 'likt 3p pag'],
      //'3pers_present': ['liek', 'likt 3p tag'],
      //'3pers_future': ['liks', 'likt 3p nak'],
//
      //'we_past': ['likām', 'likt mes pag'],
      //'we_present': ['liekam', 'likt mes tag'],
      //'we_future': ['liksim', 'likt mes nak'],
//
      //'you_pl_past': ['likāt', 'likt jus pag'],
      //'you_pl_present': ['liekat', 'likt jus tag'],
      //'you_pl_future': ['liksiet', 'likt jus nak'],
    },
    'tikt': {//+
      name: 'tikt - попасть, стать',

      //'es_past': ['tiku', 'tikt es pag'],
      'es_present': ['tieku', 'tikt es tag'],
      //'es_future': ['tikšu', 'tikt es nak'],
//
      //'tu_past': ['tiki', 'tikt tu pag'],
      'tu_present': ['tiec', 'tikt tu tag'],
      //'tu_future': ['tiksi', 'tikt tu nak'],
//
      //'3pers_past': ['tika', 'tikt 3p pag'],
      //'3pers_present': ['tiek', 'tikt 3p tag'],
      //'3pers_future': ['tiks', 'tikt 3p nak'],
//
      //'we_past': ['tikām', 'tikt mes pag'],
      //'we_present': ['tiekam', 'tikt mes tag'],
      //'we_future': ['tiksim', 'tikt mes nak'],
//
      //'you_pl_past': ['tikāt', 'tikt jus pag'],
      //'you_pl_present': ['tiekat', 'tikt jus tag'],
      //'you_pl_future': ['tiksiet', 'tikt jus nak'],
    },
    // ✅ saukt по Letonika
    'saukt': {//+
      name: 'saukt - звать, называть',

      'es_past': ['saucu', 'saukt es pag'],
      'es_present': ['saucu', 'saukt es tag'],
      //'es_future': ['saukšu', 'saukt es nak'],
//
      //'tu_past': ['sauci', 'saukt tu pag'],
      //'tu_present': ['sauc', 'saukt tu tag'],
      //'tu_future': ['sauksi', 'saukt tu nak'],
//
      //'3pers_past': ['sauca', 'saukt 3p pag'],
      //'3pers_present': ['sauc', 'saukt 3p tag'],
      //'3pers_future': ['sauks', 'saukt 3p nak'],
//
      //'we_past': ['saucām', 'saukt mes pag'],
      //'we_present': ['saucam', 'saukt mes tag'],
      //'we_future': ['sauksim', 'saukt mes nak'],
//
      //'you_pl_past': ['saucāt', 'saukt jus pag'],
      //'you_pl_present': ['saucat', 'saukt jus tag'],
      //'you_pl_future': ['sauksiet', 'saukt jus nak'],
    },
    // teikt – с чередованием k→c и teikš- в будущем
    'teikt': {//+
      name: 'teikt - говорить, сказать',

      'es_past': ['teicu', 'teikt es pag'],
      'es_present': ['teicu', 'teikt es tag'],
      //'es_future': ['teikšu', 'teikt es nak'],
//
      //'tu_past': ['teici', 'teikt tu pag'],
      //'tu_present': ['teic', 'teikt tu tag'],
      //'tu_future': ['teiksi', 'teikt tu nak'],
//
      //'3pers_past': ['teica', 'teikt 3p pag'],
      //'3pers_present': ['teic', 'teikt 3p tag'],
      //'3pers_future': ['teiks', 'teikt 3p nak'],
//
      //'we_past': ['teicām', 'teikt mes pag'],
      //'we_present': ['teicam', 'teikt mes tag'],
      //'we_future': ['teiksim', 'teikt mes nak'],
//
      //'you_pl_past': ['teicāt', 'teikt jus pag'],
      //'you_pl_present': ['teicat', 'teikt jus tag'],
      //'you_pl_future': ['teiksiet', 'teikt jus nak'],
    },
    'vilkt': {//+
      name: 'vilkt - тянуть, носить',

      //'es_past': ['vilku', 'vilkt es pag'],
      'es_present': ['velku', 'vilkt es tag'],
      //'es_future': ['vilkšu', 'vilkt es nak'],
//
      //'tu_past': ['vilki', 'vilkt tu pag'],
      'tu_present': ['velc', 'vilkt tu tag'],
      //'tu_future': ['vilksi', 'vilkt tu nak'],
//
      //'3pers_past': ['vilka', 'vilkt 3p pag'],
      //'3pers_present': ['velk', 'vilkt 3p tag'],
      //'3pers_future': ['vilks', 'vilkt 3p nak'],
//
      //'we_past': ['vilkām', 'vilkt mes pag'],
      //'we_present': ['velkam', 'vilkt mes tag'],
      //'we_future': ['vilksim', 'vilkt mes nak'],
//
      //'you_pl_past': ['vilkāt', 'vilkt jus pag'],
      //'you_pl_present': ['velkat', 'vilkt jus tag'],
      //'you_pl_future': ['vilksiet', 'vilkt jus nak'],
    },
    "sniegt": {//+
      name: "sniegt - подавать",

      "es_past": ["sniedzu", "sniegt es pag"],
      "es_present": ["sniedzu", "sniegt es tag"],
      //"es_future": ["sniegšu", "sniegt es nak"],

      //"tu_past": ["sniedzi", "sniegt tu pag"],
      //"tu_present": ["sniedz", "sniegt tu tag"],
      //"tu_future": ["sniegsi", "sniegt tu nak"],

      //"3pers_past": ["sniedza", "sniegt 3p pag"],
      //"3pers_present": ["sniedz", "sniegt 3p tag"],
      //"3pers_future": ["sniegs", "sniegt 3p nak"],

      //"we_past": ["sniedzām", "sniegt mes pag"],
      //"we_present": ["sniedzam", "sniegt mes tag"],
      //"we_future": ["sniegsim", "sniegt mes nak"],

      //"you_pl_past": ["sniedzāt", "sniegt jus pag"],
      //"you_pl_present": ["sniedzat", "sniegt jus tag"],
      //"you_pl_future": ["sniegsiet", "sniegt jus nak"]
    },
  };

  return <VerbConjugationBase verbs={verbs} {...props} />;
};

export default VerbConjugationCategory1;

