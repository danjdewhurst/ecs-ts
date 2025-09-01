import type { GameEvent } from './GameEvent';

export class EventBus {
    private listeners = new Map<string, Set<(event: GameEvent) => void>>();
    private eventQueue: GameEvent[] = [];

    emit(event: GameEvent): void {
        this.eventQueue.push(event);
    }

    subscribe(
        eventType: string,
        listener: (event: GameEvent) => void
    ): () => void {
        if (!this.listeners.has(eventType)) {
            this.listeners.set(eventType, new Set());
        }
        this.listeners.get(eventType)?.add(listener);

        return () => this.listeners.get(eventType)?.delete(listener);
    }

    processEvents(): void {
        const events = [...this.eventQueue];
        this.eventQueue.length = 0;

        for (const event of events) {
            const listeners = this.listeners.get(event.type);
            if (listeners) {
                for (const listener of listeners) {
                    try {
                        listener(event);
                    } catch (error) {
                        console.error(
                            `Event listener error for ${event.type}:`,
                            error
                        );
                    }
                }
            }
        }
    }

    hasQueuedEvents(): boolean {
        return this.eventQueue.length > 0;
    }

    clearQueue(): void {
        this.eventQueue.length = 0;
    }

    getListenerCount(eventType: string): number {
        return this.listeners.get(eventType)?.size ?? 0;
    }
}
