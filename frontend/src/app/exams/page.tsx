import { Suspense } from 'react';
import { ExamPage } from '@/features/exams/ExamPage';

export default function ExamsRoute() {
  return <Suspense fallback={<p>Загрузка экзаменов…</p>}><ExamPage /></Suspense>;
}
