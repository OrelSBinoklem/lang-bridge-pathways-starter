const LV_MAP: Record<string, string> = {
  ā: 'a',
  č: 'c',
  ē: 'e',
  ģ: 'g',
  ī: 'i',
  ķ: 'k',
  ļ: 'l',
  ņ: 'n',
  š: 's',
  ū: 'u',
  ž: 'z',
  Ā: 'a',
  Č: 'c',
  Ē: 'e',
  Ģ: 'g',
  Ī: 'i',
  Ķ: 'k',
  Ļ: 'l',
  Ņ: 'n',
  Š: 's',
  Ū: 'u',
  Ž: 'z',
};

export function normalizeLatvian(str: string): string {
  return String(str || '').replace(/[āčēģīķļņšūžĀČĒĢĪĶĻŅŠŪŽ]/g, (letter) => LV_MAP[letter] || letter);
}
