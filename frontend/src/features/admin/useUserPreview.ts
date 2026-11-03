'use client';

import { useSyncExternalStore } from 'react';
import { getUserPreview, subscribeUserPreview } from './user-preview-store';

export function useUserPreview() {
  return useSyncExternalStore(subscribeUserPreview, getUserPreview, () => false);
}

export function useAdminAppearance(isAdmin: boolean | undefined) {
  const preview = useUserPreview();
  return Boolean(isAdmin) && !preview;
}
