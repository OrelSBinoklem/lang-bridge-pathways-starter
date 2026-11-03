/**
 * Plays the home tour: the guide cat jumps to each explained element, dims the rest of the page, opens the main
 * menu for the menu steps (shared `tutor.site.menu.activate` events) and speaks every line. Plain class so React
 * only renders the controls; every newer command (next, back, close) supersedes the running step.
 */
import type { CatMascot } from '@/features/cat-mascot/catMascot';
import { HOME_TOUR, tourText, type TourLang, type TourStep } from './homeTourSteps';
import { TourVoice } from './tourVoice';

export type TourPhase = 'off' | 'invite' | 'running' | 'closing';
export type TourState = { phase: TourPhase; index: number; paused: boolean; muted: boolean };

export const TOUR_LAYER = 100000;
const COOKIE = 'lbp_home_tour';
/** The cat asks by itself on page load until the tour has been watched, at most this many times. */
const MAX_INVITES = 3;
let activeRunner: HomeTourRunner | null = null;
const AVOID = 'main a[href], main button, main h2';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Cookie: how many times the cat has asked by itself, or `done` once the tour was started. */
const tourCookie = (name = COOKIE) => document.cookie.split('; ').find(c => c.startsWith(`${name}=`))?.slice(name.length + 1);
const setTourCookie = (value: string, name = COOKIE) => { document.cookie = `${name}=${value}; path=/; max-age=${2 * 365 * 86400}; samesite=lax`; };
export const tourInviteDue = (name = COOKIE) => { const v = tourCookie(name); return v !== 'done' && !(Number(v) >= MAX_INVITES); };

export type TourDefinition = {
  steps: TourStep[];
  text: (key: string, lang: TourLang) => string;
  cookie: string;
  replayTarget: string;
  beforeStep?: (step: TourStep, lang: TourLang) => void | Promise<void>;
  cleanup?: () => void;
  keepOnScreen?: boolean;
};

/** The invitation in the cat's bubble: the question and its two answers. */
export type TourInvitation = { text: string; start: string; later: string };

/** Brings in-flow targets into view under the fixed header before the cat jumps there. */
async function reveal(targets: HTMLElement[]) {
  const menu = targets[0].closest<HTMLElement>('#primary-menu');
  if (menu) {
    const target = targets[0].getBoundingClientRect(), panel = menu.getBoundingClientRect();
    // The menu has its own scroll area; centre the explanation away from the bottom controls.
    menu.scrollTo({ top: menu.scrollTop + target.top - panel.top - (menu.clientHeight - target.height) / 2, behavior: 'smooth' });
    await sleep(350);
    return;
  }
  if (targets[0].closest('header, #primary-menu') || getComputedStyle(targets[0]).position === 'fixed') return;
  const rects = targets.map(t => t.getBoundingClientRect());
  const top = Math.min(...rects.map(r => r.top)), bottom = Math.max(...rects.map(r => r.bottom));
  if (top > 90 && bottom < innerHeight - 40) return;
  const y = scrollY + (bottom - top < innerHeight - 100 ? (top + bottom) / 2 - (100 + innerHeight) / 2 + 60 : top - 110);
  window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
  await sleep(550);
}

export class HomeTourRunner {
  state: TourState = { phase: 'off', index: 0, paused: false, muted: false };
  private cat: CatMascot | null = null;
  private voice: TourVoice | null = null;
  private run = 0;
  private menuOpen = false;
  private lifecycle = 0;
  private initializing: Promise<CatMascot | null> | null = null;

  constructor(private lang: TourLang, private release: string | null, private invitation: TourInvitation, private onChange: (state: TourState) => void, private definition?: TourDefinition) {}

  /** The interface language can change while the page stays open; the next line follows it. */
  setLanguage(lang: TourLang, invitation: TourInvitation) {
    if (lang === this.lang) return;
    this.lang = lang; this.invitation = invitation;
    if (this.state.phase === 'invite') this.ask();
  }

  /** The question with its answer buttons in the cat's bubble; a click on them also unlocks sound. */
  private ask() {
    const { text, start, later } = this.invitation;
    this.cat?.say(text, 600000, [
      { label: start, primary: true, onClick: () => void this.begin() },
      { label: later, onClick: () => void this.close() },
    ]);
  }

  private set(patch: Partial<TourState>) { this.state = { ...this.state, ...patch }; this.onChange(this.state); }

  private ensureCat() {
    if (this.initializing) return this.initializing;
    if (this.cat) return Promise.resolve(this.cat);
    const epoch = this.lifecycle;
    this.initializing = this.createCat(epoch).finally(() => { if (epoch === this.lifecycle) this.initializing = null; });
    return this.initializing;
  }

