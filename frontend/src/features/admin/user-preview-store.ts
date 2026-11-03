const STORAGE_KEY = 'lbp_user_view';
const CHANGE_EVENT = 'lbp.user-view.changed';
let memoryValue = false;

// Visual preference only. Never use this flag for API authorization or billing.
export function getUserPreview() {
  if (typeof window === 'undefined') return false;
  try {
    return window.sessionStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return memoryValue;
  }
}

export function setUserPreview(enabled: boolean) {
  memoryValue = enabled;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, enabled ? '1' : '0');
  } catch {
    // Still allow returning to the admin view when browser storage is disabled.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeUserPreview(listener: () => void) {
  window.addEventListener(CHANGE_EVENT, listener);
  return () => window.removeEventListener(CHANGE_EVENT, listener);
}
