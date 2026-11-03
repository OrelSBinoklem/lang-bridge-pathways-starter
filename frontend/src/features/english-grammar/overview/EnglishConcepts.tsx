'use client';

import ReferenceReader from '@/features/home/reference/ReferenceReader';
import { englishConceptSections } from './concepts';
import type { ReferenceLocale } from '@/features/home/reference/types';

export default function EnglishConcepts({ locale }: { locale: ReferenceLocale }) {
  return <ReferenceReader kind="concepts" locale={locale} language="en" sections={englishConceptSections} />;
}