  private async createCat(epoch: number) {
    const { CatMascot } = await import('@/features/cat-mascot/catMascot');
    if (epoch !== this.lifecycle) return null;
    const cat = new CatMascot({ size: innerWidth < 600 ? 160 : 320, outfit: 'professor', layer: TOUR_LAYER, autonomy: false, avoid: AVOID, keepOnScreen: this.definition?.keepOnScreen, start: { x: scrollX + 80, y: scrollY + innerHeight - 8 } });
    this.cat = cat;
    this.voice = new TourVoice(this.release, level => cat.setMouth(level));
    this.voice.muted = this.state.muted;
    await Promise.all([cat.init(), this.voice.load()]);
    if (epoch !== this.lifecycle) return null;
    return cat;
  }

  /** Opening is always re-requested (the user may have closed the menu); only a real change waits for the animation. */
  private async setMenu(open: boolean) {
    const changed = this.menuOpen !== open;
    if (!changed && !open) return;
    this.menuOpen = open;
    window.dispatchEvent(new CustomEvent('tutor.site.menu.activate', { detail: { action: open ? 'open_menu' : 'close_menu' } }));
    const panel = document.getElementById('primary-menu');
    if (changed || (open && panel && panel.getBoundingClientRect().height < 20)) await sleep(open ? 320 : 120);
  }

  /** First step: the cat jumps in and asks; `auto` (on page load) counts toward MAX_INVITES. */
  async invite(auto = false) {
    if (this.state.phase !== 'off') return;
    if (auto && activeRunner && activeRunner !== this) return;
    if (activeRunner !== this) activeRunner?.dispose();
    activeRunner = this;
    if (auto) setTourCookie(String((Number(tourCookie(this.definition?.cookie)) || 0) + 1), this.definition?.cookie);
    this.set({ phase: 'invite' });
    const cat = await this.ensureCat();
    if (!cat || (this.state.phase as TourPhase) !== 'invite') return;
    await cat.jumpTo({ x: scrollX + Math.min(innerWidth * 0.42, 520), y: scrollY + innerHeight * 0.72 });
    // Answered or closed during the jump (Escape): no question any more.
    if ((this.state.phase as TourPhase) !== 'invite') return;
    cat.setEmotion('happy', 3); cat.play('wave');
    this.ask();
  }

  async begin() {
    if (activeRunner !== this) activeRunner?.dispose();
    activeRunner = this;
    setTourCookie('done', this.definition?.cookie);
    const epoch = this.lifecycle;
    // Already created by the invitation: unlock inside the user's click.
    this.voice?.unlock();
    if (!await this.ensureCat() || epoch !== this.lifecycle) return;
    this.voice?.unlock();
    this.set({ phase: 'running', paused: false });
    void this.play(0, 1);
  }

  next() { void this.play(this.state.index + 1, 1); }
  back() { void this.play(this.state.index - 1, -1); }
  togglePause() { this.set({ paused: !this.state.paused }); }
  setMuted(muted: boolean) { this.set({ muted }); this.voice?.unlock(); this.voice?.setMuted(muted); }

  private async play(i: number, dir: number): Promise<void> {
    const id = ++this.run, cat = this.cat, voice = this.voice;
    if (!cat || !voice || i < 0) return;
    voice.stop();
    const steps = this.definition?.steps ?? HOME_TOUR;
    if (i >= steps.length) {
      await this.setMenu(false);
      cat.clearHighlight();
      await sleep(400);
      if (id === this.run) this.dispose();
      return;
    }
    const step = steps[i];
    await this.setMenu(!!step.menu);
    if (id !== this.run) return;
    await this.definition?.beforeStep?.(step, this.lang);
    if (id !== this.run) return;
    const targets = step.targets?.() ?? [];
    if (step.targets && !targets.length) return this.play(i + dir, dir);
    this.set({ index: i });
    const text = this.definition?.text(step.key, this.lang) ?? tourText(step.key, this.lang);
    cat.setEmotion(step.emotion ?? 'neutral');
    if (targets.length) {
      cat.setAvoid(step.menu ? undefined : AVOID);
      await reveal(targets);
      if (id !== this.run) return;
      await cat.pointAt(targets, 'spotlight', text, 600000);
    } else {
      cat.clearHighlight();
      await cat.jumpTo({ x: scrollX + Math.min(innerWidth * 0.45, 560), y: scrollY + innerHeight * 0.7 });
      if (id !== this.run) return;
      cat.say(text, 600000);
      if (step.action) cat.play(step.action);
    }
    if (id !== this.run) return;
    await voice.speak(step.key, this.lang, text);
    while (this.state.paused && id === this.run) await sleep(150);
    await sleep(650);
    if (id === this.run) return this.play(i + 1, 1);
  }

  /** Close immediately and release the page, audio and highlights. */
  close() { this.dispose(); }

  dispose() {
    if (activeRunner === this) activeRunner = null;
    this.run++;
    this.definition?.cleanup?.();
    this.lifecycle++; this.initializing = null;
    this.voice?.dispose(); this.voice = null;
    this.cat?.dispose(); this.cat = null;
    if (this.menuOpen) { this.menuOpen = false; window.dispatchEvent(new CustomEvent('tutor.site.menu.activate', { detail: { action: 'close_menu' } })); }
    this.set({ phase: 'off', paused: false });
  }
}
