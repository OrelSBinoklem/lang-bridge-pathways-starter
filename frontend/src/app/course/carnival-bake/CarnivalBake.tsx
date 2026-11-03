'use client';
import { useRef, useState } from 'react';
import { World, T } from '@/features/course/effects/scenes/cinematic/world';
import { carnivalVideoBackdrop } from '@/features/course/effects/scenes/cinematic/carnivalPartyV1';
import { setCarnivalLoop } from '@/features/course/effects/scenes/cinematic/carnivalLoop';
import { optimizeCarnival } from '@/features/course/effects/scenes/cinematic/carnivalOptimizations';
import { createSceneParams, type ScenePointer } from '@/features/course/effects/scenes/types';
import { makeRandom } from '@/features/course/effects/scenes/pointer';

const WIDTH = 900, HEIGHT = 1300, FPS = 60, SECONDS = 60;
export function CarnivalBake() {
  const canvas = useRef<HTMLCanvasElement>(null), stop = useRef(false);
  const [status, setStatus] = useState('Готов к запеканию'), [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true); stop.current = false;
    try {
      for (const side of ['left', 'right'] as const) {
        const g = canvas.current!.getContext('2d')!;
        const c = { width: WIDTH, height: HEIGHT, dpr: 1, palette: ['#ffca79', '#0b1529'], body: true,
          params: createSceneParams({ quality: 1, react: 0, cinemaCamera: 0, cinemaBloom: .45 }), rand: makeRandom(1771) };
        const w = new World(c, '#ffca79', '#0b1529');
        let encoder: VideoEncoder | undefined;
        try {
          w.mobile = false; w.renderer.shadowMap.enabled = true;
          w.scene.traverse(object => { if (object instanceof T.DirectionalLight && object.shadow) object.castShadow = true; });
          setCarnivalLoop(w, SECONDS);
          const sides = carnivalVideoBackdrop(w);
          // Black is neutral under the live screen blend. Baking the blue sky
          // produced visible rectangles around each independent side video.
          w.scene.background = new T.Color('#000000');
          for (const child of [...w.root.children]) if (child instanceof T.Mesh && child.material instanceof T.ShaderMaterial) child.removeFromParent();
          sides[side === 'left' ? 'right' : 'left'].visible = false;
          const selected = sides[side]; selected.scale.setScalar(1);
          w.eye.set(0, .3, 15.5); w.target.set(0, -.3, 0);
          // Offline camera recenters a side after World.update; linked instance matrices
          // would still contain its ordinary page-layout transform. Static batches are safe.
          optimizeCarnival(w.root);
          const chunks: Uint8Array<ArrayBuffer>[] = [];
          let failure: Error | null = null;
          encoder = new VideoEncoder({ output: chunk => { const bytes = new Uint8Array(chunk.byteLength); chunk.copyTo(bytes); chunks.push(bytes); }, error: error => { failure = error; } });
          const config: VideoEncoderConfig = { codec: 'avc1.640028', width: WIDTH, height: HEIGHT, framerate: FPS, bitrate: 12_000_000, avc: { format: 'annexb' }, latencyMode: 'realtime' };
          if (!(await VideoEncoder.isConfigSupported(config)).supported) throw new Error('H.264 WebCodecs encoder недоступен');
          encoder.configure(config);
          const pointer: ScenePointer = { x: 0, y: 0, rawX: 0, rawY: 0, vx: 0, vy: 0, active: false, clicked: false, pressed: false };
          for (let frame = 0; frame < FPS * SECONDS; frame++) {
            if (stop.current) throw new Error('Остановлено пользователем');
            if (failure) throw failure;
            w.update(1 / FPS, frame / FPS, pointer); selected.position.set(0, -.2, 0);
            w.scene.updateMatrixWorld(true); w.draw(g);
            const image = new VideoFrame(canvas.current!, { timestamp: Math.round(frame * 1_000_000 / FPS), duration: Math.round(1_000_000 / FPS) });
            encoder.encode(image, { keyFrame: frame % (FPS * 2) === 0 }); image.close();
            if (encoder.encodeQueueSize > 8) await encoder.flush();
            if (frame % 12 === 0) { setStatus(`${side}: ${frame}/${FPS * SECONDS}`); await new Promise(resolve => setTimeout(resolve, 0)); }
          }
          await encoder.flush();
          const result = await fetch(`/api/dev/carnival-bake?side=${side}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: new Blob(chunks) });
          if (!result.ok) throw new Error(`Сохранение: ${result.status} ${await result.text()}`);
          setStatus(`${side}: ${await result.text()}`);
        } finally { if (encoder?.state !== 'closed') encoder?.close(); w.dispose(); }
      }
      setStatus('Готово: оба H.264 файла сохранены в .tmp/carnival-video-20261022');
    } catch (error) { console.error('[carnival-bake]', error); setStatus(String(error)); }
    finally { setBusy(false); }
  };
  return <main style={{ padding: 20 }}><h1>Запекание парка · только локальная разработка</h1>
    <p role="status">{status}</p>
    <button disabled={busy} onClick={() => void run()}>Запечь обе стороны · 60 секунд / 60 кадров</button>
    <button disabled={busy} onClick={async () => { setBusy(true); try { const { bakeBalloonAtlas } = await import('./bakeBalloons'); setStatus(await bakeBalloonAtlas()); } catch (error) { console.error(error); setStatus(String(error)); } finally { setBusy(false); } }}>Запечь 3D-материалы шариков в атлас</button>
    {busy && <button onClick={() => { stop.current = true; }}>Остановить</button>}
    <canvas ref={canvas} width={WIDTH} height={HEIGHT} style={{ display: 'block', width: 450, height: 650, maxWidth: '100%' }} />
  </main>;
}
