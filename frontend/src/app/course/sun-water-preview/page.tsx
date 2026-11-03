import { SunWaterPreview } from './SunWaterPreview';

/**
 * Dev page for the "Окружающая среда и погода" sun-and-water effect on a card as wide as the real one.
 * The course itself needs the backend's course data, this page does not. `?w=1100&h=190` sets the card size.
 */
export default async function SunWaterPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const number = (value: string | string[] | undefined, fallback: number) => {
    const parsed = Number(Array.isArray(value) ? value[0] : value);
    return Number.isFinite(parsed) && parsed >= 200 && parsed <= 2400 ? parsed : fallback;
  };
  // `?p=ripple:1.2,cursorTool:vessel` sets panel values before the effect starts.
  const overrides: Record<string, number | string> = {};
  const raw = Array.isArray(query.p) ? query.p[0] : query.p;
  for (const pair of (raw ?? '').split(',')) {
    const [key, value] = pair.split(':');
    if (!key || value === undefined) continue;
    overrides[key] = Number.isFinite(Number(value)) ? Number(value) : value;
  }
  return <SunWaterPreview width={number(query.w, 1100)} height={number(query.h, 190)} overrides={overrides} />;
}
