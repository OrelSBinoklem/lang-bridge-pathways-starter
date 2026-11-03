'use client';

import { useAdminMode } from '../contexts/AdminModeContext';
import { buildExamenViewUrl } from '../utils/examenViewMode';

/**
 * Переключение кастомный шаблон ↔ обычный список слов из БД (только для админа в режиме админа).
 */
export default function ExamenViewModeSwitch({
  forceDefaultView = false,
}: {
  forceDefaultView?: boolean;
}) {
  const { isAdminModeActive } = useAdminMode();

  if (!isAdminModeActive) {
    return null;
  }

  if (forceDefaultView) {
    return (
      <div
        className="examen-view-mode-switch examen-view-mode-switch--default-active"
        role="navigation"
      >
        <span className="examen-view-mode-switch__label">Обычный список слов из БД</span>
        <a href={buildExamenViewUrl(false)} className="examen-view-mode-switch__btn">
          ← Вернуться к кастомному шаблону
        </a>
      </div>
    );
  }

  return (
    <div className="examen-view-mode-switch" role="navigation">
      <a
        href={buildExamenViewUrl(true)}
        className="examen-view-mode-switch__btn examen-view-mode-switch__btn--primary"
      >
        📋 Обычный список слов (из БД)
      </a>
      <span className="examen-view-mode-switch__hint">
        Кастомный шаблон · для проверки исходных слов в категории
      </span>
    </div>
  );
}
