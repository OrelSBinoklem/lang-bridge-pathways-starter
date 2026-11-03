'use client';

export default function DictionaryPreviewError({ reset }: { reset: () => void }) {
  return <main style={{ maxWidth: 680, margin: '12vh auto', padding: 24 }}>
    <h1>Не удалось загрузить категории / Не вдалося завантажити категорії</h1>
    <p>Попробуйте повторить загрузку. / Спробуйте ще раз.</p>
    <button type="button" onClick={reset} style={{ padding: '12px 20px', border: '1px solid currentColor', borderRadius: 12 }}>Повторить / Повторити</button>
  </main>;
}
