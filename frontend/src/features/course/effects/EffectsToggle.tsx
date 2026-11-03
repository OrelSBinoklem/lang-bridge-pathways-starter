'use client';

export function EffectsToggle({ enabled, onChange, uk }: { enabled: boolean; onChange: (next: boolean) => void; uk: boolean }) {
  const label = enabled
    ? (uk ? 'Вимкнути ефекти груп' : 'Выключить эффекты групп')
    : (uk ? 'Увімкнути ефекти груп' : 'Включить эффекты групп');
  return (
    <button type="button" aria-label={label} aria-pressed={enabled} title={label} onClick={() => onChange(!enabled)}>
      <span aria-hidden="true">{enabled ? '✨' : '✦'}</span>
    </button>
  );
}
