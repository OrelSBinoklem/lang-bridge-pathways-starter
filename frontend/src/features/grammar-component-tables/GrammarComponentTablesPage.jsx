'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { tableComponents } from './components/tables';

const STORAGE_KEY = 'grammar-component-tables-font-size';

function FontSizeController() {
  const initialRootFontSize = useRef(null);
  const [multiplier, setMultiplier] = useState(() => {
    if (typeof window === 'undefined') return 1;
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? parseFloat(saved) || 1 : 1;
  });

  useEffect(() => {
    initialRootFontSize.current = document.documentElement.style.fontSize;

    return () => {
      document.documentElement.style.fontSize = initialRootFontSize.current ?? '';
      document.documentElement.style.removeProperty('--base-font-size');
    };
  }, []);

  useEffect(() => {
    const nextFontSize = `${16 * multiplier}px`;
    document.documentElement.style.fontSize = nextFontSize;
    document.documentElement.style.setProperty('--base-font-size', nextFontSize);
    window.localStorage.setItem(STORAGE_KEY, String(multiplier));
    window.dispatchEvent(new CustomEvent('font-size-changed'));
  }, [multiplier]);

  return (
    <div id="font-size-controller" className="font-size-controller">
      <label htmlFor="grammar-component-font-size">Размер шрифта:</label>
      <input
        id="grammar-component-font-size"
        type="range"
        min="0.75"
        max="1.5"
        step="0.05"
        value={multiplier}
        onChange={(event) => setMultiplier(parseFloat(event.target.value) || 1)}
      />
      <span className="font-size-controller__value">{Math.round(multiplier * 100)}%</span>
    </div>
  );
}

export function GrammarComponentTablesPage() {
  const [query, setQuery] = useState('');

  const visibleTables = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return tableComponents;

    return tableComponents.filter(({ title, source }) => {
      return `${title ?? ''} ${source ?? ''}`.toLowerCase().includes(needle);
    });
  }, [query]);

  return (
    <main className="grammar-component-tables-page">
      <FontSizeController />
      <div className="app">
        <header className="app__header">
          <h1>Latviešu valoda — HTML таблицы</h1>
          <p>Тестовая страница перенесённых React-компонентов из interactive-cheat-sheet.local.</p>
          <input
            className="grammar-component-tables-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск по названию..."
          />
          <p className="muted">
            Показано {visibleTables.length} из {tableComponents.length}
          </p>
        </header>

        <div className="app__stack">
          {visibleTables.map(({ Component, title }, index) => (
            <section key={`${title}-${index}`} className="grammar-component-tables-entry">
              <Component />
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
