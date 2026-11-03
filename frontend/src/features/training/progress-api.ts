import { clientApi } from '@/lib/client-api';
import type { ProgressRow } from './helpers';

export function normalizeProgressDates<T extends object>(payload: { data: T[]; timezone?: string }): { data: T[] } {
  // Without metadata the server already returned ISO dates (backward compatibility).
  if (!payload.timezone) return payload;
  if (payload.timezone !== 'UTC') throw new Error(`Unsupported progress timezone: ${payload.timezone}`);

  return {
    data: payload.data.map((row) => {
      const normalized = { ...row } as T & Record<string, unknown>;
      for (const field of ['last_shown', 'last_shown_revert', 'created_at', 'updated_at']) {
        const value = normalized[field];
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(\.\d+)?$/.test(value)) {
          (normalized as Record<string, unknown>)[field] = value.replace(' ', 'T') + 'Z';
        }
      }
      return normalized;
    }),
  };
}

export async function fetchProgress(dictionaryId: number): Promise<{ data: ProgressRow[] }> {
  const response = await clientApi<{ data: ProgressRow[]; timezone?: string }>(
    `/me/progress?dictionary_id=${dictionaryId}&date_format=raw`,
  );
  return normalizeProgressDates(response);
}
