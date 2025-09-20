import type { ServerWebSocket } from 'bun';

export interface GameClient {
    readonly id: string;
    entityId?: number;
    ws: ServerWebSocket<unknown>;
    lastHeartbeat: number;
    isAuthenticated: boolean;
    metadata: Record<string, unknown>;
}

export interface ClientMessage {
    type: string;
    data: Record<string, unknown>;
    timestamp?: number;
}

export interface ServerMessage {
    type: string;
    data: Record<string, unknown>;
    timestamp: number;
}
