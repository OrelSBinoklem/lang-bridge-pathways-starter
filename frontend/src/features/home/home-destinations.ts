import type { LearnLang } from '@/lib/learn-lang';

export function homeDestinations(language: LearnLang) {
  return language === 'en'
    ? { grammar: '/grammar/english', practice: '/grammar/practice?learn_lang=en', exams: '/exams?learn_lang=en', course: '/course/english' }
    : { grammar: '/grammar', practice: '/grammar/practice', exams: '/exams', course: '/course' };
}

export function homeCourseLevelHref(language: LearnLang, level: string) {
  return `${homeDestinations(language).course}?level=${encodeURIComponent(level)}`;
}
