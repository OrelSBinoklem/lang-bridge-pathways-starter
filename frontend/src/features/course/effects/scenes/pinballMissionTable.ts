import type { ScenePointer } from './types';
import { createLedPinball } from './ledPinball';
import { PINBALL_COLORS } from './pinballPhysics';
import { PINBALL_ASPECT, pinballRound } from './pinballArtwork';
import { createPinballMission, PINBALL_MISSION_SCORE, PINBALL_MISSION_SHOTS } from './pinballMission';
import { createPinballBot } from './pinballBot';

const COPY = {
  ru: { title: 'RGB-РЕАКТОР', demo: 'ИГРАЕТ БОТ · КЛИК — ТВОЙ ХОД', bot: 'ДЕМО', goal: 'ЦЕЛЬ: 3 МИШЕНИ + 3000 ОЧКОВ ЗА 5 ПУСКОВ', targets: 'Сбей 3 цветные мишени', win: 'ПОБЕДА!', success: 'Реактор запущен', lost: 'ПОПЫТКИ КОНЧИЛИСЬ', again: 'ЕЩЁ РАУНД', launch: 'ПУСК', hint: 'КЛИК — ПУСК · УДЕРЖИВАЙ СЛЕВА / СПРАВА — ЛОПАТКИ' },
  uk: { title: 'RGB-РЕАКТОР', demo: 'ГРАЄ БОТ · КЛІК — ТВІЙ ХІД', bot: 'ДЕМО', goal: 'МЕТА: 3 МІШЕНІ + 3000 ОЧОК ЗА 5 ПУСКІВ', targets: 'Збий 3 кольорові мішені', win: 'ПЕРЕМОГА!', success: 'Реактор запущено', lost: 'СПРОБИ СКІНЧИЛИСЯ', again: 'ЩЕ РАУНД', launch: 'ПУСК', hint: 'КЛІК — ПУСК · УТРИМУЙ ЗЛІВА / СПРАВА — ЛОПАТКИ' },
};

