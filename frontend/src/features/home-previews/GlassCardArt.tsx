import { useId } from 'react';

export const LEVEL_MATERIALS = ['paper', 'ice', 'ribbon', 'amber'] as const;
export type LevelMaterial = typeof LEVEL_MATERIALS[number];

/** Small vector studies of four different materials; no animation loop or bitmap textures. */
export function GlassCardArt({ material }: { material: LevelMaterial }) {
  const id = useId();
  return <svg viewBox="0 0 240 100" fill="none" aria-hidden="true" focusable="false">
    <defs><linearGradient id={id} x1="30" y1="10" x2="210" y2="100" gradientUnits="userSpaceOnUse">
      <stop stopColor="var(--art-light)" /><stop offset=".47" stopColor="var(--art-mid)" /><stop offset="1" stopColor="var(--art-dark)" />
    </linearGradient></defs>
    {material === 'paper' && <>
      <path d="M8 80H232M8 55H232M8 30H232" stroke="currentColor" strokeOpacity=".1" strokeDasharray="1 5" />
      <path d="M17 76C51 76 38 24 86 24S116 76 157 76 190 24 224 24" stroke={`url(#${id})`} strokeWidth="2" />
      <path d="M17 81C51 81 38 29 86 29S116 81 157 81 190 29 224 29" stroke="currentColor" strokeOpacity=".13" />
      {[[17,76],[86,24],[157,76],[224,24]].map(([cx,cy],i)=><g key={i}><circle cx={cx} cy={cy} r="6" fill="var(--art-paper)" stroke="currentColor" strokeOpacity=".35" /><circle cx={cx} cy={cy} r="2" fill="currentColor" /></g>)}
      <path d="M198 81h26m-13-6v12" stroke="currentColor" strokeOpacity=".3" />
    </>}
    {material === 'ice' && <>
      <ellipse cx="128" cy="87" rx="70" ry="8" fill="var(--art-dark)" opacity=".12" />
      <circle cx="132" cy="45" r="42" fill={`url(#${id})`} fillOpacity=".68" stroke="var(--art-light)" />
      <ellipse cx="132" cy="45" rx="20" ry="42" stroke="white" strokeOpacity=".7" transform="rotate(30 132 45)" />
      <ellipse cx="132" cy="45" rx="42" ry="16" stroke="white" strokeOpacity=".7" transform="rotate(-24 132 45)" />
      <path d="M104 24Q120 9 142 15" stroke="white" strokeWidth="3" strokeLinecap="round" />
      <circle cx="182" cy="70" r="17" fill="white" fillOpacity=".2" stroke="white" strokeOpacity=".65" />
      <path d="M37 46h16m-8-8v16m155-27h10m-5-5v10" stroke="currentColor" strokeOpacity=".35" />
      <path d="M45 76H85M180 14h35" stroke="currentColor" strokeOpacity=".2" strokeDasharray="2 4" />
    </>}
    {material === 'ribbon' && <>
      <ellipse cx="125" cy="50" rx="103" ry="35" stroke="currentColor" strokeOpacity=".18" strokeDasharray="2 5" transform="rotate(-12 125 50)" />
      <path d="M32 78C45-8 109 3 121 52S191 114 208 23" stroke="var(--art-dark)" strokeWidth="27" strokeLinecap="round" />
      <path d="M32 71C45-15 109-4 121 45S191 107 208 16" stroke={`url(#${id})`} strokeWidth="22" strokeLinecap="round" />
      <path d="M33 67C47-13 108-3 121 44S188 102 208 14" stroke="white" strokeOpacity=".6" strokeWidth=".8" />
      <path d="m188 67 3 9 9 3-9 3-3 9-3-9-9-3 9-3Z" fill="var(--art-light)" />
      <circle cx="48" cy="17" r="2" fill="white" fillOpacity=".6" />
    </>}
    {material === 'amber' && <>
      <path d="M51 91V42a43 43 0 0 1 86 0v49Z" fill="var(--art-dark)" opacity=".15" />
      <path d="M80 91V44a43 43 0 0 1 86 0v47Z" fill={`url(#${id})`} fillOpacity=".8" stroke="var(--art-light)" />
      <path d="M105 91V48a43 43 0 0 1 86 0v43Z" fill="var(--art-light)" fillOpacity=".12" stroke="var(--art-light)" strokeOpacity=".75" />
      <path d="M119 82V49a29 29 0 0 1 58 0v33" stroke="currentColor" strokeOpacity=".2" />
      <path d="M32 24h20m-10-10v20m166 38h20m-10-10v20" stroke="currentColor" strokeOpacity=".3" />
      <path d="M53 96h151" stroke="currentColor" strokeOpacity=".25" />
    </>}
  </svg>;
}
