'use client';

import { useMemo, type ComponentType } from 'react';
import { getGrammarCustomComponent } from '@/features/course/grammarCustomComponents';
import '@/features/custom-categories/custom-categories.css';

export type CustomCategoryBlockConfig = { component_key: string };

export function CustomCategoryBlock({ config }: { config: CustomCategoryBlockConfig }) {
  const Component = useMemo(
    () => getGrammarCustomComponent(config.component_key) as ComponentType<Record<string, unknown>> | null,
    [config.component_key],
  );
  if (!Component) return <p>Компонент «{config.component_key}» не найден.</p>;
  return <Component />;
}
