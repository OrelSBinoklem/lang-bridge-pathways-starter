'use client';

import { Component, useEffect, useMemo, useRef, useSyncExternalStore, type ReactNode } from 'react';
import Image from 'next/image';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import { Billboard, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { COURSE_LEVEL_IDS } from '@/features/course/course-level-progress';
import styles from './home-preview.module.css';

type SceneProps = { selected: string; onSelect: (level: string) => void; moving: boolean; dark: boolean };
const positions: [number, number, number][] = [[-4.2, 0, .9], [-1.4, 0, -.45], [1.4, 0, .6], [4.2, 0, -.65]];
const colors = ['#298d70', '#cf6984', '#cfab48', '#637fab'];
const subscribeMotion = (callback: () => void) => {
  const query = window.matchMedia('(prefers-reduced-motion: reduce)');
  query.addEventListener('change', callback);
  return () => query.removeEventListener('change', callback);
};
const readMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error) { console.error('[home-previews] 3D scene failed', error.message); }
  render() { return this.state.failed ? <SceneFallback /> : this.props.children; }
}

function SceneFallback() {
  return <div className={styles.sceneFallback}><Image src="/course/categories/transparent/1763-light.webp" width={220} height={220} alt="LangBridge Pathways" /></div>;
}

function LevelLabel({ level, active }: { level: string; active: boolean }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 128;
    const context = canvas.getContext('2d')!;
    context.fillStyle = active ? '#176e56' : '#ffffff';
    context.beginPath(); context.roundRect(8, 8, 240, 112, 16); context.fill();
    context.font = 'bold 66px Arial'; context.fillStyle = active ? '#ffffff' : '#263e35';
    context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(level, 128, 69);
    const result = new THREE.CanvasTexture(canvas);
    result.colorSpace = THREE.SRGBColorSpace;
    return result;
  }, [level, active]);
  useEffect(() => () => texture.dispose(), [texture]);
  return <Billboard position={[0, .5, 1.05]}><mesh><planeGeometry args={[.9, .45]} /><meshBasicMaterial map={texture} transparent depthTest={false} /></mesh></Billboard>;
}

function Tree({ position }: { position: [number, number, number] }) {
  return <group position={position}><mesh castShadow position={[0,.22,0]}><cylinderGeometry args={[.04,.055,.44,6]} /><meshStandardMaterial color="#826951" /></mesh><mesh castShadow position={[0,.6,0]}><coneGeometry args={[.25,.65,7]} /><meshStandardMaterial color="#3c9876" /></mesh></group>;
}

function Book() {
  return <group position={[0,.47,0]} rotation={[0,.25,0]}>
    {[-1,1].map(side => <group key={side} position={[side * .4,0,0]} rotation={[0,0,side * .13]}><mesh castShadow><boxGeometry args={[.82,.14,1.05]} /><meshStandardMaterial color="#fffdf1" /></mesh><mesh castShadow position={[0,-.09,0]}><boxGeometry args={[.9,.045,1.12]} /><meshStandardMaterial color="#b95264" /></mesh>{[-.25,0,.25].map(z => <mesh key={z} position={[0,.073,z]}><boxGeometry args={[.56,.008,.023]} /><meshStandardMaterial color="#b3c3b9" /></mesh>)}</group>)}
    <mesh castShadow position={[0,.52,0]} rotation={[.3,0,-.1]}><torusGeometry args={[.32,.035,12,40]} /><meshStandardMaterial color="#d9ad49" metalness={.6} roughness={.3} /></mesh>
  </group>;
}

function House() {
  return <group position={[0,.3,0]}><mesh castShadow position={[0,.4,0]}><boxGeometry args={[1.05,.85,.85]} /><meshStandardMaterial color="#fff7e8" /></mesh><mesh castShadow position={[0,1.02,0]} rotation={[0,Math.PI/4,0]}><coneGeometry args={[.9,.6,4]} /><meshStandardMaterial color="#c96779" /></mesh><mesh position={[0,.17,.43]}><boxGeometry args={[.22,.45,.03]} /><meshStandardMaterial color="#526960" /></mesh>{[-.32,.32].map(x => <mesh key={x} position={[x,.53,.432]}><boxGeometry args={[.2,.22,.03]} /><meshStandardMaterial color="#8fc8d3" /></mesh>)}<mesh castShadow position={[.4,1.08,-.1]}><boxGeometry args={[.14,.44,.14]} /><meshStandardMaterial color="#ecdac7" /></mesh></group>;
}

function Town({ tall = false }: { tall?: boolean }) {
  return <group position={[0,.3,0]}>{[-.55,0,.55].map((x,index) => {
    const height = tall && index === 1 ? 1.8 : .6 + index * .22;
    return <group key={x} position={[x,0,0]}><mesh castShadow position={[0,height/2,0]}><boxGeometry args={[.42,height,.62]} /><meshStandardMaterial color={['#d398a5','#ece7d6','#9cc5b8'][index]} /></mesh>{[.25,.5,.75].filter(y => y < height).map(y => <mesh key={y} position={[0,y,.32]}><boxGeometry args={[.25,.11,.02]} /><meshStandardMaterial color="#508393" /></mesh>)}<mesh castShadow position={[0,height + .18,0]} rotation={[0,Math.PI/4,0]}><coneGeometry args={[.4,.37,4]} /><meshStandardMaterial color={tall ? '#528c80' : '#b96c79'} /></mesh>{tall && index === 1 && <mesh castShadow position={[0,height + .65,0]}><coneGeometry args={[.12,.68,8]} /><meshStandardMaterial color="#367463" /></mesh>}</group>;
  })}</group>;
}

