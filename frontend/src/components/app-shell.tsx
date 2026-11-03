'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useTheme } from 'next-themes';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LanguageBanner } from '@/components/language-banner';
import { SuperLogo } from '@/components/super-logo';
import { setCameraAdmin } from '@/features/course/effects/scenes/orbitControl';
import { useEffectComparison } from '@/features/course/effects/useEffectComparison';
import { useEffectsEnabled } from '@/features/course/effects/useEffectsEnabled';
import { ThemeToggle } from '@/components/theme-toggle';
import { CreditBalance } from '@/features/credits/CreditBalance';
import { CourseContinue } from '@/features/course/CourseContinue';
import { FloatingTutorAssistant } from '@/features/tutor/FloatingTutorAssistant';
import { VerbSearchWithModal } from '@/features/verb-search';
import { clientApi } from '@/lib/client-api';
import { backendHref } from '@/lib/admin-navigation';
import { useAdminAppearance } from '@/features/admin/useUserPreview';
import { UserPreviewToggle } from '@/features/admin/UserPreviewToggle';
import { GRAMMAR_FONT_COOKIE, isGrammarFontLarge } from '@/lib/grammar-font-preference';
import {
  applyLearnLang,
  getLearnLangFromCookie,
  isLearnLang,
  LEARN_LANG_EVENT,
  LearnLang,
} from '@/lib/learn-lang';
import {
  applyUiLang,
  detectBrowserUiLang,
  getUiLangFromCookie,
  type AppLocale,
} from '@/lib/ui-lang';
import styles from '@/components/app-shell.module.css';

type ApiUser = {
  id: number;
  name: string;
  is_admin?: boolean;
  preferred_learn_lang?: string | null;
};

