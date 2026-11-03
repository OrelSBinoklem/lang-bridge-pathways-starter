import { Suspense } from 'react';
import { CoursePath } from '@/features/course/CoursePath';
import { SubscriptionAccess } from '@/features/credits/SubscriptionAccess';

export const metadata = { title: 'Английский язык · путь курса A1–B2' };

export default function EnglishCoursePage() {
  return <SubscriptionAccess><Suspense><CoursePath learnLanguage="en" /></Suspense></SubscriptionAccess>;
}
