'use client';

import React, { createContext, useContext, useMemo } from 'react';

/**
 * Режим админа: значение приходит снаружи (страница категории / ExamenTrainer),
 * чтобы не зависеть от WP window.myajax.
 */
const AdminModeContext = createContext({
  isAdmin: false,
  isAdminModeEnabled: false,
  isAdminModeActive: false,
  toggleAdminMode: () => {},
});

export function AdminModeProvider({ active = false, isAdmin = false, children }) {
  const value = useMemo(
    () => ({
      isAdmin: Boolean(isAdmin),
      isAdminModeEnabled: Boolean(active),
      isAdminModeActive: Boolean(isAdmin && active),
      toggleAdminMode: () => {},
    }),
    [active, isAdmin],
  );

  return <AdminModeContext.Provider value={value}>{children}</AdminModeContext.Provider>;
}

export function useAdminMode() {
  return useContext(AdminModeContext);
}
