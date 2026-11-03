'use client';

import React from 'react';
import VerbConjugationBase from './VerbConjugationBase';

/**
 * КАТЕГОРИЯ 2: Таблица спряжений глаголов (вторая группа)
 * 
 * Использует базовый компонент VerbConjugationBase
 * Содержит глаголы из строк 344-1072
 */
const VerbConjugationCategory2 = (props) => {
  // Ячейка: ['forma', 'standard'] — standard = translation_1 в БД (напр. 'celt es pag')
  const verbs = {
    //B1
    'celt': {//+
      name: 'celt - поднимать',

      'es_past': ['cēlu', 'celt es pag'],
      'es_present': ['ceļu', 'celt es tag'],
      //'es_future': ['celšu', 'celt es nak'],

      //'tu_past': ['cēli', 'celt tu pag'],
      'tu_present': ['cel', 'celt tu tag'],
      //'tu_future': ['celsi', 'celt tu nak'],

      //'3pers_past': ['cēla', 'celt 3p pag'],
      //'3pers_present': ['ceļ', 'celt 3p tag'],
      //'3pers_future': ['cels', 'celt 3p nak'],

      //'we_past': ['cēlām', 'celt mes pag'],
      //'we_present': ['ceļam', 'celt mes tag'],
      //'we_future': ['celsim', 'celt mes nak'],

      //'you_pl_past': ['cēlāt', 'celt jus pag'],
      //'you_pl_present': ['ceļat', 'celt jus tag'],
      //'you_pl_future': ['celsiet', 'celt jus nak'],
    },
    'gūt': {//+
      name: 'gūt - получать, обрести',

      'es_past': ['guvu', 'gūt es pag'],
      'es_present': ['gūstu', 'gūt es tag'],
      'es_future': ['gūšu', 'gūt es nak'],

      //'tu_past': ['guvi', 'gūt tu pag'],
      //'tu_present': ['gūsti', 'gūt tu tag'],
      //'tu_future': ['gūsi', 'gūt tu nak'],

      //'3pers_past': ['guva', 'gūt 3p pag'],
      //'3pers_present': ['gūst', 'gūt 3p tag'],
      //'3pers_future': ['gūs', 'gūt 3p nak'],

      //'we_past': ['guvām', 'gūt mes pag'],
      //'we_present': ['gūstam', 'gūt mes tag'],
      //'we_future': ['gūsim', 'gūt mes nak'],

      //'you_pl_past': ['guvāt', 'gūt jus pag'],
      //'you_pl_present': ['gūstat', 'gūt jus tag'],
      //'you_pl_future': ['gūsiet', 'gūt jus nak'],
    },
    'kļūt': {//+
      name: 'kļūt - становиться',

      'es_past': ['kļuvu', 'kļūt es pag'],
      'es_present': ['kļūstu', 'kļūt es tag'],
      //'es_future': ['kļūšu', 'kļūt es nak'],

      //'tu_past': ['kļuvi', 'kļūt tu pag'],
      //'tu_present': ['kļūsti', 'kļūt tu tag'],
      //'tu_future': ['kļūsi', 'kļūt tu nak'],

      //'3pers_past': ['kļuva', 'kļūt 3p pag'],
      //'3pers_present': ['kļūst', 'kļūt 3p tag'],
      //'3pers_future': ['kļūs', 'kļūt 3p nak'],

      //'we_past': ['kļuvām', 'kļūt mes pag'],
      //'we_present': ['kļūstam', 'kļūt mes tag'],
      //'we_future': ['kļūsim', 'kļūt mes nak'],

      //'you_pl_past': ['kļuvāt', 'kļūt jus pag'],
      //'you_pl_present': ['kļūstat', 'kļūt jus tag'],
      //'you_pl_future': ['kļūsiet', 'kļūt jus nak'],
    },
    'just': {//+
      name: 'just - чувствовать',

      'es_past': ['jutu', 'just es pag'],
      'es_present': ['jūtu', 'just es tag'],
      'es_future': ['jutīšu', 'just es nak'],

      //'tu_past': ['juti', 'just tu pag'],
      //'tu_present': ['jūti', 'just tu tag'],
      //'tu_future': ['jutīsi', 'just tu nak'],

      //'3pers_past': ['juta', 'just 3p pag'],
      //'3pers_present': ['jūt', 'just 3p tag'],
      //'3pers_future': ['jutīs', 'just 3p nak'],

      //'we_past': ['jutām', 'just mes pag'],
      //'we_present': ['jūtam', 'just mes tag'],
      //'we_future': ['jutīsim', 'just mes nak'],

      //'you_pl_past': ['jutāt', 'just jus pag'],
      //'you_pl_present': ['jūtat', 'just jus tag'],
      //'you_pl_future': ['jutīsiet', 'just jus nak'],
    },

    "vest": {//+
      name: "vest - везти",

      "es_past": ["vedu", "vest es pag"],
      "es_present": ["vedu", "vest es tag"],
      "es_future": ["vedīšu", "vest es nak"],

      //"tu_past": ["vedi", "vest tu pag"],
      //"tu_present": ["ved", "vest tu tag"],
      //"tu_future": ["vedīsi", "vest tu nak"],

      //"3pers_past": ["veda", "vest 3p pag"],
      //"3pers_present": ["ved", "vest 3p tag"],
      //"3pers_future": ["vedīs", "vest 3p nak"],

      //"we_past": ["vedām", "vest mes pag"],
      //"we_present": ["vedam", "vest mes tag"],
      //"we_future": ["vedīsim", "vest mes nak"],

      //"you_pl_past": ["vedāt", "vest jus pag"],
      //"you_pl_present": ["vedat", "vest jus tag"],
      //"you_pl_future": ["vedīsiet", "vest jus nak"]
    },

    "mest": {//+
      name: "mest - бросать",

      "es_past": ["metu", "mest es pag"],
      "es_present": ["metu", "mest es tag"],
      "es_future": ["metīšu", "mest es nak"],

      //"tu_past": ["meti", "mest tu pag"],
      //"tu_present": ["met", "mest tu tag"],
      //"tu_future": ["metīsi", "mest tu nak"],

      //"3pers_past": ["meta", "mest 3p pag"],
      //"3pers_present": ["met", "mest 3p tag"],
      //"3pers_future": ["metīs", "mest 3p nak"],

      //"we_past": ["metām", "mest mes pag"],
      //"we_present": ["metam", "mest mes tag"],
      //"we_future": ["metīsim", "mest mes nak"],

      //"you_pl_past": ["metāt", "mest jus pag"],
      //"you_pl_present": ["metat", "mest jus tag"],
      //"you_pl_future": ["metīsiet", "mest jus nak"]
    },

    "zust": {
      name: "zust - исчезать",

      "es_past": ["zudu", "zust es pag"],
      "es_present": ["zūdu", "zust es tag"],
      "es_future": ["zudīšu", "zust es nak"],

      //"tu_past": ["zudi", "zust tu pag"],
      //"tu_present": ["zūdi", "zust tu tag"],
      //"tu_future": ["zudīsi", "zust tu nak"],

      //"3pers_past": ["zuda", "zust 3p pag"],
      //"3pers_present": ["zūd", "zust 3p tag"],
      //"3pers_future": ["zudīs", "zust 3p nak"],

      //"we_past": ["zudām", "zust mes pag"],
      //"we_present": ["zūdam", "zust mes tag"],
      //"we_future": ["zudīsim", "zust mes nak"],

      //"you_pl_past": ["zudāt", "zust jus pag"],
      //"you_pl_present": ["zūdat", "zust jus tag"],
      //"you_pl_future": ["zudīsiet", "zust jus nak"]
    },

    "rasties": {//B2
      "name": "rasties - возникать",

      "es_past": ["rados", "rasties es pag"],
      "es_present": ["rodos", "rasties es tag"],
      "es_future": ["radīšos", "rasties es nak"],

      //"tu_past": ["radies", "rasties tu pag"],
      //"tu_present": ["rodies", "rasties tu tag"],
      //"tu_future": ["radīsies", "rasties tu nak"],

      //"3pers_past": ["radās", "rasties 3p pag"],
      //"3pers_present": ["rodas", "rasties 3p tag"],
      //"3pers_future": ["radīsies", "rasties 3p nak"],

      //"we_past": ["radāmies", "rasties mes pag"],
      "we_present": ["radāmies", "rasties mes tag"],
      //"we_future": ["radīsimies", "rasties mes nak"],

      //"you_pl_past": ["radāties", "rasties jus pag"],
      "you_pl_present": ["radāties", "rasties jus tag"],
      //"you_pl_future": ["radīsieties", "rasties jus nak"]
    },

    'krist': {//+//B2
      name: 'krist - падать',

      'es_past': ['kritu', 'krist es pag'],
      'es_present': ['krītu', 'krist es tag'],
      'es_future': ['kritīšu', 'krist es nak'],

      //'tu_past': ['kriti', 'krist tu pag'],
      //'tu_present': ['krīti', 'krist tu tag'],
      //'tu_future': ['kritīsi', 'krist tu nak'],

      //'3pers_past': ['krita', 'krist 3p pag'],
      //'3pers_present': ['krīt', 'krist 3p tag'],
      //'3pers_future': ['kritīs', 'krist 3p nak'],

      //'we_past': ['kritām', 'krist mes pag'],
      //'we_present': ['krītam', 'krist mes tag'],
      //'we_future': ['kritīsim', 'krist mes nak'],

      //'you_pl_past': ['kritāt', 'krist jus pag'],
      //'you_pl_present': ['krītat', 'krist jus tag'],
      //'you_pl_future': ['kritīsiet', 'krist jus nak'],
    },

    // ✅ laist по Letonika
    'laist': {//+//B2
      name: 'laist - пускать, отпускать',

      'es_past': ['laidu', 'laist es pag'],
      'es_present': ['laižu', 'laist es tag'],
      'es_future': ['laidīšu', 'laist es nak'],

      //'tu_past': ['laidi', 'laist tu pag'],
      'tu_present': ['laid', 'laist tu tag'],
      //'tu_future': ['laidīsi', 'laist tu nak'],

      //'3pers_past': ['laida', 'laist 3p pag'],
      //'3pers_present': ['laiž', 'laist 3p tag'],
      //'3pers_future': ['laidīs', 'laist 3p nak'],

      //'we_past': ['laidām', 'laist mes pag'],
      //'we_present': ['laižam', 'laist mes tag'],
      //'we_future': ['laidīsim', 'laist mes nak'],

      //'you_pl_past': ['laidāt', 'laist jus pag'],
      //'you_pl_present': ['laižat', 'laist jus tag'],
      //'you_pl_future': ['laidīsiet', 'laist jus nak'],
    },

    "kost": {//B2
      name: "kost - кусать",

      "es_past": ["kodu", "kost es pag"],
      "es_present": ["kožu", "kost es tag"],
      "es_future": ["kodīšu", "kost es nak"],

      //"tu_past": ["kodi", "kost tu pag"],
      "tu_present": ["kod", "kost tu tag"],
      //"tu_future": ["kodīsi", "kost tu nak"],

      //"3pers_past": ["koda", "kost 3p pag"],
      //"3pers_present": ["kož", "kost 3p tag"],
      //"3pers_future": ["kodīs", "kost 3p nak"],

      //"we_past": ["kodām", "kost mes pag"],
      //"we_present": ["kožam", "kost mes tag"],
      //"we_future": ["kodīsim", "kost mes nak"],

      //"you_pl_past": ["kodāt", "kost jus pag"],
      //"you_pl_present": ["kožat", "kost jus tag"],
      //"you_pl_future": ["kodīsiet", "kost jus nak"]
    },

    "plest": {//B2
      name: "plest - раскрывать, рвать",

      "es_past": ["pletu", "plest es pag"],
      "es_present": ["plešu", "plest es tag"],
      "es_future": ["pletīšu", "plest es nak"],

      //"tu_past": ["pleti", "plest tu pag"],
      "tu_present": ["plet", "plest tu tag"],
      //"tu_future": ["pletīsi", "plest tu nak"],

      //"3pers_past": ["pleta", "plest 3p pag"],
      //"3pers_present": ["pleš", "plest 3p tag"],
      //"3pers_future": ["pletīs", "plest 3p nak"],

      //"we_past": ["pletām", "plest mes pag"],
      //"we_present": ["plešam", "plest mes tag"],
      //"we_future": ["pletīsim", "plest mes nak"],

      //"you_pl_past": ["pletāt", "plest jus pag"],
      //"you_pl_present": ["plešat", "plest jus tag"],
      //"you_pl_future": ["pletīsiet", "plest jus nak"]
    },

    "spiest": {//B2
      name: "spiest - нажимать",

      "es_past": ["spiedu", "spiest es pag"],
      "es_present": ["spiežu", "spiest es tag"],
      "es_future": ["spiedīšu", "spiest es nak"],

      //"tu_past": ["spiedi", "spiest tu pag"],
      "tu_present": ["spiedz", "spiest tu tag"],
      //"tu_future": ["spiedīsi", "spiest tu nak"],

      //"3pers_past": ["spieda", "spiest 3p pag"],
      //"3pers_present": ["spiež", "spiest 3p tag"],
      //"3pers_future": ["spiedīs", "spiest 3p nak"],

      //"we_past": ["spiedām", "spiest mes pag"],
      //"we_present": ["spiežam", "spiest mes tag"],
      //"we_future": ["spiedīsim", "spiest mes nak"],

      //"you_pl_past": ["spiedāt", "spiest jus pag"],
      //"you_pl_present": ["spiežat", "spiest jus tag"],
      //"you_pl_future": ["spiedīsiet", "spiest jus nak"]
    },

    //B2

    'zagt': {//+
      name: 'zagt - воровать',

      //'es_past': ['zagu', 'zagt es pag'],
      'es_present': ['zogu', 'zagt es tag'],
      //'es_future': ['zagšu', 'zagt es nak'],

      //'tu_past': ['zagi', 'zagt tu pag'],
      'tu_present': ['zodz', 'zagt tu tag'],
      //'tu_future': ['zagsi', 'zagt tu nak'],

      //'3pers_past': ['zaga', 'zagt 3p pag'],
      //'3pers_present': ['zog', 'zagt 3p tag'],
      //'3pers_future': ['zags', 'zagt 3p nak'],

      //'we_past': ['zagām', 'zagt mes pag'],
      //'we_present': ['zogam', 'zagt mes tag'],
      //'we_future': ['zagsim', 'zagt mes nak'],

      //'you_pl_past': ['zagāt', 'zagt jus pag'],
      //'you_pl_present': ['zogat', 'zagt jus tag'],
      //'you_pl_future': ['zagsiet', 'zagt jus nak'],
    },


    





    

    // ✅ kliegt по Letonika
    'kliegt': {//+
      name: 'kliegt - кричать',

      'es_past': ['kliedzu', 'kliegt es pag'],
      'es_present': ['kliedzu', 'kliegt es tag'],
      //'es_future': ['kliegšu', 'kliegt es nak'],

      //'tu_past': ['kliedzi', 'kliegt tu pag'],
      //'tu_present': ['kliedz', 'kliegt tu tag'],
      //'tu_future': ['kliegsi', 'kliegt tu nak'],

      //'3pers_past': ['kliedza', 'kliegt 3p pag'],
      //'3pers_present': ['kliedz', 'kliegt 3p tag'],
      //'3pers_future': ['kliegs', 'kliegt 3p nak'],

      //'we_past': ['kliedzām', 'kliegt mes pag'],
      //'we_present': ['kliedzam', 'kliegt mes tag'],
      //'we_future': ['kliegsim', 'kliegt mes nak'],

      //'you_pl_past': ['kliedzāt', 'kliegt jus pag'],
      //'you_pl_present': ['kliedzat', 'kliegt jus tag'],
      //'you_pl_future': ['kliegsiet', 'kliegt jus nak'],
    },




    'sēdēt': {//++
      name: 'sēdēt - сидеть',

      //'es_past': ['sēdēju', 'sēdēt es pag'],
      'es_present': ['sēžu', 'sēdēt es tag'],
      //'es_future': ['sēdēšu', 'sēdēt es nak'],

      //'tu_past': ['sēdēji', 'sēdēt tu pag'],
      'tu_present': ['sēdi', 'sēdēt tu tag'],
      //'tu_future': ['sēdēsi', 'sēdēt tu nak'],

      //'3pers_past': ['sēdēja', 'sēdēt 3p pag'],
      //'3pers_present': ['sēž', 'sēdēt 3p tag'],
      //'3pers_future': ['sēdēs', 'sēdēt 3p nak'],

      //'we_past': ['sēdējām', 'sēdēt mes pag'],
      //'we_present': ['sēžam', 'sēdēt mes tag'],
      //'we_future': ['sēdēsim', 'sēdēt mes nak'],

      //'you_pl_past': ['sēdējāt', 'sēdēt jus pag'],
      //'you_pl_present': ['sēžat', 'sēdēt jus tag'],
      //'you_pl_future': ['sēdēsiet', 'sēdēt jus nak'],
    },



    'dzīt': {//+
      name: 'dzīt - гнать',

      'es_past': ['dzinu', 'dzīt es pag'],
      'es_present': ['dzenu', 'dzīt es tag'],
      //'es_future': ['dzīšu', 'dzīt es nak'],

      //'tu_past': ['dzini', 'dzīt tu pag'],
      //'tu_present': ['dzen', 'dzīt tu tag'],
      //'tu_future': ['dzīsi', 'dzīt tu nak'],

      //'3pers_past': ['dzina', 'dzīt 3p pag'],
      //'3pers_present': ['dzen', 'dzīt 3p tag'],
      //'3pers_future': ['dzīs', 'dzīt 3p nak'],

      //'we_past': ['dzinām', 'dzīt mes pag'],
      //'we_present': ['dzenam', 'dzīt mes tag'],
      //'we_future': ['dzīsim', 'dzīt mes nak'],

      //'you_pl_past': ['dzināt', 'dzīt jus pag'],
      //'you_pl_present': ['dzenat', 'dzīt jus tag'],
      //'you_pl_future': ['dzīsiet', 'dzīt jus nak'],
    },





    

    "raut": {//+
      name: "raut - рвать, дёргать",

      "es_past": ["rāvu", "raut es pag"],
      "es_present": ["rauju", "raut es tag"],
      //"es_future": ["raušu", "raut es nak"],

      //"tu_past": ["rāvi", "raut tu pag"],
      //"tu_present": ["rauj", "raut tu tag"],
      //"tu_future": ["rausi", "raut tu nak"],

      //"3pers_past": ["rāva", "raut 3p pag"],
      //"3pers_present": ["rauj", "raut 3p tag"],
      //"3pers_future": ["raus", "raut 3p nak"],

      //"we_past": ["rāvām", "raut mes pag"],
      //"we_present": ["raujam", "raut mes tag"],
      //"we_future": ["rausim", "raut mes nak"],

      //"you_pl_past": ["rāvāt", "raut jus pag"],
      //"you_pl_present": ["raujat", "raut jus tag"],
      //"you_pl_future": ["rausiet", "raut jus nak"]
    },







    

    "liegt": {
      name: "liegt - запрещать",

      "es_past": ["liedzu", "liegt es pag"],
      "es_present": ["liedzu", "liegt es tag"],
      //"es_future": ["liegšu", "liegt es nak"],

      //"tu_past": ["liedzi", "liegt tu pag"],
      //"tu_present": ["liedz", "liegt tu tag"],
      //"tu_future": ["liegsi", "liegt tu nak"],

      //"3pers_past": ["liedza", "liegt 3p pag"],
      //"3pers_present": ["liedz", "liegt 3p tag"],
      //"3pers_future": ["liegs", "liegt 3p nak"],

      //"we_past": ["liedzām", "liegt mes pag"],
      //"we_present": ["liedzam", "liegt mes tag"],
      //"we_future": ["liegsim", "liegt mes nak"],

      //"you_pl_past": ["liedzāt", "liegt jus pag"],
      //"you_pl_present": ["liedzat", "liegt jus tag"],
      //"you_pl_future": ["liegsiet", "liegt jus nak"]
    },


    "snigt": {
      "name": "snigt - идти (о снеге)",

      //"3pers_past": ["sniga", "snigt 3p pag"],
      "3pers_present": ["snieg", "snigt 3p tag"],
      //"3pers_future": ["snigs", "snigt 3p nak"],
    },

  };

  return <VerbConjugationBase verbs={verbs} {...props} />;
};

export default VerbConjugationCategory2;