type DebugbarWidgetResponse = {
  html?: string;
};

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]+)`));
  return m?.[1] ?? null;
}

function setCookie(name: string, value: string, days = 7) {
  document.cookie = `${name}=${value}; path=/; max-age=${days * 86400}; SameSite=Lax`;
}

function LaravelDebugbarBridge({ enabled }: { enabled: boolean }) {
  useEffect(() => {
    if (!enabled || typeof document === 'undefined') return;
    if (document.getElementById('lbp-laravel-debugbar-bridge')) return;

    let cancelled = false;
    const marker = document.createElement('div');
    marker.id = 'lbp-laravel-debugbar-bridge';
    marker.hidden = true;
    document.body.appendChild(marker);

    const appendScript = (script: HTMLScriptElement) =>
      new Promise<void>((resolve, reject) => {
        const next = document.createElement('script');
        Array.from(script.attributes).forEach((attr) => next.setAttribute(attr.name, attr.value));
        next.text = script.text;
        next.async = false;
        next.onload = () => resolve();
        next.onerror = () => reject(new Error(`Laravel Debugbar script failed: ${next.src || 'inline'}`));
        document.body.appendChild(next);
        if (!next.src) resolve();
      });

    clientApi<DebugbarWidgetResponse>('/debugbar/widget')
      .then(async (payload) => {
        if (cancelled || !payload.html) return;

        const html = payload.html.replace(/(?:https?:\/\/[^"']+)?\/_debugbar/g, '/api/debugbar-proxy');
        const template = document.createElement('template');
        template.innerHTML = html;

        const scripts: HTMLScriptElement[] = [];
        Array.from(template.content.childNodes).forEach((node) => {
          if (node instanceof HTMLScriptElement) {
            scripts.push(node);
            return;
          }
          document.body.appendChild(document.importNode(node, true));
        });

        for (const script of scripts) {
          if (cancelled) return;
          await appendScript(script);
        }
      })
      .catch((error) => {
        console.error('Laravel Debugbar bridge failed', error);
        marker.remove();
      });

    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return null;
}

export function AppShell({ children, initialLearnLang, initialLargeFont = true }: { children: React.ReactNode; initialLearnLang: LearnLang; initialLargeFont?: boolean }) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const t = useTranslations('Shell');
  const locale = useLocale() as AppLocale;
  const navRef = useRef<HTMLElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [user, setUser] = useState<ApiUser | null>(null);
  const adminAppearance = useAdminAppearance(user?.is_admin);
  const [sky, setSky] = useState({ rgb: 'rgb(208,224,240)', bright: true });
  const [answerMode, setAnswerMode] = useState<'type' | 'select'>('type');
  const [cooldownTier, setCooldownTier] = useState<'0' | '1' | '2'>('0');
  const [largeFont, setLargeFont] = useState(initialLargeFont);
  const [learnLang, setLearnLang] = useState<LearnLang>(initialLearnLang);
  const [effectComparison, setEffectComparison] = useEffectComparison();
  const [, setEffectsEnabled] = useEffectsEnabled();

  useEffect(() => {
    if (!getUiLangFromCookie()) {
      applyUiLang(detectBrowserUiLang());
    }
  }, []);

  useEffect(() => {
    const skyColor = getCookie('skyColor');
    const isBright = getCookie('isBright');
    if (skyColor) {
      const [r, g, b] = skyColor.split(',').map((n) => Number(n.trim()) || 0);
      const rgb = `rgb(${r}, ${g}, ${b})`;
      document.documentElement.style.setProperty('--lbp-sky', rgb);
      document.documentElement.style.setProperty('--lbp-sky-a0', `rgba(${r}, ${g}, ${b}, 0)`);
      document.documentElement.style.setProperty('--lbp-sky-a1', `rgba(${r}, ${g}, ${b}, 1)`);
      setSky({ rgb, bright: isBright !== 'false' });
    }
    const mode = getCookie('lbp_training_answer_mode');
    if (mode === 'select' || mode === 'type') {
      setAnswerMode(mode);
    } else {
      // как в WP: на телефоне по умолчанию «Выбор слов», на ПК — «Ввод слов»
      const defaultMode = window.innerWidth <= 768 ? 'select' : 'type';
      setAnswerMode(defaultMode);
      setCookie('lbp_training_answer_mode', defaultMode);
    }
    const tier = getCookie('lbp_cooldown_tier_pref');
    if (tier === '0' || tier === '1' || tier === '2') setCooldownTier(tier);
    setLargeFont(isGrammarFontLarge(getCookie(GRAMMAR_FONT_COOKIE)));
    setLearnLang(getLearnLangFromCookie() ?? 'lv');

    clientApi<{ user: ApiUser }>('/user')
      .then((r) => setUser(r.user))
      .catch(() => setUser(null));
  }, [pathname]);

  useEffect(() => {
    document.documentElement.classList.toggle('lbp-font-large', largeFont);
  }, [largeFont]);

  // The 3D effects' camera: its default and the «C» key are for admins (orbitControl.ts).
  useEffect(() => {
    setCameraAdmin(adminAppearance);
  }, [adminAppearance]);

  useEffect(() => {
    const onLang = (e: Event) => {
      const lang = (e as CustomEvent<LearnLang>).detail;
      if (isLearnLang(lang)) setLearnLang(lang);
    };
    window.addEventListener(LEARN_LANG_EVENT, onLang);
    return () => window.removeEventListener(LEARN_LANG_EVENT, onLang);
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    const onDocClick = (e: MouseEvent) => {
      // Overlays that drive the menu (the home tour) mark themselves with data-keep-menu.
      if (navRef.current && !navRef.current.contains(e.target as Node) && !(e.target as Element | null)?.closest?.('[data-keep-menu]')) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, [menuOpen]);

  const onSkyChange = useCallback((payload: { rgb: string; bright: boolean }) => {
    setSky({ rgb: payload.rgb, bright: payload.bright });
  }, []);

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
    window.location.href = '/login';
  }

  function pickLang(code: LearnLang) {
    if (code === learnLang) {
      setLangOpen(false);
      setMenuOpen(false);
      return;
    }
    setLearnLang(code);
    applyLearnLang(code);
    if (user) {
      clientApi('/me/preferred-learn-lang', {
        method: 'PATCH',
        body: JSON.stringify({ preferred_learn_lang: code }),
      }).catch(() => undefined);
    }
    setLangOpen(false);
    setMenuOpen(false);
    // список словарей на главной — после смены языка уходим туда
    if (pathname !== '/') {
      router.push('/');
    }
  }

  function pickUiLang(next: AppLocale) {
    if (next === locale) {
      setMenuOpen(false);
      return;
    }
    applyUiLang(next);
    setMenuOpen(false);
    router.refresh();
  }

  useEffect(() => {
    const onTutorMenuAction = (event: Event) => {
      const detail = (event as CustomEvent<{ action?: string; value?: string }>).detail || {};
      const value = String(detail.value || '').toLowerCase();

      if (detail.action === 'open_menu') setMenuOpen(true);
      if (detail.action === 'close_menu') setMenuOpen(false);
      if (detail.action === 'toggle_menu') setMenuOpen((v) => !v);
      if (detail.action === 'navigate_dictionaries') {
        setMenuOpen(false);
        router.push('/');
      }
      if (detail.action === 'navigate_grammar') {
        setMenuOpen(false);
        router.push('/grammar');
      }
      if (detail.action === 'navigate_profile') {
        setMenuOpen(false);
        router.push(user ? '/dashboard' : '/login');
      }
      if (detail.action === 'open_filament' && adminAppearance) {
        window.open(backendHref('/admin'), '_blank', 'noopener,noreferrer');
        setMenuOpen(false);
      }
      if (detail.action === 'set_answer_mode' && (value === 'type' || value === 'select')) {
        setAnswerMode(value);
        setCookie('lbp_training_answer_mode', value);
        setMenuOpen(false);
      }
      if (detail.action === 'set_cooldown' && (value === '0' || value === '2')) {
        setCooldownTier(value);
        setCookie('lbp_cooldown_tier_pref', value);
        setMenuOpen(false);
      }
      if (detail.action === 'set_large_font') {
        const next = value === 'true' || value === '1' || value === 'on';
        setLargeFont(next);
        setCookie(GRAMMAR_FONT_COOKIE, next ? 'true' : 'false');
        setMenuOpen(false);
      }
      if (detail.action === 'set_ui_lang' && (value === 'ru' || value === 'uk')) {
        pickUiLang(value);
      }
      if (detail.action === 'set_learn_lang' && isLearnLang(value)) {
        pickLang(value);
      }
      if (detail.action === 'toggle_theme') {
        setTheme(theme === 'dark' ? 'light' : 'dark');
        setMenuOpen(false);
      }
    };

    window.addEventListener('tutor.site.menu.activate', onTutorMenuAction);
    return () => window.removeEventListener('tutor.site.menu.activate', onTutorMenuAction);
  }, [pathname, pickLang, pickUiLang, router, setTheme, theme, user, adminAppearance]);

  const headerTone = sky.bright ? styles.headerBright : styles.headerDark;
  const isCleanDictionaryPreview = pathname.startsWith('/dictionary-previews/') && (pathname.endsWith('/clean-progress') || pathname.endsWith('/original'));
  const courseLanguage = pathname === '/course/english' || pathname === '/grammar/english' ? 'en' : learnLang;
  const showCourseContinue = !!user && (['/', '/dashboard', '/course', '/course/english', '/grammar', '/grammar/english', '/grammar/practice', '/tutor'].includes(pathname)
    || pathname.startsWith('/dictionaries/') || isCleanDictionaryPreview || pathname.startsWith('/lessons/'));

  if (pathname === '/course/street-relight' || pathname === '/course/holographic-foil' || pathname === '/course/water-lab' || (pathname.startsWith('/dictionary-previews/') && !isCleanDictionaryPreview) || pathname === '/home-previews' || (pathname.startsWith('/home-previews/') && pathname !== '/home-previews/unified')) return <><UserPreviewToggle isAdmin={!!user?.is_admin} />{children}</>;

  return (
    <div className={styles.app}>
      <UserPreviewToggle isAdmin={!!user?.is_admin} />
      <header data-app-header="" className={`${styles.header} ${headerTone}`}>
        <div className={styles.headerContent}>
          <SuperLogo onSkyChange={onSkyChange} />

          <div className={styles.searchWrap}>
            <VerbSearchWithModal bright={sky.bright} initialLearnLang={learnLang} />
          </div>

          <nav ref={navRef} className={`${styles.nav} ${sky.bright ? styles.navDark : ''}`}>
            {showCourseContinue && <CourseContinue key={`${user.id}:${courseLanguage}`} userId={user.id} lang={courseLanguage}
              navigation onNavigate={() => setMenuOpen(false)} />}
            <button
              type="button"
              className={styles.menuToggle}
              aria-controls="primary-menu"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              <span className={styles.menuIcon}>☰</span>
              <span> {t('menu')}</span>
            </button>

            <ul
              id="primary-menu"
              className={`${styles.primaryMenu} ${menuOpen ? styles.primaryMenuOpen : ''}`}
            >
              {showCourseContinue && <li id="course-continue-menu-root" className={styles.continueMenuItem} />}
              <li className={styles.menuItem} data-tour="menu-nav">
                <Link href={courseLanguage === 'en' ? '/course/english' : '/course'} prefetch={false} onClick={() => setMenuOpen(false)}>
                  {locale === 'uk' ? 'Шлях курсу' : 'Путь курса'}
                </Link>
              </li>
              <li className={styles.menuItem} data-tour="menu-nav">
                <Link href={courseLanguage === 'en' ? '/exams?learn_lang=en' : '/exams'} onClick={() => setMenuOpen(false)}>
                  {locale === 'uk' ? 'Іспити' : 'Экзамены'}
                </Link>
              </li>
              <li className={`${styles.menuItem} ${styles.menuTitleItem}`} data-tour="menu-nav">
                <Link
                  href={pathname.startsWith('/grammar') ? (courseLanguage === 'en' ? '/grammar/english' : '/grammar') : '/'}
                  onClick={() => setMenuOpen(false)}
                >
                  {pathname.startsWith('/grammar') ? t('mainTables') : t('dictionaries')}
                </Link>
              </li>

              {!pathname.startsWith('/grammar') && (
                <li className={styles.menuItem} data-tour="menu-nav">
                  <Link href={learnLang === 'en' ? '/grammar/english' : '/grammar'} onClick={() => setMenuOpen(false)}>
                    {t('grammar')}
                  </Link>
                </li>
              )}
              {pathname.startsWith('/grammar') && (
                <li className={styles.menuItem}>
                  <Link href="/" onClick={() => setMenuOpen(false)}>
                    {t('dictionaries')}
                  </Link>
                </li>
              )}

              <li className={styles.menuItem} data-tour="menu-plans"><Link href="/plans" onClick={() => setMenuOpen(false)}>{locale === 'uk' ? 'Доступ до послуг ШІ' : 'Доступ к ИИ услугам'}</Link></li>
              {user ? (
                <>
                  <li className={styles.menuItem} data-tour="menu-account"><CreditBalance onOpen={() => setMenuOpen(false)} /></li>
                  <li className={styles.menuItem} data-tour="menu-account">
                    <Link href="/dashboard" onClick={() => setMenuOpen(false)}>
                      {t('profile')}
                    </Link>
                  </li>
                  <li className={styles.menuItem} data-tour="menu-account">
                    <button type="button" className={styles.menuLinkBtn} onClick={logout}>
                      {t('logout')}
                    </button>
                  </li>
                </>
              ) : (
                <li className={styles.menuItem} data-tour="menu-login">
                  <Link href="/login" onClick={() => setMenuOpen(false)}>
                    {t('login')}
                  </Link>
                </li>
              )}

              {adminAppearance && (
                <li className={styles.menuItem}>
                  <a className={styles.adminLink} href={backendHref('/admin')} target="_blank" rel="noreferrer">
                    Filament
                  </a>
                </li>
              )}
              {adminAppearance && (
                <li className={styles.menuItem}>
                  <Link className={styles.adminLink} href="/admin-tools" prefetch={false} onClick={() => setMenuOpen(false)}>
                    <i className="pi pi-sitemap" aria-hidden /> {locale === 'uk' ? 'Карта сторінок адміністратора' : 'Карта страниц администратора'}
                  </Link>
                </li>
              )}
              {adminAppearance && (
                <li className={styles.menuItem}>
                  <Link className={styles.adminLink} href="/course/effects-preview" prefetch={false} onClick={() => setMenuOpen(false)}>
                    Экспериментальные эффекты
                  </Link>
                </li>
              )}

              {pathname.startsWith('/grammar') && (
                <li id="grammar-menu-portal-root" className={styles.controlsItem} />
              )}

              {adminAppearance && (
                <li className={styles.controlsItem}>
                  <div className={styles.controlsWrap}>
                    <button type="button" role="switch" aria-checked={effectComparison}
                      className={`${styles.fontBtn} ${styles.effectComparison} ${effectComparison ? styles.fontBtnActive : ''}`}
                      onClick={() => {
                        const next = !effectComparison;
                        setEffectComparison(next);
                        if (next) setEffectsEnabled(true);
                      }}>
                      <i className={`pi ${effectComparison ? 'pi-check-square' : 'pi-stop'}`} aria-hidden="true" />
                      <span>{locale === 'uk' ? 'Ефект: картка + фон' : 'Эффект: карточка + фон'}</span>
                    </button>
                  </div>
                </li>
              )}

              <li className={styles.controlsItem} data-tour="menu-answer">
                <div className={`${styles.controlsWrap} ${styles.toggleRow}`}>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${answerMode === 'type' ? styles.toggleBtnActive : ''}`}
                    onClick={() => {
                      setAnswerMode('type');
                      setCookie('lbp_training_answer_mode', 'type');
                    }}
                  >
                    {t('typeWords')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${answerMode === 'select' ? styles.toggleBtnActive : ''}`}
                    onClick={() => {
                      setAnswerMode('select');
                      setCookie('lbp_training_answer_mode', 'select');
                    }}
                  >
                    {t('selectWords')}
                  </button>
                </div>
              </li>

              {!pathname.startsWith('/grammar') && (
                <li className={styles.controlsItem} data-tour="menu-cooldown">
                  <div className={`${styles.controlsWrap} ${styles.toggleRow}`}>
                    <button
                      type="button"
                      className={`${styles.toggleBtn} ${cooldownTier === '2' ? styles.toggleBtnActive : ''}`}
                      title={t('cooldown3hTitle')}
                      onClick={() => {
                        setCooldownTier('2');
                        setCookie('lbp_cooldown_tier_pref', '2');
                      }}
                    >
                      {t('cooldown3h')}
                    </button>
                    <button
                      type="button"
                      className={`${styles.toggleBtn} ${cooldownTier === '0' ? styles.toggleBtnActive : ''}`}
                      title={t('cooldown20hTitle')}
                      onClick={() => {
                        setCooldownTier('0');
                        setCookie('lbp_cooldown_tier_pref', '0');
                      }}
                    >
                      {t('cooldown20h')}
                    </button>
                  </div>
                </li>
              )}

              <li className={styles.controlsItem} data-tour="menu-font">
                <div className={styles.controlsWrap}>
                  <button
                    type="button"
                    className={`${styles.fontBtn} ${largeFont ? styles.fontBtnActive : ''}`}
                    onClick={() => {
                      const next = !largeFont;
                      setLargeFont(next);
                      setCookie(GRAMMAR_FONT_COOKIE, next ? 'true' : 'false');
                    }}
                  >
                    <span className={styles.fontCheckbox}>{largeFont ? '✓' : ''}</span>
                    <span>{t('largeFont')}</span>
                  </button>
                </div>
              </li>

              <li className={styles.controlsItem} data-tour="menu-ui-lang">
                <div className={`${styles.controlsWrap} ${styles.toggleRow}`}>
                  <span className={styles.uiLangLabel}>{t('uiLang')}</span>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${locale === 'uk' ? styles.toggleBtnActive : ''}`}
                    onClick={() => pickUiLang('uk')}
                  >
                    {t('uiUk')}
                  </button>
                  <button
                    type="button"
                    className={`${styles.toggleBtn} ${locale === 'ru' ? styles.toggleBtnActive : ''}`}
                    onClick={() => pickUiLang('ru')}
                  >
                    {t('uiRu')}
                  </button>
                </div>
              </li>

              {/* The home tour (features/home-tour) starts again from here. */}
              <li className={styles.menuItem} data-tour="menu-tour">
                <Link href={(/^\/dictionaries\/\d+\/category\/\d+\/?$/.test(pathname) || /^\/grammar(?:\/english)?\/?$/.test(pathname) || /^\/course(?:\/english)?\/?$/.test(pathname)) ? `${pathname}?tour=1` : '/?tour=1'} prefetch={false} onClick={(e) => {
                  setMenuOpen(false);
                  if (pathname === '/') { e.preventDefault(); window.dispatchEvent(new CustomEvent('lbp.tour.start')); }
                  else if (/^\/dictionaries\/\d+\/category\/\d+\/?$/.test(pathname)) { e.preventDefault(); window.dispatchEvent(new CustomEvent('lbp.words-tour.start')); }
                  else if (/^\/grammar(?:\/english)?\/?$/.test(pathname)) { e.preventDefault(); window.dispatchEvent(new CustomEvent('lbp.grammar-tour.start')); }
                  else if (/^\/course(?:\/english)?\/?$/.test(pathname)) { e.preventDefault(); window.dispatchEvent(new CustomEvent('lbp.course-tour.start')); }
                }}>
                  {locale === 'uk' ? 'Пройти тур знову' : 'Пройти тур заново'}
                </Link>
              </li>

              <li className={`${styles.controlsItem} ${styles.langFooter}`} data-tour="menu-learn-lang">
                <div className={styles.langFooterInner}>
                  <button
                    type="button"
                    className={styles.langBtn}
                    title={t('learnLangTitle')}
                    onClick={() => {
                      setLangOpen(true);
                      setMenuOpen(false);
                    }}
                  >
                    <span>🌐</span>
                    <span>{learnLang.toUpperCase()}</span>
                  </button>
                  <div className={styles.themeWrap}>
                    <ThemeToggle />
                  </div>
                </div>
              </li>
            </ul>
          </nav>
        </div>
      </header>

      <div
        className={`${styles.langModal} ${langOpen ? styles.langModalActive : ''}`}
        role="dialog"
        aria-hidden={!langOpen}
      >
        <button
          type="button"
          className={styles.langOverlay}
          aria-label={t('uiLang')}
          onClick={() => setLangOpen(false)}
        />
        <div className={styles.langContent}>
          <button type="button" className={styles.langClose} onClick={() => setLangOpen(false)}>
            ×
          </button>
          <h2 className={styles.langTitle}>{t('pickLearnLang')}</h2>
          <div className={styles.langBanners}>
            <LanguageBanner
              code="lv"
              title={t('latvian')}
              level="B2"
              active={learnLang === 'lv'}
              onSelect={() => pickLang('lv')}
            />
            <LanguageBanner
              code="en"
              title={t('english')}
              level="B2"
              active={learnLang === 'en'}
              onSelect={() => pickLang('en')}
            />
          </div>
        </div>
      </div>

      <main
        className={`${styles.main} ${
          pathname.startsWith('/grammar')
            ? styles.mainFull
            : (pathname.startsWith('/dictionaries') || isCleanDictionaryPreview)
              ? styles.mainWide
              : ''
        }`}
      >
        {children}
      </main>

      {!pathname.startsWith('/grammar') && (
        <footer className={styles.footer}>
          <div className={styles.footerInner}>
            <p>© {new Date().getFullYear()} LangBridgePathways</p>
            <a
              className={styles.footerGithub}
              href="https://github.com/OrelSBinoklem/lang-bridge-pathways/tree/master"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('githubRepo')}
              title={t('githubRepo')}
            >
              <svg className={styles.footerIcon} viewBox="0 0 24 24" aria-hidden focusable="false">
                <path
                  fill="currentColor"
                  d="M12 2C6.48 2 2 6.58 2 12.24c0 4.51 2.87 8.33 6.84 9.68.5.09.68-.22.68-.49 0-.24-.01-.87-.01-1.71-2.78.62-3.37-1.36-3.37-1.36-.45-1.17-1.11-1.48-1.11-1.48-.91-.64.07-.63.07-.63 1 .07 1.53 1.05 1.53 1.05.9 1.56 2.36 1.11 2.94.85.09-.67.35-1.11.63-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.69 0 0 .84-.28 2.75 1.05A9.2 9.2 0 0 1 12 6.84c.85.004 1.71.12 2.51.35 1.91-1.33 2.75-1.05 2.75-1.05.55 1.39.2 2.43.1 2.69.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.81-4.57 5.07.36.32.68.94.68 1.9 0 1.37-.01 2.47-.01 2.81 0 .27.18.59.69.49A10.03 10.03 0 0 0 22 12.24C22 6.58 17.52 2 12 2Z"
                />
              </svg>
            </a>
            <a
              className={styles.footerTelegram}
              href="https://t.me/+M4RIqAf6jVc2YWUy"
              target="_blank"
              rel="noopener noreferrer"
              aria-label={t('telegramChannel')}
              title={t('telegramChannel')}
            >
              <svg className={styles.footerIcon} viewBox="0 0 24 24" aria-hidden focusable="false">
                <path
                  fill="currentColor"
                  d="M9.78 18.65c-.29 0-.24-.11-.34-.38l-.86-2.83 6.61-3.92c.31-.17.07-.27-.17-.1l-8.17 5.14-3.52-1.1c-.76-.24-.77-.76.17-1.13l13.74-5.3c.63-.23 1.18.15.98 1.12l-2.34 11.02c-.16.78-.63.96-1.29.6l-3.57-2.64-1.72 1.66c-.19.19-.35.35-.72.35Z"
                />
              </svg>
            </a>
          </div>
        </footer>
      )}

      {!pathname.startsWith('/exams') && <FloatingTutorAssistant isAdmin={adminAppearance} />}
      {/* Keep legacy scripts initialized; user preview hides their DOM outside React. */}
      <LaravelDebugbarBridge enabled={!!user?.is_admin} />
    </div>
  );
}
