'use client';

import { useParams } from 'next/navigation';
import { LessonPageView } from '@/features/lessons/LessonPageView';

export default function LessonRoutePage() {
  const params = useParams<{ slug: string }>();
  return <LessonPageView key={params.slug} slug={params.slug} />;
}
