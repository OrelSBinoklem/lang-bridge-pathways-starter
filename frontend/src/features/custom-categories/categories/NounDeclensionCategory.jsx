'use client';

import React from 'react';
import NounDeclensionBase from './NounDeclensionBase';

/**
 * Склонения: 6 tipi — tēvs, brālis, lietus, māsa, zeme, sirds
 * customComponents.js → 20:1984
 */
const NounDeclensionCategory = (props) => {
  // ['forma', 'standard'] — standard = translation_1 (piem. 'tēvs viens kas')
  const nouns = {
    'tēvs': {
      name: 'tēvs — отец (V/M, @=a)',

      'sing_kas': ['tēvs', 'tēvs viens kas'],
      'sing_ka': ['tēva', 'tēvs viens ka'],
      'sing_kam': ['tēvam', 'tēvs viens kam'],
      'sing_ko': ['tēvu', 'tēvs viens ko'],
      'sing_kur': ['tēvā', 'tēvs viens kur'],
      'plur_kas': ['tēvi', 'tēvs daudz kas'],
      'plur_ka': ['tēvu', 'tēvs daudz ka'],
      'plur_kam': ['tēviem', 'tēvs daudz kam'],
      'plur_ko': ['tēvus', 'tēvs daudz ko'],
      'plur_kur': ['tēvos', 'tēvs daudz kur'],
    },
    'brālis': {
      name: 'brālis — брат (V/M, @=i)',

      'sing_kas': ['brālis', 'brālis viens kas'],
      'sing_ka': ['brāļa', 'brālis viens ka'],
      'sing_kam': ['brālim', 'brālis viens kam'],
      'sing_ko': ['brāli', 'brālis viens ko'],
      'sing_kur': ['brālī', 'brālis viens kur'],
      'plur_kas': ['brāļi', 'brālis daudz kas'],
      'plur_ka': ['brāļu', 'brālis daudz ka'],
      'plur_kam': ['brāļiem', 'brālis daudz kam'],
      'plur_ko': ['brāļus', 'brālis daudz ko'],
      'plur_kur': ['brāļos', 'brālis daudz kur'],
    },
    'lietus': {
      name: 'lietus — дождь (V/M, @=u)',

      'sing_kas': ['lietus', 'lietus viens kas'],
      'sing_ka': ['lietus', 'lietus viens ka'],
      'sing_kam': ['lietum', 'lietus viens kam'],
      'sing_ko': ['lietu', 'lietus viens ko'],
      'sing_kur': ['lietū', 'lietus viens kur'],
      'plur_kas': ['lieti', 'lietus daudz kas'],
      'plur_ka': ['lietus', 'lietus daudz ka'],
      'plur_kam': ['lietus', 'lietus daudz kam'],
      'plur_ko': ['lietus', 'lietus daudz ko'],
      'plur_kur': ['lietos', 'lietus daudz kur'],
    },
    'māsa': {
      name: 'māsa — сестра (S/Ž, @=a)',

      'sing_kas': ['māsa', 'māsa viens kas'],
      'sing_ka': ['māsas', 'māsa viens ka'],
      'sing_kam': ['māsai', 'māsa viens kam'],
      'sing_ko': ['māsu', 'māsa viens ko'],
      'sing_kur': ['māsā', 'māsa viens kur'],
      'plur_kas': ['māsas', 'māsa daudz kas'],
      'plur_ka': ['māsu', 'māsa daudz ka'],
      'plur_kam': ['māsām', 'māsa daudz kam'],
      'plur_ko': ['māsas', 'māsa daudz ko'],
      'plur_kur': ['māsās', 'māsa daudz kur'],
    },
    'zeme': {
      name: 'zeme — земля (S/Ž, @=e)',

      'sing_kas': ['zeme', 'zeme viens kas'],
      'sing_ka': ['zemes', 'zeme viens ka'],
      'sing_kam': ['zemei', 'zeme viens kam'],
      'sing_ko': ['zemi', 'zeme viens ko'],
      'sing_kur': ['zemē', 'zeme viens kur'],
      'plur_kas': ['zemes', 'zeme daudz kas'],
      'plur_ka': ['zemju', 'zeme daudz ka'],
      'plur_kam': ['zemēm', 'zeme daudz kam'],
      'plur_ko': ['zemes', 'zeme daudz ko'],
      'plur_kur': ['zemēs', 'zeme daudz kur'],
    },
    'sirds': {
      name: 'sirds — сердце (S/Ž, 6. deklinācija)',

      'sing_kas': ['sirds', 'sirds viens kas'],
      'sing_ka': ['sirds', 'sirds viens ka'],
      'sing_kam': ['sirdij', 'sirds viens kam'],
      'sing_ko': ['sirdi', 'sirds viens ko'],
      'sing_kur': ['sirdī', 'sirds viens kur'],
      'plur_kas': ['sirdis', 'sirds daudz kas'],
      'plur_ka': ['siržu', 'sirds daudz ka'],
      'plur_kam': ['sirdīm', 'sirds daudz kam'],
      'plur_ko': ['sirdis', 'sirds daudz ko'],
      'plur_kur': ['sirdīs', 'sirds daudz kur'],
    },
  };

  const nounGroups = [
    {
      title: 'Vīriešu dzimte',
      lemmas: ['tēvs', 'brālis', 'lietus'],
    },
    {
      title: 'Sieviešu dzimte',
      lemmas: ['māsa', 'zeme', 'sirds'],
    },
  ];

  return <NounDeclensionBase nouns={nouns} nounGroups={nounGroups} {...props} />;
};

export default NounDeclensionCategory;