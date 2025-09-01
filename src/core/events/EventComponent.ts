import type { Component } from '../ecs/Component';
import type { GameEvent } from './GameEvent';

export class EventComponent implements Component {
    readonly type = 'event';
    private pendingEvents: GameEvent[] = [];

    queueEvent(type: string, data: Record<string, unknown>): void {
        this.pendingEvents.push({
            type,
            timestamp: Date.now(),
            data
        });
    }

    flushEvents(): GameEvent[] {
        const events = [...this.pendingEvents];
        this.pendingEvents.length = 0;
        return events;
    }

    hasPendingEvents(): boolean {
        return this.pendingEvents.length > 0;
    }

    getPendingEventCount(): number {
        return this.pendingEvents.length;
    }
}