import { Suspense } from 'react';
import { CoursePath } from '@/features/course/CoursePath';
import { SubscriptionAccess } from '@/features/credits/SubscriptionAccess';

export default function CoursePage() {
  return (
    <SubscriptionAccess><Suspense>
      <CoursePath />
    </Suspense></SubscriptionAccess>
  );
}
