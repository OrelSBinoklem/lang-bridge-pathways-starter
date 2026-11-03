import type { CanvasSceneDef } from '../types';
import { CINEMATIC_CATALOG, CINEMATIC_ALTERNATIVES, CINEMATIC_ARCHIVES, CINEMATIC_TRAVEL, type CinematicId } from './catalog';
import { World } from './world';
import { helloPost, transitCity, shoppingPassage } from './storiesTravel';
import { cloudCarnival } from './carnivalDetailed';
import { carnivalPartyV1 } from './carnivalPartyV1';
import { optimizeCarnival, instanceCarnival } from './carnivalOptimizations';
import { profileCarnival } from './carnivalProfile';
import { familyHouse, personalityTheatre, islandVillage } from './storiesHome';
import { kineticPlanner, secondSpring } from './storiesTime';
import { orbitalAcademy, dragonWorkshop } from './storiesMachines';
import { jazzCourtyard, rainyDistrict } from './storiesNight';
import { prismPersonas } from './worldsB';
import { certificateBureau, pizzaExpress } from './storiesDelivery';
import { faceAtelier, politeMask } from './storiesPersona';
import { timeSwitchyard } from './storiesTimeRouter';
import { transitMachine } from './storiesTransitMachine';
import { familySupper, secondChance } from './storiesGathering';
import { neonMarket } from './storiesNeon';
import { platskartJourney } from './storiesPlatskart';
import { CARNIVAL_VIDEO } from '../carnivalVideo';

const BUILDERS: Record<CinematicId, (world: World) => void> = {
  'platskart-journey': platskartJourney,
  'neon-market': neonMarket,
  'certificate-bureau': certificateBureau,
  'pizza-express': pizzaExpress,
  'transit-machine': transitMachine,
  'family-supper': familySupper,
  'second-chance': secondChance,
  'face-atelier': faceAtelier,
  'polite-mask': politeMask,
  'time-switchyard': timeSwitchyard,
  'hello-orbit': helloPost,
  'transit-globe': transitCity,
  'midnight-arcade': shoppingPassage,
  'cloud-carnival': carnivalPartyV1,
  'cloud-carnival-original': cloudCarnival,
  'cloud-carnival-party-v1': carnivalPartyV1,
  'memory-mobile': familyHouse,
  'prism-personas': personalityTheatre,
  'prism-personas-faceted': prismPersonas,
  'sky-islands': islandVillage,
  'astral-planner': kineticPlanner,
  'knowledge-launch': orbitalAcademy,
  'time-reborn': secondSpring,
  'light-circle': jazzCourtyard,
  'rain-metropolis': rainyDistrict,
  'stellar-foundry': dragonWorkshop,
};

/** Procedural geometry only; no downloaded models, archive assets, or image licences. */
export const CINEMATIC_SCENES: CanvasSceneDef[] = [...CINEMATIC_CATALOG, ...CINEMATIC_ALTERNATIVES, ...CINEMATIC_ARCHIVES, ...CINEMATIC_TRAVEL].map(meta => ({
  kind: 'canvas', id: meta.id, label: meta.ru,
  palettes: [[meta.color, '#050914']],
  defaultParams: { speed: 1, intensity: 1, react: 0.7, quality: 1, zoom: 1, cinemaCamera: 0.45, cinemaEvents: 1, cinemaBloom: 0.45 },
  warmupFrames: 1,
  pixelRatioCap: 2,
  create(c) {
    if (meta.id === 'cloud-carnival') return CARNIVAL_VIDEO.create(c);
    let world: World | undefined;
    try {
      world = new World(c, c.palette[0], c.palette[1]);
      BUILDERS[meta.id](world);
      if (meta.id === 'cloud-carnival-party-v1') {
        optimizeCarnival(world.root);
        const probe = process.env.NODE_ENV === 'development' ? Number((c.params as typeof c.params & { carnivalProbe?: number }).carnivalProbe) : 0;
        if (![1, 2, 3, 4, 5].includes(probe)) instanceCarnival(world.root, world.ticks);
        profileCarnival(world, probe);
      }
      return world;
    } catch (error) {
      world?.dispose();
      console.error(`[course-scene:${meta.id}] 3D scene initialization failed`, error);
      // Keep the course usable, but never silently disguise a failed renderer as a working effect.
      return {
        update() {},
        draw(g) {
          g.fillStyle = '#080d19'; g.fillRect(0, 0, c.width, c.height);
          g.fillStyle = '#edc7a0'; g.font = '14px sans-serif'; g.textAlign = 'center';
          g.fillText('3D-эффект недоступен. Выберите другой вариант.', c.width / 2, c.height - 28, c.width - 24);
        },
      };
    }
  },
}));
