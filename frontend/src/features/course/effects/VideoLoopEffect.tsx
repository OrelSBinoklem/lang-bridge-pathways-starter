'use client';
import { useEffect, useRef, useState } from 'react';

/** Looping background video for a themed group (e.g. "Приятного аппетита!"). */
export function VideoLoopEffect({ src }: { src: string }) {
  const host = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const element = host.current;
    if (!element) return;
    const update = () => setSize({ width: element.clientWidth, height: element.clientHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const portrait = size.height > size.width && size.width > 0;
  return <div ref={host} data-course-video-orientation={portrait ? 'rotated' : 'normal'} style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
    <video
      src={src}
      autoPlay
      loop
      muted
      playsInline
      style={portrait
        ? { position: 'absolute', left: '50%', top: '50%', width: size.height, height: size.width, maxWidth: 'none', transform: 'translate(-50%, -50%) rotate(90deg)', objectFit: 'cover' }
        : { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
    />
  </div>;
}
