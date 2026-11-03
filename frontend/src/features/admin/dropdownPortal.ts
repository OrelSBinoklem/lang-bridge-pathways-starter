function getOpenDropdownTarget(): HTMLElement | null {
  const focused = document.querySelectorAll<HTMLElement>(
    '.p-dropdown.p-focus, .p-dropdown.p-inputwrapper-focus',
  );
  const el = focused[focused.length - 1] ?? document.activeElement?.closest?.('.p-dropdown');
  return el instanceof HTMLElement ? el : null;
}

function getLastDropdownPanel(): HTMLElement | null {
  const panels = document.querySelectorAll<HTMLElement>('.p-dropdown-panel');
  for (let i = panels.length - 1; i >= 0; i--) {
    const panel = panels[i];
    if (panel && getComputedStyle(panel).display !== 'none') return panel;
  }
  return null;
}

/** Всегда открыть панель вверх над полем */
function placeDropdownPanelUp(minHalfScreen: boolean) {
  const panel = getLastDropdownPanel();
  const target = getOpenDropdownTarget();
  if (!panel || !target) return;

  const tr = target.getBoundingClientRect();
  const spaceAbove = Math.max(80, tr.top - 8);
  const half = Math.round(window.innerHeight * 0.5);

  const wrap = panel.querySelector<HTMLElement>('.p-dropdown-items-wrapper');
  if (wrap && minHalfScreen) {
    // половина экрана; если сверху меньше — занимаем всё доступное место вверх
    const px = `${spaceAbove >= half ? half : spaceAbove}px`;
    wrap.style.minHeight = px;
    wrap.style.maxHeight = px;
    wrap.style.height = px;
  }

  const ph = panel.offsetHeight;
  let top = tr.top + window.scrollY - ph;
  if (top < window.scrollY + 4) top = window.scrollY + 4;

  panel.style.top = `${top}px`;
  panel.style.left = `${tr.left + window.scrollX}px`;
  panel.style.minWidth = `${tr.width}px`;
  panel.style.transformOrigin = 'bottom';
}

function onShowPlaceUp(minHalfScreen: boolean) {
  const run = () => placeDropdownPanelUp(minHalfScreen);
  requestAnimationFrame(() => {
    run();
    requestAnimationFrame(run);
    window.setTimeout(run, 0);
    window.setTimeout(run, 50);
  });
}

/** Обычные компактные dropdown — тоже вверх */
export const dropdownPortalProps = {
  appendTo: () => document.body,
  scrollHeight: '200px' as const,
  panelClassName: 'lbp-dropdown-panel-sm !z-[2500]',
  onShow: () => onShowPlaceUp(false),
};

/** Списки категорий: всегда вверх, высота списка ≈ половина экрана */
export const categoryDropdownPortalProps = {
  appendTo: () => document.body,
  scrollHeight: '50vh' as const,
  panelClassName: 'lbp-dropdown-panel-sm lbp-dropdown-panel-tall !z-[2500]',
  onShow: () => onShowPlaceUp(true),
};
