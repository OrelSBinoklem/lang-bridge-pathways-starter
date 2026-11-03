import './components/grammar-component-tables.css';
import { SubscriptionAccess } from '@/features/credits/SubscriptionAccess';

export default function GrammarLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <SubscriptionAccess>{children}</SubscriptionAccess>;
}
