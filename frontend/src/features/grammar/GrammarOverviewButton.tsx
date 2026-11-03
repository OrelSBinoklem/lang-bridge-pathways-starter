'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useLocale } from 'next-intl';
import { Dialog } from 'primereact/dialog';

const EnglishOverview = dynamic(() => import('@/features/english-grammar/overview/EnglishGrammarOverview'), { loading: () => <p role="status">Загрузка обзора…</p> });
const LatvianOverview = dynamic(() => import('@/features/home/reference/ReferenceReader'), { loading: () => <p role="status">Загрузка обзора…</p> });

export function GrammarOverviewButton({ language = 'lv' }: { language?: 'lv' | 'en' }) {
  const [open, setOpen] = useState(false);
  const locale = useLocale() === 'uk' ? 'uk' : 'ru';
  const label = locale === 'uk' ? 'Оглядова граматика' : 'Обзорная грамматика';
  return <><button type="button" data-grammar-tour="overview" aria-haspopup="dialog" onClick={() => setOpen(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '7px 12px', background: '#edf5f2', color: '#155b4f', border: '1px solid #b4d1c6', borderRadius: 5, cursor: 'pointer', font: 'inherit' }}><i className="pi pi-compass" aria-hidden /><span>{label}</span></button>
    <Dialog header={`${label} · ${language === 'en' ? (locale === 'uk' ? 'Англійська' : 'Английский') : (locale === 'uk' ? 'Латиська' : 'Латышский')}`}
      visible={open} onHide={() => setOpen(false)} modal dismissableMask maximizable blockScroll
      style={{ width: 'min(1440px, 97vw)', maxHeight: '94dvh' }} breakpoints={{ '960px': '96vw' }} contentStyle={{ maxHeight: 'calc(94dvh - 80px)', overflow: 'auto' }}>
      {open && (language === 'en' ? <EnglishOverview locale={locale} /> : <LatvianOverview kind="grammar" locale={locale} />)}
    </Dialog></>;
}