function Bridge({ from, to }: { from: [number,number,number]; to: [number,number,number] }) {
  const length = Math.hypot(to[0] - from[0], to[2] - from[2]);
  const angle = -Math.atan2(to[2] - from[2], to[0] - from[0]);
  return <group position={[(from[0]+to[0])/2,.04,(from[2]+to[2])/2]} rotation={[0,angle,0]}>
    <mesh castShadow receiveShadow><boxGeometry args={[length,.1,.48]} /><meshStandardMaterial color="#d9d8c8" /></mesh>
    {[-.25,.25].map(z => <group key={z}><mesh castShadow position={[0,.19,z]}><boxGeometry args={[length,.04,.035]} /><meshStandardMaterial color="#f7faf2" /></mesh>{[-.7,0,.7].map(x => <mesh key={x} position={[x,.11,z]}><boxGeometry args={[.04,.25,.04]} /><meshStandardMaterial color="#f7faf2" /></mesh>)}</group>)}
  </group>;
}

function Landscape({ selected, onSelect, moving, dark }: SceneProps) {
  const group = useRef<THREE.Group>(null);
  const boat = useRef<THREE.Group>(null);
  const { size } = useThree();
  const narrow = size.width < 700;
  const elapsed = useRef(0);
  const frame = useRef(0);
  useFrame((state, delta) => {
    state.gl.domElement.dataset.renderFrames = String(++frame.current);
    state.gl.domElement.dataset.motion = moving ? 'running' : 'paused';
    if (!moving) return;
    elapsed.current += Math.min(delta,.05);
    if (group.current) group.current.rotation.y = Math.sin(elapsed.current * .16) * .055;
    if (boat.current) { boat.current.position.x = Math.sin(elapsed.current * .24) * 3; boat.current.rotation.y = Math.cos(elapsed.current * .24) > 0 ? 0 : Math.PI; }
  });
  function choose(event: ThreeEvent<MouseEvent>, id: string) { event.stopPropagation(); onSelect(id); }
  return <>
    <ambientLight intensity={dark ? .65 : 1.3} />
    <directionalLight castShadow position={[-3,9,4]} intensity={dark ? 2 : 3} shadow-mapSize={[1024,1024]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={7} shadow-camera-bottom={-7} shadow-normalBias={.05} />
    <group ref={group} position={[narrow ? 0 : 1.4,narrow ? .55 : 0,0]} scale={narrow ? Math.min(.67,size.width / 560) : 1}>
      <mesh receiveShadow rotation={[-Math.PI/2,0,0]} position={[0,-.35,0]}><planeGeometry args={[18,10]} /><meshStandardMaterial color={dark ? '#244b49' : '#a8d7ce'} roughness={.65} /></mesh>
      {positions.slice(0,-1).map((position,index) => <Bridge key={index} from={position} to={positions[index+1]} />)}
      {positions.map((position,index) => <group key={index} position={position} onClick={event => choose(event,COURSE_LEVEL_IDS[index])} onPointerOver={event => { event.stopPropagation(); (event.nativeEvent.target as HTMLCanvasElement).style.cursor = 'pointer'; }} onPointerOut={event => { (event.nativeEvent.target as HTMLCanvasElement).style.cursor = 'auto'; }}>
        <RoundedBox args={[2.15,.32,1.85]} radius={.12} smoothness={2} receiveShadow castShadow><meshStandardMaterial color={selected === COURSE_LEVEL_IDS[index] ? '#d5eccd' : dark ? '#819e86' : '#edf0db'} /></RoundedBox>
        <mesh position={[0,-.24,0]}><boxGeometry args={[1.9,.25,1.6]} /><meshStandardMaterial color={colors[index]} /></mesh>
        {index === 0 ? <Book /> : index === 1 ? <House /> : <Town tall={index === 3} />}
        <Tree position={[-.8,.15,-.5]} /><Tree position={[.8,.15,.25]} />
        <LevelLabel level={COURSE_LEVEL_IDS[index]} active={selected === COURSE_LEVEL_IDS[index]} />
      </group>)}
      <group ref={boat} position={[0,-.13,2.2]}><mesh castShadow><boxGeometry args={[.62,.12,.23]} /><meshStandardMaterial color="#f4fbf7" /></mesh><mesh castShadow position={[.02,.16,0]}><boxGeometry args={[.27,.2,.18]} /><meshStandardMaterial color="#b64e65" /></mesh></group>
    </group>
  </>;
}

export default function CourseLandscape(props: SceneProps) {
  const reduced = useSyncExternalStore(subscribeMotion, readMotion, () => true);
  const moving = props.moving && !reduced;
  return <div className={styles.scene} data-testid="course-landscape"><SceneBoundary><Canvas shadows dpr={[1,1.5]} frameloop={moving ? 'always' : 'demand'} camera={{ position: [5,7,12], fov: 42 }} gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }} fallback={<SceneFallback />} aria-label="A1–B2" onCreated={({ gl }) => { gl.domElement.dataset.scene = 'course-landscape'; }}><Landscape {...props} moving={moving} /></Canvas></SceneBoundary></div>;
}
