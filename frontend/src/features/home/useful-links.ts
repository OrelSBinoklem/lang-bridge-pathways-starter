import type { LearnLang } from '@/lib/learn-lang';

export type UsefulLinkDef = {
  href: string;
  labelKey:
    | 'linkElaipa'
    | 'linkProgressXlsx'
    | 'linkGlosbe'
    | 'linkMaciunmacies'
    | 'linkViaa'
    | 'linkGramatika'
    | 'linkDokobit'
    | 'linkDokobitVideo'
    | 'linkEpupa'
    | 'linkForvo'
    | 'linkValoduKursi'
    | 'linkUaenlv'
    | 'linkYoutubeStories'
    | 'linkEducation'
    | 'linkEnglishBritishCouncil'
    | 'linkEnglishCambridgeExams'
    | 'linkEnglishVoa'
    | 'linkEnglishCambridgeDictionary'
    | 'linkEnglishOxford'
    | 'linkEnglishYouglish'
    | 'linkEnglishWriteImprove';
  highlighted?: boolean;
  download?: boolean;
  external?: boolean;
};

/** Полезные ссылки под текущий learn_lang (как в WP lang-content.php) */
export const USEFUL_LINKS: Record<LearnLang, UsefulLinkDef[]> = {
  lv: [
    {
      href: 'https://elaipa.lv/Home/A1',
      labelKey: 'linkElaipa',
      highlighted: true,
      external: true,
    },
    {
      href: '/progress_latvieshu.xlsx',
      labelKey: 'linkProgressXlsx',
      highlighted: true,
      download: true,
    },
    {
      href: 'https://ru.glosbe.com/%D1%81%D0%BB%D0%BE%D0%B2%D0%B0%D1%80%D1%8C-%D0%BB%D0%B0%D1%82%D1%8B%D1%88%D1%81%D0%BA%D0%B8%D0%B9-%D1%80%D1%83%D1%81%D1%81%D0%BA%D0%B8%D0%B9',
      labelKey: 'linkGlosbe',
      highlighted: true,
      external: true,
    },
    {
      href: 'https://maciunmacies.valoda.lv/16-un-vairak',
      labelKey: 'linkMaciunmacies',
      highlighted: true,
      external: true,
    },
    {
      href: 'https://www.viaa.gov.lv/lv/parbaudes-programma',
      labelKey: 'linkViaa',
      highlighted: true,
      external: true,
    },
    {
      href: 'https://www.gramatika.lv/',
      labelKey: 'linkGramatika',
      external: true,
    },
    {
      href: 'https://www.dokobit.com/lv/',
      labelKey: 'linkDokobit',
      external: true,
    },
    {
      href: 'https://www.facebook.com/resume.lv.lv/videos/3554350828015245/',
      labelKey: 'linkDokobitVideo',
      external: true,
    },
    {
      href: 'https://epupa.valoda.lv/',
      labelKey: 'linkEpupa',
      external: true,
    },
    {
      href: 'https://forvo.com/languages/lv/',
      labelKey: 'linkForvo',
      external: true,
    },
    {
      href: 'https://www.valodukursi.lv/en/language-training-courses-classes-lessons/latvian-for-foreigners',
      labelKey: 'linkValoduKursi',
      external: true,
    },
    {
      href: 'https://t.me/uaenlv',
      labelKey: 'linkUaenlv',
      external: true,
    },
    {
      href: 'https://www.youtube.com/@%D0%9B%D0%B0%D1%82%D1%8B%D1%88%D1%81%D0%BA%D0%B8%D0%B9_%D0%B1%D0%B5%D0%B7_%D0%B7%D1%83%D0%B1%D1%80%D1%91%D0%B6%D0%BA%D0%B8/videos',
      labelKey: 'linkYoutubeStories',
      external: true,
    },
    {
      href: 'https://aic.lv/izglitiba-latvija/izglitibas-sistema/',
      labelKey: 'linkEducation',
      external: true,
    },
  ],
  en: [
    { href: 'https://learnenglish.britishcouncil.org/free-resources', labelKey: 'linkEnglishBritishCouncil', highlighted: true, external: true },
    { href: 'https://www.cambridgeenglish.org/exams-and-tests/qualifications/preparation/', labelKey: 'linkEnglishCambridgeExams', highlighted: true, external: true },
    { href: 'https://learningenglish.voanews.com/', labelKey: 'linkEnglishVoa', highlighted: true, external: true },
    { href: 'https://dictionary.cambridge.org/dictionary/english-russian/', labelKey: 'linkEnglishCambridgeDictionary', external: true },
    { href: 'https://www.oxfordlearnersdictionaries.com/us/definition/american_english/', labelKey: 'linkEnglishOxford', external: true },
    { href: 'https://youglish.com/', labelKey: 'linkEnglishYouglish', external: true },
    { href: 'https://writeandimprove.com/', labelKey: 'linkEnglishWriteImprove', external: true },
  ],
};

export function languageLevelLabel(value: number): string {
  const levels: Record<number, string> = {
    1: 'A1',
    2: 'A2',
    3: 'B1',
    4: 'B2',
    5: 'C1',
    6: 'C2',
  };
  return levels[value] ?? String(value);
}
