export type SkillKey = 'words' | 'grammar' | 'listening' | 'reading' | 'writing' | 'speaking';

const ALL_SKILLS: SkillKey[] = ['words', 'grammar', 'listening', 'reading', 'writing', 'speaking'];

// Пока в группе физически нет и не планируется часть навыков — их значки скрываем,
// а не просто гасим цветом (явное решение владельца: "убери лишние").
const INTRO_TITLES = new Set(['Введение', 'Вступ']);
const INTRO_SKILLS: SkillKey[] = ['grammar', 'listening'];

export function getVisibleSkills({ categoryId, title }: { categoryId: number | null; title: string | null }): Set<SkillKey> {
  if (title && INTRO_TITLES.has(title)) return new Set(INTRO_SKILLS);
  void categoryId;
  return new Set(ALL_SKILLS);
}
