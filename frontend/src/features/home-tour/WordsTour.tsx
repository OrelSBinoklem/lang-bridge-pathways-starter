'use client';

import { PageTour } from './PageTour';
import { WORDS_TOUR_RELEASE, wordsTourDefinition } from './wordsTourSteps';

const copy = {
  ru: { title: 'Тур по странице слов', invite: 'Показать, как учить слова на этой странице?' },
  uk: { title: 'Тур сторінкою слів', invite: 'Показати, як вчити слова на цій сторінці?' },
};
export function WordsTour({ isAuthenticated }: { isAuthenticated: boolean }) {
  return <PageTour isAuthenticated={isAuthenticated} definition={wordsTourDefinition} release={WORDS_TOUR_RELEASE}
    eventName="lbp.words-tour.start" entryId="words" copy={copy} />;
}
