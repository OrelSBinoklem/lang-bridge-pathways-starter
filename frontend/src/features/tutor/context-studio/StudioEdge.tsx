import { BaseEdge, getSmoothStepPath, type Edge, type EdgeProps } from '@xyflow/react';
import styles from './context-studio.module.css';

type StudioEdgeData = { lane: number; colour: string; branch: boolean; highlighted: boolean; muted: boolean };
export function StudioEdge(props: EdgeProps<Edge<StudioEdgeData>>) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, markerEnd, id, label } = props;
  const offset = targetX > sourceX ? Math.min(28, (targetX - sourceX) / 8) : 28;
  const [path, labelX, labelY] = getSmoothStepPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
    centerX: sourceX + (targetX - sourceX) * (data?.lane ?? .5), offset, borderRadius: 12 });
  return <g className={styles.edgeRoute} data-highlighted={data?.highlighted || undefined} data-muted={data?.muted || undefined}>
    <path d={path} className={styles.edgeHalo} fill="none" />
    <BaseEdge id={id} path={path} markerEnd={markerEnd} interactionWidth={24} label={label} labelX={labelX} labelY={labelY}
      labelShowBg labelBgPadding={[7, 4]} labelBgBorderRadius={5}
      style={{ stroke: data?.colour, strokeDasharray: data?.branch ? '7 5' : undefined }} />
  </g>;
}
