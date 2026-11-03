'use client';
import { useState } from 'react';
import { PageTour } from './PageTour';
import { createGrammarTourDefinition, GRAMMAR_TOUR_RELEASE } from './grammarTourSteps';
import { GrammarOctopus } from '@/features/tutor-characters/GrammarOctopus';
const copy = {
  ru: { title: 'Тур по таблицам', invite: 'Показать, как пользоваться таблицами и заданиями внутри них?' },
  uk: { title: 'Тур таблицями', invite: 'Показати, як користуватися таблицями та завданнями всередині них?' },
};
export function GrammarTour({ isAuthenticated }: { isAuthenticated: boolean }) {
  const [definition] = useState(createGrammarTourDefinition);
  return <><PageTour isAuthenticated={isAuthenticated} definition={definition} release={GRAMMAR_TOUR_RELEASE}
    eventName="lbp.grammar-tour.start" entryId="grammar" copy={copy} /><GrammarOctopus tourOnly /></>;
}
