'use client';

import { useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GUI as DatGUI } from 'dat.gui';
import type { EffectTuningState } from './types';
import { EffectDebugContext } from '../EffectDebugContext';
import { isCinematicScene } from '../scenes/cinematic/catalog';
import { LED_MODE_LABELS, LED_STYLE_LABELS, KALEIDOSCOPE_SETTINGS, KALEIDOSCOPE_TABS, FOUNTAIN_SETTINGS, FOUNTAIN_WATER_MODES, GLASS_FOUNTAIN_CHOICES, GLASS_FOUNTAIN_SETTINGS, DRAGON_SMOKE_SETTINGS, DRAGON_BURNER_CHOICES, DRAGON_BURNER_SETTINGS, GEMS_SETTINGS, LED_FIGURE_CHOICES, LED_FIGURE_SETTINGS, FOGGED_GLASS_SETTINGS, FOG_STREET_MODES, SNOW_LANTERN_CHOICES, SNOW_LANTERN_SETTINGS, OPTICS_LASER_LABELS, OPTICS_SET_LABELS } from '../scenes/sceneSettings.generated';
import { LANTERN_KIND_LABELS } from '../LanternWaterEffect';
import { MAX_SUN_WATER_DETAIL } from '../sunWater/params';
import { createGardenGenome, GARDEN_COLUMNS, GARDEN_FEATURES, GARDEN_GENE_LABELS } from '../scenes/genomeGardenGenetics';
import { GENOME_PRESETS } from '../scenes/genomeGardenPresets';
import { cameraDefaultStored, isCameraAdmin, onCameraAdminChange, ORBIT_SCENES, OWN_CAMERA_SCENES, setCameraDefaultOn } from '../scenes/orbitControl';
import { BACKINGS, GEMS, priceLabel } from '../scenes/gemsData';
import { KALEIDOSCOPE_PRESETS, kaleidoscopePresetIndex, presetValues } from '../scenes/kaleidoscopePresets';
import { PIECE_SETS } from '../scenes/kaleidoscopeSets';
import {
  LIQUID_DROPS_DEFAULT_PRESET,
  LIQUID_DROPS_PRESETS,
  LIQUID_DROPS_SCENE_LABELS,
  type LiquidDropsParams,
} from '../liquidDrops/params';
import styles from './effect-tuning-panel.module.css';
import { notifyDropsScene, setDropsImage } from '../liquidDrops/sceneSelection';
import { LifelongSettings } from '../scenes/LifelongSettings';

const HEADER_ANCHOR_ID = 'course-effect-gui-anchor';

/** Lets the visitor put their own picture under the drops; the effect picks the new URL up on its next frame. */
function pickLiquidDropsImage(p: LiquidDropsParams, gui: DatGUI) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.onchange = () => {
    const file = input.files?.[0];
    if (!file) return;
    setDropsImage(p, URL.createObjectURL(file));
    gui.updateDisplay();
  };
  input.click();
}

type GenomeMatrixHandle = { refresh: () => void };

/**
 * A 25 (gene) × 14 (generation) grid of editable byte cells for one tree's DNA — dat.GUI has no
 * spreadsheet control of its own, so this is raw DOM spliced into the folder's own `<ul>` (`__ul`
 * is undocumented but is exactly what `folder.add(...)` appends its own rows to internally).
 * Edits fire on every keystroke/spinner tick — no debounce here — so the tree redraws as fast as
 * `growGardenGenome`'s own throttle (`checkTimer` in genomeGarden.ts) allows.
 */
function buildGenomeMatrix(
  folder: DatGUI,
  getDna: () => Uint8Array,
  onEdit: (feature: number, column: number, value: number) => void,
): GenomeMatrixHandle {
  const wrap = document.createElement('div');
  wrap.className = styles.genomeMatrixWrap;
  const table = document.createElement('table');
  table.className = styles.genomeMatrixTable;

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  headRow.appendChild(document.createElement('th'));
  for (let column = 0; column < GARDEN_COLUMNS; column += 1) {
    const th = document.createElement('th');
    th.textContent = String(column);
    headRow.appendChild(th);
  }
  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  const inputs: HTMLInputElement[][] = [];
  GARDEN_GENE_LABELS.forEach((label, index) => {
    const feature = index + 1;
    const row = document.createElement('tr');
    const labelCell = document.createElement('td');
    labelCell.className = styles.genomeMatrixLabel;
    labelCell.textContent = `${feature}. ${label}`;
    labelCell.title = label;
    row.appendChild(labelCell);
    const rowInputs: HTMLInputElement[] = [];
    for (let column = 0; column < GARDEN_COLUMNS; column += 1) {
      const cell = document.createElement('td');
      const input = document.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.max = '255';
      input.step = '1';
      input.className = styles.genomeMatrixInput;
      input.addEventListener('input', () => {
        const value = Math.round(Number(input.value));
        if (Number.isNaN(value)) return;
        onEdit(feature, column, Math.min(255, Math.max(0, value)));
      });
      cell.appendChild(input);
      row.appendChild(cell);
      rowInputs.push(input);
    }
    inputs.push(rowInputs);
    tbody.appendChild(row);
  });
  table.appendChild(tbody);
  wrap.appendChild(table);

  const li = document.createElement('li');
  li.appendChild(wrap);
  (folder as unknown as { __ul: HTMLElement }).__ul.appendChild(li);

  return {
    refresh: () => {
      const dna = getDna();
      for (let index = 0; index < GARDEN_GENE_LABELS.length; index += 1) {
        const feature = index + 1;
        for (let column = 0; column < GARDEN_COLUMNS; column += 1) {
          inputs[index][column].value = String(dna[column * GARDEN_FEATURES + feature]);
        }
      }
    },
  };
}

/**
 * Builds the dat.GUI controls for one effect instance. Tuple config fields (`sizeRange`,
 * `fallSpeedRange`, ...) aren't directly bindable to a dat.GUI slider (it only binds plain
 * number/boolean/string properties), so those are exposed as a single "× scale" proxy relative
 * to the range this panel was opened with, rather than four separate min/max sliders.
 */
