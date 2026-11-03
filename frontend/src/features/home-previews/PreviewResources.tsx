'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useLocale, useTranslations } from 'next-intl';
import { Dialog } from 'primereact/dialog';
import { USEFUL_LINKS } from '@/features/home/useful-links';
import styles from './home-preview.module.css';

const GrammarRu = dynamic(() => import('@/features/home/LangModalGrammarContent'));
const GrammarUk = dynamic(() => import('@/features/home/LangModalGrammarContent.uk'));
const ConceptsRu = dynamic(() => import('@/features/home/LangModalConceptsContent'));
const ConceptsUk = dynamic(() => import('@/features/home/LangModalConceptsContent.uk'));

export function PreviewResources({ dark }: { dark: boolean }) {
  const t = useTranslations('Home');
  const uk = useLocale() === 'uk';
  const [modal, setModal] = useState<'grammar' | 'concepts' | null>(null);

  return <section className={styles.resources} id="resources">
    <div className={styles.referenceActions}>
      <button type="button" onClick={() => setModal('grammar')} aria-haspopup="dialog"><i className="pi pi-table" aria-hidden="true" /><span>{t('grammarBtn')}</span><i className="pi pi-plus" aria-hidden="true" /></button>
      <button type="button" onClick={() => setModal('concepts')} aria-haspopup="dialog"><i className="pi pi-lightbulb" aria-hidden="true" /><span>{t('conceptsBtn')}</span><i className="pi pi-plus" aria-hidden="true" /></button>
    </div>
    <div className={styles.sectionTitle}><h2>{t('usefulLinks')}</h2></div>
    <div className={styles.usefulLinks}>{USEFUL_LINKS.lv.map(link => <a key={link.href} href={link.href} target={link.external ? '_blank' : undefined} rel={link.external ? 'noreferrer' : undefined} download={link.download || undefined} data-highlighted={link.highlighted || undefined}><span>{t(link.labelKey)}</span><i className={`pi ${link.download ? 'pi-download' : 'pi-arrow-up-right'}`} aria-hidden="true" /></a>)}</div>
    <Dialog
      header={modal === 'concepts' ? t('conceptsDialog') : t('grammarDialog')}
      visible={modal !== null}
      onHide={() => setModal(null)}
      modal dismissableMask maximizable blockScroll
      className={`${styles.referenceDialog} ${dark ? styles.referenceDialogDark : ''}`}
      style={{ width: 'min(1440px, 97vw)', maxHeight: '94dvh' }}
      contentStyle={{ maxHeight: 'calc(94dvh - 80px)', overflow: 'auto' }}
    >
      {modal === 'grammar' && (uk ? <GrammarUk /> : <GrammarRu />)}
      {modal === 'concepts' && (uk ? <ConceptsUk /> : <ConceptsRu />)}
    </Dialog>
  </section>;
}
