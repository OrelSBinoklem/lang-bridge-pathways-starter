import { CulturePreview } from './CulturePreview';

/**
 * Dev page for the "Культура и язык" (1800) effects on a card as wide as the real one; the course itself needs the
 * backend's course data, this page does not. `?variant=embroidery|amber|song-fire&w=1100&h=190`, and
 * `&p=stitchRate:30,words:40` sets panel values before the effect starts.
 */
export default async function CulturePreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const number = (value: string | string[] | undefined, fallback: number) => {
    const parsed = Number(first(value));
    return Number.isFinite(parsed) && parsed >= 200 && parsed <= 2400 ? parsed : fallback;
  };
  const overrides: Record<string, number | string | boolean> = {};
  for (const pair of (first(query.p) ?? '').split(',')) {
    const [key, value] = pair.split(':');
    if (!key || value === undefined) continue;
    overrides[key] = value === 'true' ? true : value === 'false' ? false : Number.isFinite(Number(value)) ? Number(value) : value;
  }
  return <CulturePreview variantId={first(query.variant) ?? 'embroidery'} width={number(query.w, 1100)} height={number(query.h, 190)} overrides={overrides} />;
}