function buildControls(gui: DatGUI, tuning: EffectTuningState, notify: () => void): void {
  switch (tuning.kind) {
    case 'liquid-glass': {
      const p = tuning.params;
      const folder = gui.addFolder('Жидкое стекло');
      folder.add(p, 'count', 2, 9, 1).name('Капли').onChange(notify);
      folder.add(p, 'size', 0.4, 2, 0.05).name('Размер').onChange(notify);
      folder.add(p, 'speed', 0, 2, 0.05).name('Скорость').onChange(notify);
      folder.add(p, 'merge', 0.005, 0.15, 0.005).name('Слияние').onChange(notify);
      folder.add(p, 'refraction', 0, 2, 0.05).name('Преломление').onChange(notify);
      folder.add(p, 'edgeWidth', 2, 40, 1).name('Ширина края (px)').onChange(notify);
      folder.add(p, 'dispersion', 0, 0.6, 0.01).name('Радужный край').onChange(notify);
      folder.add(p, 'renderScale', 1, 2, 0.25).name('Разрешение ×').onChange(notify);
      folder.add(p, 'tint', 0, 1, 0.05).name('Цвет стекла').onChange(notify);
      folder.add(p, 'shine', 0, 2, 0.05).name('Блики').onChange(notify);
      folder.add(p, 'shadow', 0, 1, 0.05).name('Тень').onChange(notify);
      folder.add(p, 'artwork', 0, 1, 0.05).name('Видимость арта').onChange(notify);
      folder.add(p, 'brightness', 0.5, 2, 0.02).name('Яркость фона').onChange(notify);
      folder.add(p, 'follow').name('За курсором').onChange(notify);
      folder.open();
      break;
    }
    case 'liquid-drops': {
      const p = tuning.params;
      // A preset overwrites the drop, cursor and glass settings; the background and quality are left alone.
      const chosen = { preset: LIQUID_DROPS_DEFAULT_PRESET };
      const presets = Object.fromEntries(Object.entries(LIQUID_DROPS_PRESETS).map(([id, preset]) => [preset.label, id]));
      gui.add(chosen, 'preset', presets).name('Пресет').onChange((id: string) => {
        Object.assign(p, LIQUID_DROPS_PRESETS[id].look);
        gui.updateDisplay();
        notify();
      });
      const drops = gui.addFolder('Капли');
      drops.add(p, 'columns', 10, 60, 1).name('Сетка (столбцов)').onChange(notify);
      drops.add(p, 'dropSize', 0.15, 0.5, 0.01).name('Размер капли').onChange(notify);
      drops.add(p, 'merge', 0, 1, 0.005).name('Сила слияния').onChange(notify);
      drops.add(p, 'jitter', 0, 0.35, 0.01).name('Неровность сетки').onChange(notify);
      drops.add(p, 'variation', 0, 1, 0.01).name('Разброс размеров').onChange(notify);
      drops.add(p, 'breathe', 0, 2, 0.05).name('Дыхание').onChange(notify);
      drops.open();
      const cursor = gui.addFolder('Курсор');
      cursor.add(p, 'cursor').name('Капля за курсором').onChange(notify);
      cursor.add(p, 'cursorSize', 0.5, 4, 0.05).name('Размер капли').onChange(notify);
      cursor.add(p, 'pullRadius', 0, 10, 0.1).name('Радиус притяжения').onChange(notify);
      cursor.add(p, 'pullStrength', 0, 3, 0.05).name('Сила притяжения').onChange(notify);
      cursor.add(p, 'jelly', 0, 1.2, 0.01).name('Желейность').onChange(notify);
      cursor.open();
      const glass = gui.addFolder('Стекло');
      glass.add(p, 'thickness', 0.03, 1.5, 0.01).name('Толщина').onChange(notify);
      glass.add(p, 'refraction', 1.05, 3, 0.01).name('Преломление').onChange(notify);
      glass.add(p, 'refDistance', 0, 1.5, 0.01).name('Сдвиг фона у края').onChange(notify);
      glass.add(p, 'lens', 0, 1.5, 0.01).name('Линза (выпуклость)').onChange(notify);
      glass.add(p, 'dispersion', 0, 1, 0.01).name('Дисперсия').onChange(notify);
      glass.add(p, 'fresnel', 0, 1, 0.01).name('Кромка (fresnel)').onChange(notify);
      glass.add(p, 'fresnelRange', 0.01, 0.4, 0.01).name('Ширина кромки').onChange(notify);
      glass.add(p, 'glare', 0, 2, 0.01).name('Блик').onChange(notify);
      glass.add(p, 'glareAngle', 0, 360, 1).name('Угол блика').onChange(notify);
      glass.add(p, 'blur', 0, 1.5, 0.01).name('Размытие').onChange(notify);
      glass.add(p, 'frost', 0, 1, 0.01).name('Матовость').onChange(notify);
      glass.add(p, 'tint', 0, 1, 0.01).name('Оттенок').onChange(notify);
      glass.addColor(p, 'tintColor').name('Цвет оттенка').onChange(notify);
      glass.add(p, 'shadow', 0, 1, 0.01).name('Тень').onChange(notify);
      glass.open();
      const background = gui.addFolder('Фон');
      const scenes = Object.fromEntries(Object.entries(LIQUID_DROPS_SCENE_LABELS).map(([id, label]) => [label, id]));
      background.add(p, 'scene', scenes).name('Сцена').listen().onChange(() => { notifyDropsScene(p); notify(); });
      background.add({ pick: () => pickLiquidDropsImage(p, gui) }, 'pick').name('Своя картинка…');
      background.add(p, 'brightness', 0.3, 1.8, 0.01).name('Яркость').onChange(notify);
      background.add(p, 'saturation', 0, 2, 0.01).name('Насыщенность').onChange(notify);
      background.add(p, 'motion', 0, 3, 0.05).name('Движение фона').onChange(notify);
      background.open();
      const quality = gui.addFolder('Качество');
      quality.add(p, 'pixelRatioCap', 0.75, 2, 0.05).name('Разрешение ×').onChange(notify);
      quality.add(p, 'bgScale', 0.4, 1, 0.05).name('Разрешение фона').onChange(notify);
      break;
    }
    case 'ambient': {
      const p = tuning.params;
      const baseSize: [number, number] = [...p.sizeRange];
      const baseSpeed: [number, number] = [...p.fallSpeedRange];
      const proxy = { count: p.count, opacity: p.opacity ?? 0.85, sizeScale: 1, speedScale: 1, swayAmplitude: p.swayAmplitude ?? 20 };
      const folder = gui.addFolder('Частицы');
      folder.add(proxy, 'count', 5, 150, 1).name('Количество').onChange((v: number) => { p.count = Math.round(v); notify(); });
      folder.add(proxy, 'opacity', 0.1, 1, 0.05).name('Прозрачность').onChange((v: number) => { p.opacity = v; notify(); });
      folder.add(proxy, 'sizeScale', 0.3, 15, 0.1).name('Размер ×').onChange((v: number) => { p.sizeRange = [baseSize[0] * v, baseSize[1] * v]; notify(); });
      folder.add(proxy, 'speedScale', 0.3, 3, 0.05).name('Скорость ×').onChange((v: number) => { p.fallSpeedRange = [baseSpeed[0] * v, baseSpeed[1] * v]; notify(); });
      folder.add(proxy, 'swayAmplitude', 0, 40, 1).name('Раскачка').onChange((v: number) => { p.swayAmplitude = v; notify(); });
      if (p.shape === 'leaf') {
        const veinProxy = { veinCount: p.veinCount ?? 3 };
        folder.add(veinProxy, 'veinCount', 0, 6, 1).name('Прожилки').onChange((v: number) => { p.veinCount = Math.round(v); notify(); });
      }
      folder.open();
      break;
    }
    case 'cursor': {
      const p = tuning.params;
      const baseSize: [number, number] = [...p.sizeRange];
      const baseSpeed: [number, number] = [...p.speedRange];
      const proxy = { count: p.count, lifetime: p.lifetime, sizeScale: 1, speedScale: 1, spawnPerMove: p.spawnPerMove, gravity: p.gravity ?? 0 };
      const folder = gui.addFolder('Частицы курсора');
      folder.add(proxy, 'count', 5, 150, 1).name('Количество').onChange((v: number) => { p.count = Math.round(v); notify(); });
      folder.add(proxy, 'lifetime', 0.1, 2, 0.05).name('Время жизни').onChange((v: number) => { p.lifetime = v; notify(); });
      folder.add(proxy, 'sizeScale', 0.3, 3, 0.05).name('Размер ×').onChange((v: number) => { p.sizeRange = [baseSize[0] * v, baseSize[1] * v]; notify(); });
      folder.add(proxy, 'speedScale', 0.3, 3, 0.05).name('Скорость ×').onChange((v: number) => { p.speedRange = [baseSpeed[0] * v, baseSpeed[1] * v]; notify(); });
      folder.add(proxy, 'spawnPerMove', 1, 6, 1).name('Частиц за ход').onChange((v: number) => { p.spawnPerMove = Math.round(v); notify(); });
      folder.add(proxy, 'gravity', -100, 100, 1).name('Гравитация').onChange((v: number) => { p.gravity = v; notify(); });
      folder.open();
      break;
    }
    case 'storm': {
      const p = tuning.params;
      const rain = gui.addFolder('Дождь');
      rain.add(p, 'rainCount', 50, 800, 10).name('Количество').onChange(notify);
      rain.add(p, 'fallSpeedMin', 50, 400, 5).name('Скорость').onChange(notify);
      rain.add(p, 'fallSpeedRange', 0, 300, 5).name('Разброс скорости').onChange(notify);
      rain.add(p, 'bounceGravity', 20, 600, 10).name('Гравитация отскока').onChange(notify);
      rain.add(p, 'airDrag', 0.1, 2, 0.05).name('Сопротивление воздуха').onChange(notify);
      rain.add(p, 'bounceDrag', 0, 8, 0.1).name('Торможение вбок').onChange(notify);
      rain.add(p, 'stretchMax', 1, 4, 0.1).name('Растяжение').onChange(notify);
      rain.open();
      const lightning = gui.addFolder('Молния');
      lightning.add(p, 'lightningInterval', 1, 10, 0.5).name('Интервал (сек)').onChange(notify);
      lightning.add(p, 'lightningLifetime', 0.3, 3, 0.1).name('Длительность').onChange(notify);
      lightning.add(p, 'lightningDensity', 0.3, 3, 0.1).name('Плотность').onChange(notify);
      lightning.open();
      break;
    }
    case 'circuit': {
      const p = tuning.params;
      const folder = gui.addFolder('Импульсы');
      folder.add(p, 'pulseCount', 2, 30, 1).name('Количество').onChange(notify);
      folder.add(p, 'pulseSpeedMin', 0.05, 2, 0.05).name('Мин. скорость').onChange(notify);
      folder.add(p, 'pulseSpeedMax', 0.05, 2, 0.05).name('Макс. скорость').onChange(notify);
      folder.open();
      break;
    }
    case 'sparkle': {
      const p = tuning.params;
      const folder = gui.addFolder('Искры');
      folder.add(p, 'count', 5, 200, 1).name('Количество').onChange(notify);
      folder.add(p, 'size', 0.5, 10, 0.1).name('Размер').onChange(notify);
      folder.add(p, 'speed', 0.05, 2, 0.05).name('Скорость').onChange(notify);
      folder.open();
      break;
    }
    case 'pulse-rings': {
      const p = tuning.params;
      const folder = gui.addFolder('Кольца');
      folder.add(p, 'speed', 0.05, 1.5, 0.05).name('Скорость').onChange(notify);
      folder.add(p, 'ringCount', 1, 8, 1).name('Количество').onChange(notify);
      folder.add(p, 'radiusScale', 0.3, 2, 0.05).name('Радиус ×').onChange(notify);
      folder.open();
      break;
    }
    case 'orbit-dots': {
      const p = tuning.params;
      const folder = gui.addFolder('Орбиты');
      folder.add(p, 'dotCount', 1, 15, 1).name('Точек').onChange(notify);
      folder.add(p, 'speedScale', 0.1, 4, 0.05).name('Скорость ×').onChange(notify);
      folder.add(p, 'radiusScale', 0.3, 2, 0.05).name('Радиус ×').onChange(notify);
      folder.open();
      break;
    }
    case 'mine': {
      const p = tuning.params;
      const light = gui.addFolder('Фонарь');
      light.add(p, 'lanternIntensity', 0, 250000, 1000).name('Яркость').onChange(notify);
      light.add(p, 'lanternRange', 80, 1200, 10).name('Дальность').onChange(notify);
      light.add(p, 'ambientLight', 0, 1, 0.01).name('Фоновый свет').onChange(notify);
      light.open();
      const applyChainPreset = (values: Partial<typeof p>) => {
        Object.assign(p, values);
        gui.updateDisplay();
        notify();
      };
      const presets = gui.addFolder('Пресеты цепочки');
      presets.add({
        apply: () => applyChainPreset({
          chainFollowSpeed: 26, chainLength: 0.24, chainGravity: 0.4,
          chainDamping: 0.64, chainStiffness: 1, chainSolverIterations: 30,
        }),
      }, 'apply').name('Спокойный');
      presets.add({
        apply: () => applyChainPreset({
          chainFollowSpeed: 23, chainLength: 0.16, chainGravity: 2.2,
          chainDamping: 0.74, chainStiffness: 0.7, chainSolverIterations: 24,
        }),
      }, 'apply').name('Естественный');
      presets.add({
        apply: () => applyChainPreset({
          chainFollowSpeed: 18, chainLength: 0.3, chainGravity: 3.8,
          chainDamping: 0.8, chainStiffness: 0.95, chainSolverIterations: 28,
        }),
      }, 'apply').name('Тяжёлый фонарь');
      presets.add({
        apply: () => applyChainPreset({
          chainFollowSpeed: 10, chainLength: 0.4, chainGravity: 1.25,
          chainDamping: 0.93, chainStiffness: 0.8, chainSolverIterations: 18,
        }),
      }, 'apply').name('Свободный');
      presets.open();
      const chain = gui.addFolder('Цепочка');
      chain.add(p, 'chainFollowSpeed', 4, 32, 1).name('Следование за курсором').onChange(notify);
      chain.add(p, 'chainLength', 0.14, 0.5, 0.01).name('Длина').onChange(notify);
      chain.add(p, 'chainGravity', 0.1, 8, 0.1).name('Скорость падения').onChange(notify);
      chain.add(p, 'chainDamping', 0.5, 0.99, 0.01).name('Инерция').onChange(notify);
      chain.add(p, 'chainStiffness', 0.2, 1, 0.05).name('Жёсткость').onChange(notify);
      chain.add(p, 'chainSolverIterations', 6, 36, 1).name('Качество физики').onChange(notify);
      chain.open();
      const work = gui.addFolder('Шахта');
      work.add(p, 'strikeInterval', 0.4, 5, 0.1).name('Интервал ударов').onChange(notify);
      work.add(p, 'sparkCount', 10, 300, 5).name('Искры').onChange(notify);
      work.add(p, 'debrisCount', 5, 200, 5).name('Осколки').onChange(notify);
      work.add(p, 'dustCount', 0, 150, 5).name('Пыль').onChange(notify);
      work.add(p, 'minerScale', 0.2, 1, 0.01).name('Рост шахтёра').onChange(notify);
      work.open();
      break;
    }
    case 'latvia-cube': {
      const p = tuning.params;
      const frame = gui.addFolder('Куб Латвии');
      frame.add(p, 'cubeScale', 0.55, 1.8, 0.01).name('Масштаб всего').onChange(notify);
      frame.add(p, 'imageZoom', 0.8, 1.42, 0.01).name('Масштаб').onChange(notify);
      frame.add(p, 'parallaxOnly').name('Только параллакс').onChange(notify);
      frame.add(p, 'rotationSpeed', 0, 0.45, 0.01).name('Скорость вращения').onChange(notify);
      frame.add(p, 'frameThickness', 0.02, 0.09, 0.003).name('Толщина рёбер').onChange(notify);
      frame.add(p, 'portalSize', 1.2, 1.5, 0.01).name('Размер окна').onChange(notify);
      frame.add(p, 'positionX', 0.5, 1.8, 0.02).name('Сдвиг вправо').onChange(notify);
      frame.open();

      const portals = [
        ['cat', 'Кошка на шпиле'],
        ['sprats', 'Шпроты'],
        ['amber', 'Янтарь'],
        ['monument', 'Памятник Свободы'],
      ] as const;

      portals.forEach(([id, label]) => {
        const portal = gui.addFolder(label);
        const portalParams = p.portals[id];
        portal.add(portalParams, 'depthScale', 0, 0.5, 0.005).name('Сила объёма').onChange(notify);
        portal.add(portalParams, 'parallaxOpacity', 0, 1, 0.02).name('Глубина сцены').onChange(notify);
        portal.add(portalParams, 'roomBackdropOpacity', 0, 1, 0.02).name('Фон комнаты').onChange(notify);
        portal.add(portalParams, 'artworkBrightness', 0.6, 2, 0.02).name('Яркость').onChange(notify);
      });
      break;
    }
    case 'body-grid': {
      const p = tuning.params;
      const folder = gui.addFolder('Сетка');
      folder.add(p, 'cellSize', 8, 60, 1).name('Размер клетки').onChange(notify);
      folder.add(p, 'decaySeconds', 1, 30, 0.5).name('Угасание (сек)').onChange(notify);
      folder.add(p, 'alphaBase', 0, 0.6, 0.01).name('Мин. яркость').onChange(notify);
      folder.add(p, 'alphaScale', 0, 1, 0.01).name('Макс. яркость').onChange(notify);
      folder.add(p, 'glowBlur', 0, 60, 1).name('Свечение').onChange(notify);
      folder.add(p, 'lineAlpha', 0, 0.6, 0.01).name('Линии сетки').onChange(notify);
      folder.add(p, 'lineWidth', 1, 8, 0.5).name('Толщина линий').onChange(notify);
      folder.open();
      break;
    }
    case 'fluid': {
      const p = tuning.params;
      const folder = gui.addFolder('Жидкость');
      folder.add(p, 'quality', ['auto', 'high', 'low']).name('Качество').onChange(notify);
      folder.add(p, 'colorMode', ['mystic', 'rainbow']).name('Цвета').onChange(notify);
      folder.add(p, 'splatRadius', 0.05, 1, 0.01).name('Радиус всплеска').onChange(notify);
      folder.add(p, 'splatForce', 1000, 15000, 100).name('Сила всплеска').onChange(notify);
      folder.add(p, 'curl', 0, 60, 1).name('Завихрение').onChange(notify);
      folder.add(p, 'velocityDissipation', 0, 4, 0.05).name('Затухание скорости').onChange(notify);
      folder.add(p, 'densityDissipation', 0, 4, 0.05).name('Затухание цвета').onChange(notify);
      folder.add(p, 'shading').name('Рельеф').onChange(notify);
      folder.open();
      const bloom = gui.addFolder('Свечение');
      bloom.add(p, 'bloom').name('Включено').onChange(notify);
      bloom.add(p, 'bloomIntensity', 0.1, 2, 0.05).name('Сила').onChange(notify);
      bloom.add(p, 'bloomThreshold', 0, 1, 0.02).name('Порог').onChange(notify);
      bloom.open();
      const sunrays = gui.addFolder('Sunrays');
      sunrays.add(p, 'sunrays').name('enabled').onChange(notify);
      sunrays.add(p, 'sunraysWeight', 0.3, 2, 0.05).name('weight').onChange(notify);
      sunrays.open();
      break;
    }
    case 'sun-water': {
      const p = tuning.params;
      const water = gui.addFolder('Вода');
      water.add(p, 'detail', 0.5, MAX_SUN_WATER_DETAIL, 0.5).name('Детализация частиц × (30 = очень тяжело)').onChange(notify);
      water.add(p, 'damping', 0, 1, 0.01).name('Затухание (0 = долго)').onChange(notify);
      water.add(p, 'swell', 0, 1, 0.01).name('Качка').onChange(notify);
      water.add(p, 'geysers', 0, 3, 0.1).name('Частота всплесков').onChange(notify);
      water.add(p, 'splashPower', 0, 3, 0.05).name('Сила всплесков').onChange(notify);
      water.add(p, 'spray', 0, 3, 0.1).name('Брызги').onChange(notify);
      water.open();
      const cursor = gui.addFolder('Курсор');
      cursor.add(p, 'cursorTool', { 'Толкает воду': 'push', 'Ёмкость с дыркой': 'vessel' }).name('Что это').onChange(notify);
      cursor.add(p, 'pushWhen', { 'Только с зажатой кнопкой': 'press', 'Всегда': 'always' }).name('Толкать').onChange(notify);
      cursor.add(p, 'pointerPush', 0, 3, 0.1).name('Сила толчка').onChange(notify);
      cursor.add(p, 'vesselSize', 0.6, 1.8, 0.05).name('Размер ёмкости').onChange(notify);
      cursor.add(p, 'vesselHole', 0.5, 2, 0.05).name('Дырка в ёмкости').onChange(notify);
      cursor.add(p, 'vesselLeak', 0.1, 4, 0.05).name('Просачивание (больше = быстрее)').onChange(notify);
      cursor.open();
      const look = gui.addFolder('Вид воды');
      look.add(p, 'ripple', 0, 2, 0.05).name('Рябь').onChange(notify);
      look.add(p, 'foam', 0, 2, 0.05).name('Пена').onChange(notify);
      look.add(p, 'caustics', 0, 2, 0.05).name('Свет в глубине').onChange(notify);
      look.add(p, 'clarity', 0.4, 1, 0.01).name('Плотность воды').onChange(notify);
      look.add(p, 'fieldScale', 0.3, 1, 0.05).name('Разрешение поверхности').onChange(notify);
      look.open();
      const sunny = gui.addFolder('Солнце');
      sunny.add(p, 'glint', 0, 2, 0.05).name('Блик на воде').onChange(notify);
      sunny.add(p, 'shininess', 10, 200, 1).name('Резкость блика').onChange(notify);
      sunny.add(p, 'sparkle', 0, 3, 0.05).name('Искры и блики брызг').onChange(notify);
      sunny.open();
      break;
    }
    case 'embroidery': {
      const p = tuning.params;
      const sewing = gui.addFolder('Шитьё');
      sewing.add(p, 'stitchRate', 2, 40, 1).name('Стежков в секунду').onChange(notify);
      sewing.add(p, 'reach', 1, 6, 0.5).name('Радиус от курсора (узлов)').onChange(notify);
      sewing.add(p, 'words').name('Слова под узорами').onChange(notify);
      sewing.add(p, 'reset').name('Распустить всё');
      sewing.open();
      const thread = gui.addFolder('Нить и ткань');
      thread.add(p, 'thread', 0.6, 1.6, 0.05).name('Толщина нити').onChange(notify);
      thread.add(p, 'twist', 0, 2, 0.05).name('Крутка нити').onChange(notify);
      thread.add(p, 'fuzz', 0, 2, 0.05).name('Ворсинки').onChange(notify);
      thread.add(p, 'cloth', 0.6, 1.4, 0.02).name('Яркость ткани').onChange(notify);
      thread.open();
      break;
    }
    case 'amber-words': {
      const p = tuning.params;
      const amber = gui.addFolder('Янтарь');
      amber.add(p, 'words', 6, 80, 1).name('Слов внутри').onChange(notify);
      amber.add(p, 'depth', 0.4, 1.8, 0.05).name('Глубина цвета').onChange(notify);
      amber.add(p, 'cloud', 0, 2, 0.05).name('Мутность смолы').onChange(notify);
      amber.add(p, 'inclusions', 0, 2, 0.05).name('Пузырьки и включения').onChange(notify);
      amber.add(p, 'glow', 0, 2, 0.05).name('Свечение').onChange(notify);
      amber.add(p, 'sss', 0, 2, 0.05).name('Рассеяние света в смоле').onChange(notify);
      amber.add(p, 'sparkle', 0, 2, 0.05).name('Полировка и блики').onChange(notify);
      amber.add(p, 'quality', 0.35, 1, 0.05).name('Чёткость (нагрузка)').onChange(notify);
      amber.open();
      const lamp = gui.addFolder('Курсор-лампа');
      lamp.add(p, 'lamp', 0.4, 2, 0.05).name('Размер света').onChange(notify);
      lamp.add(p, 'parallax', 0, 2, 0.05).name('Отклик на курсор').onChange(notify);
      lamp.open();
      break;
    }
    case 'song-fire': {
      const p = tuning.params;
      const fire = gui.addFolder('Костёр');
      fire.add(p, 'flame', 0.5, 2, 0.05).name('Размер пламени').onChange(notify);
      fire.add(p, 'sparks', 0, 3, 0.1).name('Искры').onChange(notify);
      fire.add(p, 'wind', 0, 3, 0.1).name('Ветер от курсора').onChange(notify);
      fire.add(p, 'stars', 0, 2, 0.1).name('Звёзды').onChange(notify);
      fire.open();
      const song = gui.addFolder('Строка из искр');
      song.add(p, 'letters', 0.3, 3, 0.1).name('Скорость букв').onChange(notify);
      song.add(p, 'hold', 1, 12, 0.5).name('Держится, с').onChange(notify);
      song.open();
      break;
    }
    case 'scene': {
      const p = tuning.params;
      const scene = gui.addFolder('Сцена');
      scene.add(p, 'speed', 0, 3, tuning.sceneId === 'cloud-carnival' ? .25 : .05).name('Скорость').onChange(notify);
      scene.add(p, 'intensity', 0, 2, 0.05).name('Насыщенность').onChange(notify);
      if (tuning.sceneId !== 'genome-garden') scene.add(p, 'react', 0, 2, 0.05).name('Реакция на курсор').onChange(notify);
      scene.add(p, 'hue', 0, 360, 1).name('Сдвиг цвета, °').onChange(notify);
      if (tuning.sceneId !== 'genome-garden' && tuning.sceneId !== 'cloud-carnival') scene.add(p, 'quality', 0.35, isCinematicScene(tuning.sceneId) ? 1.5 : 1, 0.05).name(isCinematicScene(tuning.sceneId) ? 'Разрешение ×' : 'Чёткость (нагрузка)').onChange(notify);
      if (isCinematicScene(tuning.sceneId) && tuning.sceneId !== 'cloud-carnival') {
        scene.add(p, 'zoom', 0.6, 1.5, 0.05).name('Приближение').onChange(notify);
        scene.add(p, 'cinemaCamera', 0, 1, 0.05).name('Движение камеры').onChange(notify);
        if (tuning.sceneId?.startsWith('cloud-carnival')) scene.add(p, 'cinemaEvents', 0, 1, 1).name('Бегущие огни').onChange(notify);
        scene.add(p, 'cinemaBloom', 0, 1.5, 0.05).name('Свечение').onChange(notify);
      }
      scene.open();
      if (tuning.sceneId === 'face-atelier') {
        const face = gui.addFolder('Конструктор лица');
        face.add(p, 'faceWidth', .8, 1.3, .01).name('Ширина черепа').onChange(notify);
        face.add(p, 'faceJaw', .7, 1.3, .01).name('Челюсть').onChange(notify);
        face.add(p, 'faceNose', .5, 1.8, .01).name('Выступ носа').onChange(notify);
        face.add(p, 'faceEyes', .8, 1.35, .01).name('Расстояние глаз').onChange(notify);
        face.add(p, 'faceMood', -1, 1, .01).name('Эмоция').onChange(notify);
        face.add(p, 'faceSkin', .1, .95, .01).name('Плотность кожи').onChange(notify);
        face.open();
      }
      // A scene with more than one "screen" or physical look exposes them here too, by name — everything
      // else shares this one generic block.
      if (tuning.sceneId === 'led-matrix') {
        const presetOptions = Object.fromEntries(LED_MODE_LABELS.map((label, i) => [label, i]));
        scene.add(p, 'preset', presetOptions).name('Заставка').onChange(notify);
        const styleOptions = Object.fromEntries(LED_STYLE_LABELS.map((label, i) => [label, i]));
        scene.add(p, 'style', styleOptions).name('Вид светодиодов').onChange(notify);
        scene.add(p, 'tilt', 0, 1, 0.05).name('Наклон платы (0 = плоско)').onChange(notify);
        scene.add(p, 'zoom', 0.5, 2.5, 0.05).name('Приближение').onChange(notify);
        scene.add(p, 'ledSize', 0.5, 2, 0.05).name('Крупность светодиодов').onChange(notify);
      }
      if (tuning.sceneId === 'string-lights') {
        const tracing = gui.addFolder('Path tracing');
        tracing.add(p, 'lightsView', { 'Итоговая картинка': 0, 'Только свет': 1 }).name('Показывать').onChange(notify);
        tracing.add(p, 'lightsDenoise').name('Шумодав').onChange(notify);
        tracing.add(p, 'lightsBounces', { '0 — только прямой свет': 0, '1 отскок': 1, '2 отскока': 2 }).name('Отскоки света').onChange(notify);
        tracing.add({ restart: () => { p.lightsRestart += 1; notify(); } }, 'restart').name('Перезапустить накопление');
        const stats = tracing.add(p, 'lightsStats').name('Сэмплов на точку').listen();
        stats.domElement.querySelector('input')?.setAttribute('readonly', 'true');
        tracing.open();
        const amber = gui.addFolder('Янтарь');
        amber.add(p, 'lightsAmber').name('Показывать янтарь').onChange(notify);
        amber.add(p, 'lightsAmberStyle', { 'Кусок с жуком (первый)': 0, 'Экспонат на подставке': 1 }).name('Какой').onChange(notify);
        amber.add(p, 'lightsAmberSpin', 0, 1, 0.01).name('Вращение / покачивание').onChange(notify);
        amber.add(p, 'lightsAmberGlow', 0, 3, 0.05).name('Подсветка подставки').onChange(notify);
        amber.open();
      }
      if (tuning.sceneId === 'nixie-clock') {
        const camera = gui.addFolder('Камера (тяните сцену мышью)');
        camera.add(p, 'nixieYaw', -180, 180, 1).name('Поворот, °').onChange(notify).listen();
        camera.add(p, 'nixiePitch', 2, 80, 1).name('Наклон, °').onChange(notify).listen();
        camera.add(p, 'nixieZoom', 0.3, 4, 0.01).name('Приближение').onChange(notify);
        camera.add(p, 'nixieAutoRotate').name('Облетать сама').onChange(notify);
        camera.open();
        const tracing = gui.addFolder('Трассировка лучей');
        tracing.add(p, 'nixieLive').name('Живая трассировка').onChange(notify);
        tracing.add(p, 'nixieView', { 'Итоговая картинка': 0, 'Только свет': 1 }).name('Показывать').onChange(notify);
        tracing.add(p, 'nixieSpp', { 16: 16, 32: 32, 64: 64, 128: 128, 256: 256, 512: 512, 1024: 1024 }).name('Сэмплов (запекание)').onChange(notify);
        tracing.add(p, 'nixieBounces', { '0 — только прямой свет': 0, '1 отскок': 1, '2 отскока': 2 }).name('Отскоки света').onChange(notify);
        tracing.add(p, 'nixieLightmap', { '256² (быстро)': 256, '512²': 512, '1024² (чётко)': 1024 }).name('Карта освещения').onChange(notify);
        tracing.add(p, 'nixieDenoise').name('Шумодав').onChange(notify);
        tracing.add({ restart: () => { p.nixieRestart += 1; notify(); } }, 'restart').name('Запечь заново');
        const stats = tracing.add(p, 'nixieStats').name('Накоплено').listen();
        stats.domElement.querySelector('input')?.setAttribute('readonly', 'true');
        tracing.open();
        const light = gui.addFolder('Свет и материалы');
        light.add(p, 'nixieGlow', 0, 3, 0.05).name('Свечение ламп').onChange(notify);
        light.add(p, 'nixieRoom', 0, 2, 0.05).name('Свет комнаты').onChange(notify);
        light.add(p, 'nixieGloss', 0, 3, 0.05).name('Блеск лака').onChange(notify);
        light.add(p, 'nixieRough', 0, 1, 0.01).name('Размытие бликов').onChange(notify);
        light.add(p, 'nixieGlass', 0, 3, 0.05).name('Отражения в стекле').onChange(notify);
        light.add(p, 'nixieBloom', 0, 3, 0.05).name('Ореол (bloom)').onChange(notify);
        light.open();
      }
      if (tuning.sceneId === 'kaleidoscope') {
        // The same settings as the scene's own ⚙ panel (listen: changes made there show here).
        const kal = gui.addFolder('Калейдоскоп');
        // Read from the settings themselves (listen), so a preset picked on the scene's ⚙ shows here too.
        const choice = {
          get preset() {
            return kaleidoscopePresetIndex(p, PIECE_SETS[p.kalSet]?.look);
          },
          set preset(value: string | number) {
            if (KALEIDOSCOPE_PRESETS[Number(value)]) Object.assign(p, presetValues(Number(value)), PIECE_SETS[p.kalSet]?.look);
          },
        };
        const presetOptions = Object.fromEntries([...KALEIDOSCOPE_PRESETS.map((preset, i) => [preset.label, i]), ['свой (изменён)', -1]]);
        // dat.GUI hands a select's value over as a string.
        const setChoice = {
          get set() {
            return p.kalSet;
          },
          set set(value: string | number) {
            p.kalSet = Number(value);
          },
        };
        kal.add(setChoice, 'set', Object.fromEntries(PIECE_SETS.map((set, i) => [set.label, i]))).name('Набор стёклышек').onChange(notify).listen();
        kal.add({ show: () => { p.kalShowSet += 1; notify(); } }, 'show').name('🔍 Посмотреть стёклышки набора');
        kal.add(choice, 'preset', presetOptions).name('Пресет').onChange(notify).listen();
        kal.add(p, 'kalRays').name('Трассировка стекла').onChange(notify).listen();
        kal.add(p, 'kalLightCursor').name('Свет за курсором').onChange(notify).listen();
        kal.add(p, 'kalHistogram').name('Гистограмма').onChange(notify).listen();
        // The same tabs as the scene's own ⚙ panel.
        for (const tab of KALEIDOSCOPE_TABS) {
          const folder = kal.addFolder(tab.label);
          for (const st of KALEIDOSCOPE_SETTINGS) if (st.tab === tab.id) folder.add(p, st.key, st.min, st.max, st.step).name(st.label).onChange(notify).listen();
          if (tab.id === 'look') folder.open();
        }
        kal.open();
      }
      if (tuning.sceneId === 'dragon-burner') {
        const db = gui.addFolder('Курильница');
        for (const ch of DRAGON_BURNER_CHOICES) db.add(p, ch.key, Object.fromEntries(ch.options.map((o, i) => [o, i]))).name(ch.label).onChange((v: string | number) => { p[ch.key] = Number(v); notify(); }).listen();
        for (const st of DRAGON_BURNER_SETTINGS) db.add(p, st.key, st.min, st.max, st.step).name(st.label).onChange(notify).listen();
        db.open();
      }
      if (tuning.sceneId === 'dragon-smoke') {
        const ds = gui.addFolder('Дракон и дым');
        for (const st of DRAGON_SMOKE_SETTINGS) ds.add(p, st.key, st.min, st.max, st.step).name(st.label).onChange(notify).listen();
        ds.open();
      }
      if (tuning.sceneId === 'voxel-led-cube') {
        const lf = gui.addFolder('Куб и новогодние фигурки');
        for (const ch of LED_FIGURE_CHOICES) lf.add(p, ch.key, Object.fromEntries(ch.options.map((o, i) => [o, i]))).name(ch.label).onChange((v: string | number) => { p[ch.key] = Number(v); notify(); }).listen();
        for (const st of LED_FIGURE_SETTINGS) lf.add(p, st.key, st.min, st.max, st.step).name(st.label).onChange(notify).listen();
        lf.open();
      }
      if (tuning.sceneId === 'gems') {
        const gm = gui.addFolder('Драгоценные камни');
        // The stones dearest first, with their rough price.
        const stones = Object.fromEntries(GEMS.map((gem, i) => [`${gem.name} — ≈${priceLabel(gem.price)}/кар`, i]));
        gm.add(p, 'gmGem', stones).name('Камень').onChange((v: string | number) => { p.gmGem = Number(v); notify(); }).listen();
        gm.add(p, 'gmBacking', Object.fromEntries(BACKINGS.map((b, i) => [b, i]))).name('Подложка').onChange((v: string | number) => { p.gmBacking = Number(v); notify(); }).listen();
        gm.add(p, 'gmTrace', { 'Без трассировки': 0, 'Трассировка: 64 семпла': 1 }).name('Отрисовка').onChange((v: string | number) => { p.gmTrace = Number(v); notify(); }).listen();
        for (const st of GEMS_SETTINGS) gm.add(p, st.key, st.min, st.max, st.step).name(st.label).onChange(notify).listen();
        gm.open();
      }
      const orbitScene = !!tuning.sceneId && (ORBIT_SCENES as readonly string[]).includes(tuning.sceneId);
      if (orbitScene || (!!tuning.sceneId && (OWN_CAMERA_SCENES as readonly string[]).includes(tuning.sceneId))) {
        // The camera control (orbitControl.ts): the same as the scene's «🎥 Камера» button, for everyone; for admins also
        // on from the start in every 3D scene (this browser) and the «C» key — those rows hidden from others (and the
        // whole folder for a scene with its own camera switch, which then has nothing else here).
        const cam = gui.addFolder('Камера');
        const all = { on: cameraDefaultStored(), key: 'C — вкл/выкл (над сценой)' };
        const adminRows = [
          cam.add(all, 'on').name('Включена по умолчанию (все 3D)').onChange((v: boolean) => { setCameraDefaultOn(v); notify(); }),
          cam.add(all, 'key').name('Горячая клавиша'),
        ];
        const folderLi = cam.domElement.parentElement;
        const showAdmin = () => {
          const on = isCameraAdmin();
          for (const row of adminRows) {
            const li = row.domElement.closest('li');
            if (li) li.style.display = on ? '' : 'none';
          }
          if (!orbitScene && folderLi) folderLi.style.display = on ? '' : 'none';
        };
        showAdmin();
        const stop = onCameraAdminChange(() => {
          if (!cam.domElement.isConnected) stop();
          else showAdmin();
        });
        if (orbitScene) {
          cam.add(p, 'camOn', { 'Закреплена': 0, 'Вращать мышью': 1 }).name('Камера').onChange((v: string | number) => { p.camOn = Number(v); notify(); }).listen();
          cam.add(p, 'camYaw', -180, 180, 1).name('Поворот, °').onChange(notify).listen();
          cam.add(p, 'camPitch', -35, 60, 1).name('Наклон, °').onChange(notify).listen();
          cam.add(p, 'camZoom', 0.4, 4, 0.05).name('Приближение, ×').onChange(notify).listen();
        }
        cam.open();
      }
      if (tuning.sceneId === 'snow-lantern') {
        const nl = gui.addFolder('Новогодний фонарь');
        for (const ch of SNOW_LANTERN_CHOICES) nl.add(p, ch.key, Object.fromEntries(ch.options.map((o, i) => [o, i]))).name(ch.label).onChange((v: string | number) => { p[ch.key] = Number(v); notify(); }).listen();
        for (const st of SNOW_LANTERN_SETTINGS) nl.add(p, st.key, st.min, st.max, st.step).name(st.label).onChange(notify).listen();
        nl.open();
      }
      if (tuning.sceneId === 'fogged-glass') {
        const fg = gui.addFolder('Запотевшее стекло');
        fg.add(p, 'fgStreet', Object.fromEntries(FOG_STREET_MODES.map((m, i) => [m, i]))).name('Улица: живая / запечённая / видео').onChange((v: string | number) => { p.fgStreet = Number(v); notify(); }).listen();
        for (const st of FOGGED_GLASS_SETTINGS) fg.add(p, st.key, st.min, st.max, st.step).name(st.label).onChange(notify).listen();
        fg.open();
      }
      if (tuning.sceneId === 'glass-fountain') {
        const gf = gui.addFolder('Неоновый фонтанчик');
        for (const ch of GLASS_FOUNTAIN_CHOICES) gf.add(p, ch.key, Object.fromEntries(ch.options.map((o, i) => [o, i]))).name(ch.label).onChange((v: string | number) => { p[ch.key] = Number(v); notify(); }).listen();
        for (const st of GLASS_FOUNTAIN_SETTINGS) gf.add(p, st.key, st.min, st.max, st.step).name(st.label).onChange(notify).listen();
        gf.open();
      }
      if (tuning.sceneId === 'fountain' || tuning.sceneId === 'fountain-yard') {
        const fnt = gui.addFolder('Фонтан');
        fnt.add(p, 'fntWater', Object.fromEntries(FOUNTAIN_WATER_MODES.map((m, i) => [m, i]))).name('Падающая вода').onChange((v: string | number) => { p.fntWater = Number(v); notify(); }).listen();
        for (const st of FOUNTAIN_SETTINGS) fnt.add(p, st.key, st.min, st.max, st.step).name(st.label).onChange(notify).listen();
        fnt.open();
      }
      if (tuning.sceneId === 'optics-lab') {
        const options = (labels: string[]) => Object.fromEntries(labels.map((label, i) => [label, i]));
        const optics = gui.addFolder('Оптика');
        optics.add(p, 'opticsMode', { 'Лучи (трассировка)': 0, 'Волны (симуляция)': 1 }).name('Режим').onChange(notify);
        optics.add(p, 'opticsSet', options(OPTICS_SET_LABELS)).name('Набор предметов').onChange(notify);
        optics.add(p, 'opticsLaser', options(OPTICS_LASER_LABELS)).name('Лазер курсора').onChange(notify);
        optics.add(p, 'opticsAutoRotate').name('Крутить предметы (R)').onChange(notify).listen();
        optics.add(p, 'opticsSpin', 0, 2, 0.01).name('Скорость вращения').onChange(notify);
        optics.add(p, 'opticsDispersion', 0, 12, 0.1).name('Дисперсия (× стекло)').onChange(notify);
        optics.add({ restart: () => { p.opticsRestart += 1; notify(); } }, 'restart').name('Включить лазеры заново');
        optics.open();
        const rays = gui.addFolder('Лучи');
        rays.add(p, 'opticsBeamSpeed', 0.1, 4, 0.05).name('Скорость фронта света').onChange(notify);
        rays.add(p, 'opticsPulses', 0, 2, 0.05).name('Бегущие фотоны').onChange(notify);
        rays.add(p, 'opticsGlow', 0, 3, 0.05).name('Свечение').onChange(notify);
        rays.open();
        const waves = gui.addFolder('Волны');
        waves.add(p, 'opticsWaveView', { 'Гребни волн': 0, 'Энергия (лучи)': 1, 'Гребни + энергия': 2 }).name('Показывать').onChange(notify);
        waves.add(p, 'opticsWaveSpeed', 0.125, 3, 0.125).name('Скорость (шагов × 8)').onChange(notify);
        waves.add(p, 'opticsWaveCell', { '1 px (тяжело)': 1, '1.5 px': 1.5, '2 px': 2, '3 px': 3, '4 px (легко)': 4 }).name('Размер клетки').onChange(notify);
        waves.open();
        const stats = gui.add(p, 'opticsStats').name('Нагрузка').listen();
        stats.domElement.querySelector('input')?.setAttribute('readonly', 'true');
      }
      if (tuning.sceneId === 'genome-garden') {
        const selected = { tree: 0 };
        // Hoisted: `matrix` (built further down, once the folder for it exists) only needs to be
        // ready by the time `changed` actually runs, which is always later, in response to a
        // control the visitor touches — never during this setup pass itself.
        function changed() { notify(); matrix.refresh(); }
        const reroll = (tree: number) => {
          if (tree === 0) p.gardenSeedLeft = Math.random(); else p.gardenSeedRight = Math.random();
          p.gardenGeneOverrides[tree] = {};
          p.gardenGenomeRevision += 1;
          changed();
        };
        const generation = gui.addFolder('Генерация двух деревьев');
        generation.add(p, 'gardenGenerationMode', {
          'Новая природная DNA': 1, 'Полный рандом как в архиве': 0, 'Скрещивание архивных DNA': 2,
        }).name('Алгоритм').onChange(changed);
          const forms = { 'Случайная (разная у двух)': 0, 'Цветущее': 1, 'Плакучее': 2, 'Веерное': 3, 'Извилистое': 4, 'Спиральное': 5, 'Канделябр': 6, 'Грибовидное': 7, 'Пальма': 8, 'Хрустальное': 9, 'Огненное': 10, 'Мандала': 11 };
        generation.add(p, 'gardenSpeciesLeft', forms).name('Левое дерево').onChange(changed);
        generation.add(p, 'gardenSpeciesRight', forms).name('Правое дерево').onChange(changed);
        generation.add(p, 'gardenSeedLeft', 0, 1, 0.0001).name('Семя левого').onChange(changed);
        generation.add(p, 'gardenSeedRight', 0, 1, 0.0001).name('Семя правого').onChange(changed);
        generation.add({ reroll: () => reroll(0) }, 'reroll').name('Новое левое');
        generation.add({ reroll: () => reroll(1) }, 'reroll').name('Новое правое');
        generation.add({ reroll: () => { reroll(0); reroll(1); } }, 'reroll').name('Новая пара');
        generation.open();

        const shape = gui.addFolder('Форма новой DNA');
        shape.add(p, 'gardenVariation', 0, 2, 0.02).name('Генетическая дикость').onChange(changed);
        shape.add(p, 'gardenBranching', 0, 1.5, 0.02).name('Ветвление').onChange(changed);
        shape.add(p, 'gardenSpread', 0.2, 1.8, 0.02).name('Разлёт ветвей').onChange(changed);
        shape.add(p, 'gardenBend', 0, 1.8, 0.02).name('Изгиб побегов').onChange(changed);
        shape.add(p, 'gardenGravity', -1, 1.5, 0.02).name('Вверх / вниз').onChange(changed);
        shape.add(p, 'gardenCrown', 0.2, 2, 0.02).name('Густота кроны').onChange(changed);
        shape.add(p, 'gardenBloom', 0, 1.5, 0.02).name('Цветение').onChange(changed);
          shape.add(p, 'gardenLeafLength', 0.35, 2, 0.02).name('Длина концов').onChange(changed);
          shape.add(p, 'gardenColorfulness', 0, 2, 0.02).name('Яркость красок').onChange(changed);
          shape.add(p, 'gardenOddity', 0, 1, 0.02).name('Причудливость').onChange(changed);

        const parents = gui.addFolder('Родители из архива');
        const parentOptions = Object.fromEntries(
          GENOME_PRESETS.map((preset, index) => [`${preset.label} · DNA ${preset.id}`, index]),
        );
        parents.add(p, 'gardenGenomeA', parentOptions).name('Родитель A').onChange(changed);
        parents.add(p, 'gardenGenomeB', parentOptions).name('Родитель B').onChange(changed);
        parents.add(p, 'gardenCrossMode', { 'Без скрещивания': 0, 'По поколениям': 1, 'По признакам': 2, 'По отдельным генам': 3 }).name('Скрещивание').onChange(changed);
        parents.add(p, 'gardenMutations', 0, 250, 1).name('Мутаций').onChange(changed);

        const layout = gui.addFolder('Размещение на фоне');
        layout.add(p, 'gardenScale', 0.4, 1.7, 0.02).name('Масштаб').onChange(notify);
        layout.add(p, 'gardenGap', 0.4, 1.6, 0.02).name('Расстояние от центра').onChange(notify);
        layout.add(p, 'gardenRootY', 0.65, 0.87, 0.01).name('Высота горшков').onChange(notify);

        const genes = gui.addFolder('Матрица генома · 25 × 14 × 2');
        genes.add(selected, 'tree', { 'Левое дерево': 0, 'Правое дерево': 1 }).name('Дерево').onChange(() => matrix.refresh());
        const matrix = buildGenomeMatrix(genes, () => createGardenGenome(p, selected.tree), (feature, column, value) => {
          p.gardenGeneOverrides[selected.tree][column * GARDEN_FEATURES + feature] = value;
          p.gardenGenomeRevision += 1;
          notify();
        });
        genes.add({ reset: () => { p.gardenGeneOverrides[selected.tree] = {}; p.gardenGenomeRevision += 1; changed(); } }, 'reset').name('Сбросить правки дерева');
        genes.open();
        matrix.refresh();
      }
      break;
    }
    case 'lantern-water': {
      const p = tuning.params;
      const lanterns = gui.addFolder('Фонари');
      const kinds = Object.fromEntries(Object.entries(LANTERN_KIND_LABELS).map(([id, label]) => [label, id]));
      lanterns.add(p, 'lanternType', kinds).name('Вид').onChange(notify);
      lanterns.add(p, 'count', 0, 16, 1).name('Количество').onChange(notify);
      lanterns.add(p, 'size', 0.4, 2.2, 0.05).name('Размер').onChange(notify);
      lanterns.add(p, 'speed', 0, 3, 0.05).name('Скорость').onChange(notify);
      lanterns.add(p, 'glow', 0.3, 1.6, 0.05).name('Свечение').onChange(notify);
      lanterns.add(p, 'flicker', 0, 3, 0.05).name('Мерцание свечей').onChange(notify);
      lanterns.open();
      const water = gui.addFolder('Вода');
      water.add(p, 'waves', 0, 8, 0.1).name('Волны').onChange(notify);
      water.add(p, 'rings').name('Круги от фонарей').onChange(notify);
      water.add(p, 'ringDistortion', 0, 6, 0.05).name('Рябь от кругов').onChange(notify);
      water.add(p, 'ringSpeed', 0.2, 4, 0.05).name('Скорость кругов').onChange(notify);
      water.add(p, 'ringReach', 0.5, 5, 0.1).name('Дальность кругов').onChange(notify);
      water.add(p, 'ringHeight', 0, 4, 0.05).name('Высота волны').onChange(notify);
      water.add(p, 'reflections').name('Отражения').onChange(notify);
      water.add(p, 'reflectionStrength', 0, 1, 0.05).name('Сила отражений').onChange(notify);
      water.open();
      const decor = gui.addFolder('Декор');
      decor.add(p, 'sakura').name('Ветка сакуры').onChange(notify);
      decor.add(p, 'sakuraBloom').name('Живые цветки').onChange(notify);
      decor.add(p, 'petals', 0, 80, 1).name('Лепестки').onChange(notify);
      decor.add(p, 'torii').name('Тории').onChange(notify);
      decor.add(p, 'fireflies', 0, 80, 1).name('Светлячки').onChange(notify);
      decor.open();
      break;
    }
    case 'sakura': {
      const p = tuning.params;
      const tree = gui.addFolder('Дерево');
      tree.add(p, 'treeScale', 0.4, 1.8, 0.01).name('Размер дерева').onChange(notify);
      tree.add(p, 'blossomSize', 0.3, 2, 0.05).name('Цветы').onChange(notify);
      tree.add(p, 'windStrength', 0, 1, 0.01).name('Сила ветра').onChange(notify);
      tree.add(p, 'gustSpeed', 0.1, 3, 0.05).name('Порывы').onChange(notify);
      if (tuning.fullPage) tree.add(p, 'blossomDensity', 0.3, 2, 0.05).name('Густота кроны').onChange(notify);
      tree.open();
      const petals = gui.addFolder('Лепестки');
      petals.add(p, 'petalCount', 0, tuning.fullPage ? 400 : 200, 1).name('Количество').onChange(notify);
      petals.add(p, 'petalDrift', 0, 200, 1).name('Снос влево').onChange(notify);
      petals.add(p, 'petalFall', 0, 150, 1).name('Падение').onChange(notify);
      petals.add(p, 'petalSize', 2, 20, 0.5).name('Размер').onChange(notify);
      petals.open();
      if (tuning.fullPage) {
        const daylight = gui.addFolder('Время суток');
        daylight.add(p, 'timeMode', {
          'По времени пользователя': 'auto', 'Рассвет': 'dawn', 'День': 'day',
          'Закат': 'dusk', 'Ночь': 'night', 'Ускоренный цикл': 'cycle',
        }).name('Режим').onChange(notify);
        daylight.add(p, 'cycleSeconds', 20, 240, 1).name('Цикл, сек').onChange(notify);
        daylight.open();
      }
      break;
    }
  }
}

