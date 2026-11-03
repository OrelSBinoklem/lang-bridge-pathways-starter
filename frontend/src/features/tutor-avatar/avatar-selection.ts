import { AVATAR_MODELS } from './avatarModels';

export const HUMAN_AVATAR_STORAGE_KEY = 'lbp.human-avatar.v1';
const CHANGE_EVENT = 'lbp.human-avatar.changed';
export const DEFAULT_HUMAN_AVATAR = AVATAR_MODELS[0].id;
let memorySelection = DEFAULT_HUMAN_AVATAR;
let memoryOnly = false;

export function validateHumanAvatar(value: unknown): string {
  return AVATAR_MODELS.some(model => model.id === value) ? value as string : DEFAULT_HUMAN_AVATAR;
}

export function getHumanAvatarSelection(): string {
  if (typeof window === 'undefined') return DEFAULT_HUMAN_AVATAR;
  if (memoryOnly) return memorySelection;
  try {
    memorySelection = validateHumanAvatar(window.localStorage.getItem(HUMAN_AVATAR_STORAGE_KEY));
    return memorySelection;
  } catch {
    return memorySelection;
  }
}

export function setHumanAvatarSelection(value: string): void {
  if (!AVATAR_MODELS.some(model => model.id === value) || typeof window === 'undefined') return;
  memorySelection = value;
  try {
    window.localStorage.setItem(HUMAN_AVATAR_STORAGE_KEY, value);
    memoryOnly = false;
  } catch {
    memoryOnly = true;
    console.warn('[HumanTutorAvatar] Avatar preference could not be saved; using this session.');
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

export function subscribeHumanAvatarSelection(listener: () => void): () => void {
  const browser = window;
  const onStorage = (event: StorageEvent) => {
    if (event.key !== HUMAN_AVATAR_STORAGE_KEY && event.key !== null) return;
    try {
      if (event.storageArea && event.storageArea !== browser.localStorage) return;
    } catch {
      // Storage may become unavailable after mounting; keep the in-memory preference usable.
    }
    memorySelection = validateHumanAvatar(event.key === null ? null : event.newValue);
    memoryOnly = false;
    listener();
  };
  browser.addEventListener(CHANGE_EVENT, listener);
  browser.addEventListener('storage', onStorage);
  return () => {
    browser.removeEventListener(CHANGE_EVENT, listener);
    browser.removeEventListener('storage', onStorage);
  };
}
