type ConnectionNode = { id: string; type: string; data: Record<string, unknown> };
type Connection = { source: string | null; target: string | null; sourceHandle?: string | null; targetHandle?: string | null };
export function connectionTypesAllowed(from: string, to: string, fragment?: boolean): boolean;
export function connectionError(from: ConnectionNode | undefined, to: ConnectionNode | undefined, wire: Connection, fragment?: boolean): string | null;
export function connectionSignature(wire: Connection): string;
