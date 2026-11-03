import type { Metadata } from 'next';
import { CatLab } from '@/features/cat-mascot/CatLab';

export const metadata: Metadata = { title: 'Латышский кот — тест', robots: { index: false, follow: false } };

export default function CatLabPage() {
  return <CatLab />;
}
