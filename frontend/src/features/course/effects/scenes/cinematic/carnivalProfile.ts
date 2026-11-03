import type { World } from './world';

/** Opt-in local A/B measurements, never enabled in a production bundle.
 * scenes-preview?scene=cloud-carnival&body=1&p=carnivalProbe:1
 * 1 previous batching, 2 no shadows, 3 no bloom, 4 no canvas transfer, 5 no MSAA, 6 linked instances.
 */
export function profileCarnival(world: World, mode: number) {
  if (process.env.NODE_ENV !== 'development' || ![1, 2, 3, 4, 5, 6].includes(mode)) return;
  if (mode === 2) world.renderer.shadowMap.enabled = false;
  if (mode === 3) world.bloom.enabled = false;
  if (mode === 5) {
    world.composer.renderTarget1.samples = 0; world.composer.renderTarget2.samples = 0;
  }
  const totals = { update: 0, main: 0, bloom: 0, output: 0, transfer: 0, draw: 0, calls: 0, triangles: 0 };
  let frame = 0, samples = 0, started = 0;
  world.renderer.info.autoReset = false;
  const update = world.update.bind(world);
  let updateMs = 0;
  world.update = (dt, time, pointer) => {
    const begin = performance.now(); update(dt, time, pointer); updateMs = performance.now() - begin;
  };
  const passTimes = [0, 0, 0];
  world.composer.passes.forEach((pass, index) => {
    const render = pass.render.bind(pass);
    pass.render = (...args) => {
      const begin = performance.now(); render(...args); passTimes[index] = performance.now() - begin;
    };
  });
  const draw = world.draw.bind(world);
  world.draw = context => {
    const begin = performance.now(), transfer = context.drawImage;
    let transferMs = 0;
    world.renderer.info.reset();
    context.drawImage = ((...args: unknown[]) => {
      if (mode === 4) return;
      const start = performance.now(); Reflect.apply(transfer, context, args); transferMs += performance.now() - start;
    }) as typeof transfer;
    try { draw(context); } finally { context.drawImage = transfer; }
    frame++;
    if (frame < 61) return; // Shader/pipeline compilation is not steady-state frame cost.
    if (!started) started = performance.now();
    samples++;
    totals.update += updateMs; totals.draw += performance.now() - begin;
    totals.main += passTimes[0]; totals.bloom += passTimes[1]; totals.output += passTimes[2]; totals.transfer += transferMs;
    totals.calls += world.renderer.info.render.calls; totals.triangles += world.renderer.info.render.triangles;
    if (samples === 120) {
      context.canvas.dataset.carnivalProfile = JSON.stringify({
        mode, samples, fps: samples * 1000 / (performance.now() - started),
        ...Object.fromEntries(Object.entries(totals).map(([key, value]) => [key, value / samples])),
        resolution: [world.renderer.domElement.width, world.renderer.domElement.height],
      });
      for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] = 0;
      samples = 0; started = performance.now();
    }
  };
}
