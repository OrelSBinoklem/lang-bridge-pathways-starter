// Large table text is the default; an explicit opt-out remains saved independently of mobile fonts.
export const GRAMMAR_FONT_COOKIE = 'lbp_grammar_font_large';

export function isGrammarFontLarge(value?: string | null): boolean {
  const preference = value?.trim().toLowerCase();
  return preference !== 'false' && preference !== '0';
}
