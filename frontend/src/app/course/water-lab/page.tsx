import { WaterLab } from '@/features/course/effects/water-lab/WaterLab';

export const metadata = { title: 'Вода · лаборатория', robots: { index: false, follow: false } };

// Only procedural graphics and existing public artwork; no private course data.
export default function WaterLabPage() { return <WaterLab />; }
