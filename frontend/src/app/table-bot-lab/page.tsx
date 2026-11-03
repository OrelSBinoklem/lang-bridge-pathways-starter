import type { Metadata } from 'next';
import { TableBotLab } from '@/features/table-bot/TableBotLab';

export const metadata: Metadata = { title: 'Бот-табличник — тест', robots: { index: false, follow: false } };

export default function TableBotLabPage() {
  return <TableBotLab />;
}
