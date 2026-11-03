'use client';

import { html } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';
import CodeMirror from '@uiw/react-codemirror';
import { useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useEffect, useMemo, useState } from 'react';

/** ~13px font + line padding в CM ≈ 20px на строку */
const LINE_PX = 20;
const MIN_LINES = 8;
const MAX_LINES = 60;

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function HtmlCodeEditor({ value, onChange, placeholder }: Props) {
  const t = useTranslations('Admin');
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [heightPx, setHeightPx] = useState(MIN_LINES * LINE_PX);

  useEffect(() => setMounted(true), []);

  const extensions = useMemo(
    () => [html({ matchClosingTags: true, autoCloseTags: true })],
    [],
  );

  const dark = mounted && resolvedTheme === 'dark';
  const minH = MIN_LINES * LINE_PX;
  const maxH = MAX_LINES * LINE_PX;

  return (
    <div
      className="overflow-hidden rounded-lg border border-zinc-300 bg-white dark:border-zinc-600 dark:bg-zinc-950"
      style={{
        height: heightPx,
        minHeight: minH,
        maxHeight: maxH,
        resize: 'vertical',
      }}
      onMouseUp={(e) => {
        const next = Math.round((e.currentTarget as HTMLDivElement).offsetHeight);
        const clamped = Math.min(maxH, Math.max(minH, next));
        if (clamped !== heightPx) setHeightPx(clamped);
      }}
    >
      <CodeMirror
        value={value}
        height="100%"
        theme={dark ? oneDark : 'light'}
        extensions={extensions}
        onChange={onChange}
        placeholder={placeholder ?? t('hintHtmlPlaceholder')}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          bracketMatching: true,
          autocompletion: true,
        }}
        style={{ fontSize: '13px', height: '100%' }}
        className="h-full text-left [&_.cm-editor]:h-full [&_.cm-editor]:outline-none [&_.cm-scroller]:font-mono [&_.cm-scroller]:overflow-auto"
      />
    </div>
  );
}
