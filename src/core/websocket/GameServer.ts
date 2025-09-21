import type { Server, ServerWebSocket } from 'bun';
import type { World } from '../ecs/World';
import type { EventBus } from '../events/EventBus';
import type { GameClient } from './GameClient';
import * as MessageSerializer from './MessageSerializer';
import type { NetworkMessage } from './NetworkMessage';

export interface GameServerConfig {
    port: number;
    heartbeatInterval: number;
    clientTimeout: number;
    maxClients: number;
}

export class GameServer {
    private clients = new Map<string, GameClient>();
    private world: World;
    private eventBus: EventBus;
    private config: GameServerConfig;
    private server: Server | null = null;
    private heartbeatTimer: Timer | null = null;
    private nextClientId = 1;

    constructor(world: World, config: Partial<GameServerConfig> = {}) {
        this.world = world;
        this.eventBus = world.getEventBus();
        this.config = {
            port: 3000,
            heartbeatInterval: 30000,
            clientTimeout: 60000,
            maxClients: 100,
            ...config,
        };
        this.setupEventListeners();
    }

    start(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.server = Bun.serve({
                    port: this.config.port,
                    fetch: this.handleHttpRequest.bind(this),
                    websocket: {
                        message: this.handleMessage.bind(this),
                        open: this.handleConnection.bind(this),
                        close: this.handleDisconnection.bind(this),
                        drain: this.handleDrain.bind(this),
                    },
                });

                this.startHeartbeat();
                console.log(`GameServer started on port ${this.config.port}`);
                resolve();
            } catch (error) {
                reject(error);
            }
        });
    }

    stop(): void {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }

        for (const client of this.clients.values()) {
            client.ws.close();
        }
        this.clients.clear();

        if (this.server) {
            this.server.stop();
            this.server = null;
        }

        console.log('GameServer stopped');
    }

    broadcast(message: NetworkMessage, excludeClients: string[] = []): void {
        const serialized = MessageSerializer.serialize(message);
        const excludeSet = new Set(excludeClients);

        for (const [clientId, client] of this.clients) {
            if (!excludeSet.has(clientId)) {
                try {
                    client.ws.send(serialized);
                } catch (error) {
                    console.error(
                        `Failed to send message to client ${clientId}:`,
                        error
                    );
                    this.removeClient(clientId);
                }
            }
        }
    }

    sendToClient(clientId: string, message: NetworkMessage): boolean {
        const client = this.clients.get(clientId);
        if (!client) {
            return false;
        }

        try {
            const serialized = MessageSerializer.serialize(message);
            client.ws.send(serialized);
            return true;
        } catch (error) {
            console.error(
                `Failed to send message to client ${clientId}:`,
                error
            );
            this.removeClient(clientId);
            return false;
        }
    }

    getConnectedClients(): string[] {
        return Array.from(this.clients.keys());
    }

    getClientCount(): number {
        return this.clients.size;
    }

    kickClient(clientId: string, reason?: string): boolean {
        const client = this.clients.get(clientId);
        if (!client) {
            return false;
        }

        if (reason) {
            const errorMessage = MessageSerializer.createError(
                reason,
                clientId
            );
            this.sendToClient(clientId, errorMessage);
        }

        client.ws.close();
        return true;
    }

    private handleHttpRequest(
        request: Request
    ): Response | Promise<Response> | undefined {
        const url = new URL(request.url);

        if (url.pathname === '/ws') {
            if (this.clients.size >= this.config.maxClients) {
                return new Response('Server full', { status: 503 });
            }

            const success = this.server?.upgrade(request);
            if (success) {
                return undefined;
            }
        }

        if (url.pathname === '/health') {
            return new Response(
                JSON.stringify({
                    status: 'ok',
                    clients: this.clients.size,
                    uptime: process.uptime(),
                }),
                {
                    headers: { 'Content-Type': 'application/json' },
                }
            );
        }

        return new Response('Not Found', { status: 404 });
    }

    private handleConnection(ws: ServerWebSocket<unknown>): void {
        const clientId = this.generateClientId();
        const client: GameClient = {
            id: clientId,
            ws,
            lastHeartbeat: Date.now(),
            isAuthenticated: false,
            metadata: {},
        };

        this.clients.set(clientId, client);

        const welcomeMessage: NetworkMessage = {
            type: 'system',
            timestamp: Date.now(),
            payload: {
                command: 'authenticate',
                data: { clientId },
            },
        };

        this.sendToClient(clientId, welcomeMessage);

        this.eventBus.emit({
            type: 'client_connected',
            timestamp: Date.now(),
            source: 'server',
            data: { clientId },
        });

        console.log(`Client ${clientId} connected`);
    }

    private handleDisconnection(ws: ServerWebSocket<unknown>): void {
        const client = this.findClientByWebSocket(ws);
        if (client) {
            this.removeClient(client.id);
        }
    }

    private handleMessage(
        ws: ServerWebSocket<unknown>,
        message: string | Buffer
    ): void {
        const client = this.findClientByWebSocket(ws);
        if (!client) {
            console.warn('Received message from unknown client');
            return;
        }

        try {
            const networkMessage = MessageSerializer.deserialize(message);
            client.lastHeartbeat = Date.now();
            this.processClientMessage(client, networkMessage);
        } catch (error) {
            console.error(`Invalid message from client ${client.id}:`, error);
            const errorMessage = MessageSerializer.createError(
                'Invalid message format',
                client.id
            );
            this.sendToClient(client.id, errorMessage);
        }
    }

    private handleDrain(ws: ServerWebSocket<unknown>): void {
        const client = this.findClientByWebSocket(ws);
        if (client) {
            console.warn(`Client ${client.id} backpressure detected`);
        }
    }

    private processClientMessage(
        client: GameClient,
        message: NetworkMessage
    ): void {
        if (message.type === 'system') {
            this.handleSystemMessage(client, message);
            return;
        }

        if (!client.isAuthenticated) {
            const errorMessage = MessageSerializer.createError(
                'Not authenticated',
                client.id
            );
            this.sendToClient(client.id, errorMessage);
            return;
        }

        this.eventBus.emit({
            type: 'client_message',
            timestamp: Date.now(),
            source: client.id,
            data: { message, clientId: client.id },
        });
    }

    private handleSystemMessage(
        client: GameClient,
        message: NetworkMessage
    ): void {
        const payload = message.payload as { command: string; data?: unknown };

        switch (payload.command) {
            case 'heartbeat':
                client.lastHeartbeat = Date.now();
                break;

            case 'authenticate': {
                client.isAuthenticated = true;
                if (payload.data && typeof payload.data === 'object') {
                    client.metadata = {
                        ...client.metadata,
                        ...(payload.data as Record<string, unknown>),
                    };
                }

                const entity = this.world.createEntity();
                client.entityId = entity;

                this.eventBus.emit({
                    type: 'client_authenticated',
                    timestamp: Date.now(),
                    source: 'server',
                    data: { clientId: client.id, entityId: entity },
                });
                break;
            }

            default:
                console.warn(`Unknown system command: ${payload.command}`);
        }
    }

    private setupEventListeners(): void {
        this.eventBus.subscribe('game_state_update', (event) => {
            const stateMessage: NetworkMessage = {
                type: 'state',
                timestamp: Date.now(),
                payload: event.data,
            };
            this.broadcast(stateMessage);
        });
    }

    private startHeartbeat(): void {
        this.heartbeatTimer = setInterval(() => {
            const now = Date.now();
            const clientsToRemove: string[] = [];

            for (const [clientId, client] of this.clients) {
                if (now - client.lastHeartbeat > this.config.clientTimeout) {
                    clientsToRemove.push(clientId);
                } else {
                    const heartbeat =
                        MessageSerializer.createHeartbeat(clientId);
                    this.sendToClient(clientId, heartbeat);
                }
            }

            for (const clientId of clientsToRemove) {
                console.log(`Client ${clientId} timed out`);
                this.removeClient(clientId);
            }
        }, this.config.heartbeatInterval);
    }

    private removeClient(clientId: string): void {
        const client = this.clients.get(clientId);
        if (!client) {
            return;
        }

        if (client.entityId !== undefined) {
            this.world.destroyEntity(client.entityId);
        }

        this.clients.delete(clientId);

        this.eventBus.emit({
            type: 'client_disconnected',
            timestamp: Date.now(),
            source: 'server',
            data: { clientId, entityId: client.entityId },
        });

        console.log(`Client ${clientId} disconnected`);
    }

    private findClientByWebSocket(
        ws: ServerWebSocket<unknown>
    ): GameClient | undefined {
        for (const client of this.clients.values()) {
            if (client.ws === ws) {
                return client;
            }
        }
        return undefined;
    }

    private generateClientId(): string {
        return `client_${this.nextClientId++}_${Date.now()}`;
    }
}
