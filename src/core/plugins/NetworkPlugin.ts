import type { World } from '../ecs/World';
import type { GameClient, ServerMessage } from '../websocket/GameClient.ts';
import type { NetworkMessage } from '../websocket/NetworkMessage.ts';
import type { Plugin } from './Plugin.ts';

/**
 * Interface for plugins that provide networking functionality.
 * Extends the base Plugin interface with network-specific methods.
 */
export interface NetworkPlugin extends Plugin {
    /**
     * Send a message to a specific client.
     *
     * @param clientId - The ID of the client to send the message to
     * @param message - The message to send
     * @returns Promise that resolves when the message is sent
     * @throws {Error} If the client is not found or message fails to send
     */
    sendToClient(clientId: string, message: NetworkMessage): Promise<void>;

    /**
     * Send a server message to a specific client.
     *
     * @param clientId - The ID of the client to send the message to
     * @param message - The server message to send
     * @returns Promise that resolves when the message is sent
     * @throws {Error} If the client is not found or message fails to send
     */
    sendServerMessage(clientId: string, message: ServerMessage): Promise<void>;

    /**
     * Broadcast a message to all connected clients.
     *
     * @param message - The message to broadcast
     * @param exclude - Optional array of client IDs to exclude from the broadcast
     * @returns Promise that resolves when the message is broadcast to all clients
     */
    broadcast(message: NetworkMessage, exclude?: string[]): Promise<void>;

    /**
     * Broadcast a server message to all connected clients.
     *
     * @param message - The server message to broadcast
     * @param exclude - Optional array of client IDs to exclude from the broadcast
     * @returns Promise that resolves when the message is broadcast to all clients
     */
    broadcastServerMessage(
        message: ServerMessage,
        exclude?: string[]
    ): Promise<void>;

    /**
     * Get a list of all connected clients.
     *
     * @returns Array of client information
     */
    getConnectedClients(): GameClient[];

    /**
     * Get information about a specific client.
     *
     * @param clientId - The ID of the client
     * @returns Client information if found, undefined otherwise
     */
    getClient(clientId: string): GameClient | undefined;

    /**
     * Disconnect a specific client.
     *
     * @param clientId - The ID of the client to disconnect
     * @param reason - Optional reason for disconnection
     * @returns Promise that resolves when the client is disconnected
     */
    disconnectClient(clientId: string, reason?: string): Promise<void>;

    /**
     * Check if a client is connected.
     *
     * @param clientId - The ID of the client to check
     * @returns True if the client is connected, false otherwise
     */
    isClientConnected(clientId: string): boolean;

    /**
     * Get the number of connected clients.
     *
     * @returns Number of connected clients
     */
    getClientCount(): number;

    /**
     * Register a handler for incoming client messages.
     * This allows plugins to handle specific message types.
     *
     * @param messageType - The type of message to handle
     * @param handler - Function to handle the message
     * @returns Function to unregister the handler
     */
    onClientMessage(
        messageType: string,
        handler: (
            clientId: string,
            message: unknown,
            client: GameClient
        ) => void
    ): () => void;

    /**
     * Register a handler for client connection events.
     *
     * @param handler - Function to handle client connections
     * @returns Function to unregister the handler
     */
    onClientConnect(handler: (client: GameClient) => void): () => void;

    /**
     * Register a handler for client disconnection events.
     *
     * @param handler - Function to handle client disconnections
     * @returns Function to unregister the handler
     */
    onClientDisconnect(
        handler: (clientId: string, reason?: string) => void
    ): () => void;
}

/**
 * Configuration options for network plugins.
 */
export interface NetworkPluginConfig {
    /** Maximum number of clients allowed */
    maxClients?: number;

    /** Heartbeat interval in milliseconds */
    heartbeatInterval?: number;

    /** Client timeout in milliseconds */
    clientTimeout?: number;

    /** Enable message compression */
    compression?: boolean;

    /** Rate limiting configuration */
    rateLimit?: {
        /** Maximum messages per time window */
        maxMessages: number;
        /** Time window in milliseconds */
        windowMs: number;
    };
}

/**
 * Base implementation helper for network plugins.
 * Provides common functionality that network plugins can extend.
 */
export abstract class BaseNetworkPlugin implements NetworkPlugin {
    abstract readonly name: string;
    abstract readonly version: string;
    readonly dependencies?: string[];

    protected config: Required<NetworkPluginConfig>;

    constructor(config: NetworkPluginConfig = {}) {
        this.config = {
            maxClients: config.maxClients ?? 100,
            heartbeatInterval: config.heartbeatInterval ?? 30000,
            clientTimeout: config.clientTimeout ?? 60000,
            compression: config.compression ?? false,
            rateLimit: config.rateLimit ?? {
                maxMessages: 100,
                windowMs: 60000,
            },
        };
    }

    abstract initialize(world: World): Promise<void>;
    shutdown?(): Promise<void> {
        // Default empty implementation
        return Promise.resolve();
    }

    // Network plugin methods to be implemented by concrete classes
    abstract sendToClient(
        clientId: string,
        message: NetworkMessage
    ): Promise<void>;
    abstract sendServerMessage(
        clientId: string,
        message: ServerMessage
    ): Promise<void>;
    abstract broadcast(
        message: NetworkMessage,
        exclude?: string[]
    ): Promise<void>;
    abstract broadcastServerMessage(
        message: ServerMessage,
        exclude?: string[]
    ): Promise<void>;
    abstract getConnectedClients(): GameClient[];
    abstract getClient(clientId: string): GameClient | undefined;
    abstract disconnectClient(clientId: string, reason?: string): Promise<void>;
    abstract isClientConnected(clientId: string): boolean;
    abstract getClientCount(): number;
    abstract onClientMessage(
        messageType: string,
        handler: (
            clientId: string,
            message: unknown,
            client: GameClient
        ) => void
    ): () => void;
    abstract onClientConnect(handler: (client: GameClient) => void): () => void;
    abstract onClientDisconnect(
        handler: (clientId: string, reason?: string) => void
    ): () => void;
}
