import type { Metadata } from 'next';
import { AvatarLab } from '@/features/tutor-avatar/AvatarLab';

export const metadata: Metadata = { title: 'Аватар репетитора — тест', robots: { index: false, follow: false } };

export default function AvatarLabPage() {
  return <AvatarLab />;
}