/**
 * Live-tuning controls (same dat.GUI look as the home page's water-logo controls) for whichever
 * group effect is currently active — appears the moment a group is clicked/themed, no separate
 * toggle needed, and disappears when the group is deselected (this component unmounts along with
 * `ThemedGroupOverlay`). A fun, visitor-facing feature, not an admin tool: values live only in
 * `tuning.params` for this browser tab and reset to defaults on reload.
 *
 * `floating`: always float over the parent's top right corner, never dock into the page's header anchor — for a
 * full-window overlay, which covers the header (and in browser fullscreen shows nothing outside itself).
 */
export function EffectTuningPanel({ tuning, onChange, floating = false }: { tuning: EffectTuningState; onChange: () => void; floating?: boolean }) {
  const allowed = useContext(EffectDebugContext);
  if (tuning.kind === 'scene' && tuning.sceneId === 'late-stories') return <LifelongSettings params={tuning.params} onChange={onChange} />;
  return allowed === false ? null : <TuningPanel tuning={tuning} onChange={onChange} floating={floating} />;
}

function TuningPanel({ tuning, onChange, floating }: { tuning: EffectTuningState; onChange: () => void; floating: boolean }) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  // The anchor is a fixed DOM node CoursePath always renders; pages without it (unexpected reuse
  // outside CoursePath/effects-preview) fall back to floating the panel over the card itself.
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // One-time DOM lookup right after this component mounts (i.e. the moment its group becomes
    // active) — the anchor element already exists by then since CoursePath renders it unconditionally.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!floating) setAnchor(document.getElementById(HEADER_ANCHOR_ID));
  }, [floating]);

  useEffect(() => {
    let cancelled = false;
    let gui: DatGUI | null = null;
    (async () => {
      const { GUI } = await import('dat.gui');
      if (cancelled || !hostRef.current) return;
      gui = new GUI({ autoPlace: false, width: tuning.kind === 'scene' && (tuning.sceneId === 'genome-garden' || tuning.sceneId === 'nixie-clock' || tuning.sceneId === 'kaleidoscope' || tuning.sceneId === 'fountain' || tuning.sceneId === 'glass-fountain' || tuning.sceneId === 'dragon-smoke' || tuning.sceneId === 'dragon-burner' || tuning.sceneId === 'gems' || tuning.sceneId === 'fogged-glass' || tuning.sceneId === 'snow-lantern') ? 340 : 230 });
      hostRef.current.replaceChildren(gui.domElement);
      buildControls(gui, tuning, onChange);
    })();
    return () => {
      cancelled = true;
      gui?.destroy();
    };
    // Re-runs once when `anchor` resolves (null -> element): the floating vs. docked branches
    // below render two different DOM nodes, so the host this effect mounts dat.gui into changes
    // too — rebuilding here keeps the controls attached to whichever node is now on-screen.
    // `tuning`/`onChange` are stable for this component's whole lifetime (see createTuningState).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anchor]);

  return anchor
    ? createPortal(<div ref={hostRef} data-effect-tuning-panel="" className={styles.panelDocked} />, anchor)
    : <div ref={hostRef} data-effect-tuning-panel="" className={styles.panelFloating} />;
}
