import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { GrammarTablesGallery } from '@/features/grammar/GrammarTablesGallery';
import { GALLERY_COOKIE_KEYS, type GalleryInitialSettings } from '@/features/grammar/helpers';

export const metadata: Metadata = { title: 'Grammar' };

export default async function GrammarPage() {
  // The gallery's layout settings live in cookies as well as localStorage, so the first markup is
  // already built with the visitor's own column count, level and view instead of the defaults.
  const cookieStore = await cookies();
  const initialSettings: GalleryInitialSettings = {};
  for (const key of GALLERY_COOKIE_KEYS) {
    const value = cookieStore.get(key)?.value;
    if (value) initialSettings[key] = decodeURIComponent(value);
  }
  return <GrammarTablesGallery initialSettings={initialSettings} />;
}
