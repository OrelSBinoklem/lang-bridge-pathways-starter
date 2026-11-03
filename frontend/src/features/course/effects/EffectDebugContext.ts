'use client';

import { createContext } from 'react';

/** null outside the course; false for visitors without administrator access. */
export const EffectDebugContext = createContext<boolean | null>(null);
