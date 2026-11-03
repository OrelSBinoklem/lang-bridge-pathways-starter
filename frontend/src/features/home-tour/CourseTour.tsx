'use client';

import { useState } from 'react';
import { PageTour } from './PageTour';
import { COURSE_TOUR_RELEASE, createCourseTourDefinition } from './courseTourSteps';

const copy = {
  ru: { title: 'Тур по курсу', invite: 'Показать, как устроен путь курса и как выбирать следующие задания?' },
  uk: { title: 'Тур курсом', invite: 'Показати, як влаштовано шлях курсу та як обирати наступні завдання?' },
};

export function CourseTour({ isAuthenticated, learnLanguage }: { isAuthenticated: boolean; learnLanguage: 'lv' | 'en' }) {
  const [definition] = useState(() => createCourseTourDefinition(learnLanguage));
  return <PageTour isAuthenticated={isAuthenticated} definition={definition} release={COURSE_TOUR_RELEASE}
    eventName="lbp.course-tour.start" entryId="course" copy={copy} />;
}
