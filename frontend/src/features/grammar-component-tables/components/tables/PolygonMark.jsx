const COLORS = {
  green: ['var(--polygon-green-start)', 'var(--polygon-green-end)'],
  yellow: ['var(--polygon-yellow-start)', 'var(--polygon-yellow-end)'],
  violet: ['var(--polygon-violet-start)', 'var(--polygon-violet-end)'],
  pink: ['var(--polygon-pink-start)', 'var(--polygon-pink-end)'],
};

/** One polygon as a positioned picture. Move it via left / top / width / height. */
export default function PolygonMark({ id, color, left, top, width, height, viewBox, d }) {
  const [start, end] = COLORS[color] ?? COLORS.green;
  const gradId = `pg-${id}`;
  const shadowId = `ps-${id}`;

  return (
    <div className="polygon-stamp" style={{ left, top, width, height }}>
      <svg viewBox={viewBox} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={gradId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={start} />
            <stop offset="100%" stopColor={end} />
          </linearGradient>
          <filter id={shadowId} x="-50%" y="-50%" width="200%" height="200%">
            <feOffset dx="2" dy="2" in="SourceAlpha" result="offset" />
            <feGaussianBlur in="offset" stdDeviation="8" result="blur" />
            <feFlood floodColor="rgb(0,0,0)" floodOpacity="0.2" result="color" />
            <feComposite in="color" in2="blur" operator="in" result="shadow" />
            <feMerge>
              <feMergeNode in="shadow" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <path
          d={d}
          fill={`url(#${gradId})`}
          stroke="var(--border-strong)"
          strokeWidth={1.5}
          filter={`url(#${shadowId})`}
        />
      </svg>
    </div>
  );
}
