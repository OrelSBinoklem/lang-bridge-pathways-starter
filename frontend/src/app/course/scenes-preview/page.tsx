import { ScenesPreview } from './ScenesPreview';

/**
 * Dev gallery of the scene library used by the course groups (effects/scenes). `/course/scenes-preview` shows every
 * scene in a small card; `?scene=aurora&palette=1&w=1100&h=190` shows one at any size; `?body=1` puts it behind the
 * page; `?p=style:1,preset:3` sets panel values (SceneParams fields) before the scene starts.
 */
export default async function ScenesPreviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const number = (value: string | string[] | undefined, fallback: number, lo: number, hi: number) => {
    const parsed = Number(first(value));
    return Number.isFinite(parsed) && parsed >= lo && parsed <= hi ? parsed : fallback;
  };
  const overrides: Record<string, number | string> = {};
  for (const pair of (first(query.p) ?? '').split(',')) {
    const [key, value] = pair.split(':');
    if (!key || value === undefined) continue;
    overrides[key] = Number.isFinite(Number(value)) ? Number(value) : value;
  }
  return (
    <ScenesPreview
      only={first(query.scene) ?? null}
      palette={number(query.palette, 0, 0, 9)}
      width={number(query.w, 0, 200, 2400)}
      height={number(query.h, 0, 100, 1200)}
      body={first(query.body) === '1'}
      controls={first(query.controls) === '1'}
      from={number(query.from, 0, 0, 99)}
      count={number(query.count, 99, 1, 99)}
      overrides={overrides}
    />
  );
}