/** Gameplay overlay for the course. The archived table, its art and its physics remain unchanged. */
export function createMissionPinball(width: number, height: number, onHit: (color: [number, number, number]) => void, locale: 'ru' | 'uk' = 'ru') {
  const table = createLedPinball(width, height, onHit);
  const mission = createPinballMission(table.model);
  const bot = createPinballBot(table.model);
  const copy = COPY[locale];
  const button = { x: .17, y: 1.37, width: .65, height: .15 };
  let clock = 0;
  let attract = true;
  const restart = () => {
    // Reuse the baked board and sprite atlas; the next manual launch resets the existing shot mechanics.
    for (const ball of table.model.balls) { ball.active = false; ball.vx = ball.vy = 0; }
    for (const target of table.model.targets) { target.down = false; target.glow = 0; }
    table.model.spinner.omega = 0;
    table.model.update(0, { launch: false, left: false, right: false });
    table.update(0, { rawX: -1, rawY: -1, active: false, pressed: false, clicked: false } as ScenePointer, false);
    mission.reset();
  };
  return {
    model: table.model, rect: table.rect, mission,
    get attract() { return attract; },
    update(dt: number, pointer: ScenePointer, enabled: boolean) {
      clock += Math.max(0, Math.min(dt, .05));
      const x = (pointer.rawX - table.rect.x) / table.rect.width;
      const y = (pointer.rawY - table.rect.y) / table.rect.width;
      const inside = enabled && pointer.active && x >= 0 && x <= 1 && y >= 0 && y <= PINBALL_ASPECT;
      if (attract) {
        if (inside && pointer.clicked) {
          attract = false;
          restart();
          // The takeover click also launches the user's first ball, with a clean round score.
        } else {
          const control = bot.update(dt);
          const botX = control.left && !control.right ? .2 : control.right && !control.left ? .8 : .5;
          table.update(dt, {
            ...pointer, rawX: table.rect.x + table.rect.width * botX, rawY: table.rect.y + table.rect.width * 1.7,
            active: true, clicked: control.launch, pressed: control.left || control.right,
          }, true);
          return inside;
        }
      }
      if (mission.status === 'won' || mission.status === 'lost') {
        if (inside && pointer.clicked && x >= button.x && x <= button.x + button.width && y >= button.y && y <= button.y + button.height) restart();
        return inside;
      }
      const consumed = table.update(dt, pointer, enabled);
      if (mission.update() === 'won') for (const color of [[1, .1, .38], [.1, .8, 1], [1, .65, .08]] as [number, number, number][]) onHit(color);
      return consumed;
    },
    draw(g: CanvasRenderingContext2D) {
      table.draw(g);
      g.save(); g.translate(table.rect.x, table.rect.y); g.scale(table.rect.width, table.rect.width);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#030610'; pinballRound(g, .075, .035, .83, .2, .022); g.fill();
      g.fillStyle = '#baf7ff'; g.font = '700 .059px monospace';
      g.fillText(attract ? String(table.model.score).padStart(6, '0') : `${String(mission.score).padStart(4, '0')} / ${PINBALL_MISSION_SCORE}`, .49, .102);
      g.fillStyle = '#8ea8bd'; g.font = '600 .028px sans-serif';
      g.fillText(attract ? copy.demo : copy.title, .49, .052);
      for (let i = 0; i < 3; i++) {
        const lit = attract ? table.model.targets[i].down : !!(mission.colors & (1 << i));
        g.fillStyle = lit ? PINBALL_COLORS[i] : '#27394c';
        pinballRound(g, .12 + i * .095, .168, .075, .043, .007); g.fill();
        g.fillStyle = lit ? '#05101a' : '#8296ac'; g.font = '700 .031px monospace';
        g.fillText(['R', 'G', 'B'][i], .157 + i * .095, .191);
      }
      g.fillStyle = '#c2e4e9'; g.font = '600 .029px monospace';
      g.fillText(attract ? copy.bot : `${copy.launch} ${mission.shots}/${PINBALL_MISSION_SHOTS}`, .69, .191);
      g.fillStyle = '#091021'; pinballRound(g, .055, 2.025, .88, .075, .012); g.fill();
      g.fillStyle = '#a1bdcf'; g.font = '600 .025px sans-serif'; g.fillText(attract ? copy.goal : copy.hint, .49, 2.06);
      const terminal = mission.status === 'won' || mission.status === 'lost';
      if (terminal) {
        const won = mission.status === 'won';
        g.fillStyle = 'rgba(3,8,20,.94)'; pinballRound(g, .07, .78, .85, .79, .035); g.fill();
        g.strokeStyle = won ? '#7fffd8' : '#6c96b4'; g.lineWidth = .005; g.stroke();
        g.fillStyle = won ? '#90ffdb' : '#e7f4ff';
        g.font = `800 ${mission.status === 'lost' ? '.047' : '.072'}px sans-serif`;
        g.fillText(won ? copy.win : copy.lost, .495, .9);
        g.font = '600 .048px sans-serif'; g.fillStyle = '#d3e3f0';
        g.fillText(won ? copy.success : copy.targets, .495, 1.025);
        g.fillText(`${mission.score} / ${PINBALL_MISSION_SCORE}`, .495, 1.115);
        g.font = '500 .042px sans-serif'; g.fillStyle = '#a1bdcf';
        g.fillText(`RGB ${[0, 1, 2].filter(i => mission.colors & (1 << i)).length}/3`, .495, 1.215);
        g.fillStyle = won ? '#95ffda' : '#c4e9ff'; pinballRound(g, button.x, button.y, button.width, button.height, .025); g.fill();
        g.fillStyle = '#061426'; g.font = '800 .055px sans-serif';
        g.fillText(copy.again, .495, button.y + button.height / 2);
        if (won) {
          g.lineWidth = .006;
          for (let i = 0; i < 3; i++) {
            g.strokeStyle = PINBALL_COLORS[i]; g.beginPath();
            g.arc(.495, 1.17, .43 + i * .025, clock * .5 + i * 2.1, clock * .5 + i * 2.1 + .7); g.stroke();
          }
        }
      }
      g.restore();
    },
  };
}
