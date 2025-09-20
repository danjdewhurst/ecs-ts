export interface NetworkMessage {
    type: 'input' | 'state' | 'event' | 'system';
    frame?: number;
    entities?: number[];
    payload: unknown;
    timestamp: number;
    clientId?: string;
}

export interface InputMessage extends NetworkMessage {
    type: 'input';
    payload: {
        action: string;
        data: Record<string, unknown>;
    };
}

export interface StateMessage extends NetworkMessage {
    type: 'state';
    payload: {
        entities: Array<{
            id: number;
            components: Record<string, unknown>;
        }>;
    };
}

export interface EventMessage extends NetworkMessage {
    type: 'event';
    payload: {
        eventType: string;
        eventData: Record<string, unknown>;
    };
}

export interface SystemMessage extends NetworkMessage {
    type: 'system';
    payload: {
        command: 'heartbeat' | 'authenticate' | 'disconnect' | 'error';
        data?: Record<string, unknown>;
    };
}
