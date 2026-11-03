import type { FlowEdge, FlowNode, NodePacket } from './graph.mjs';
export type ModulePort = { id: string; label: string };
export type ModuleDefinition = { id: string; name: string; version: number; inputs: ModulePort[]; outputs: ModulePort[]; nodes: FlowNode[]; edges: FlowEdge[] };
export type ModuleResult = { outputs: Record<string, NodePacket> };
export function validateModuleDefinition(value: unknown, options?: { models?: string[] | null }): ModuleDefinition;
export function createModuleDefinition(options?: { id?: string; name?: string; inputs?: number; outputs?: number }): ModuleDefinition;
