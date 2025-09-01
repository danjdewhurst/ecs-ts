import { describe, expect, test } from 'bun:test';
import { World } from '../ecs/World';
import { EventComponent } from './EventComponent';
import type { GameEvent } from './GameEvent';

describe('Event System Integration', () => {
    test('should integrate EventComponent with World', () => {
        const world = new World();
        const entity = world.createEntity();

        const eventComponent = new EventComponent();
        eventComponent.queueEvent('component-event', { source: 'component' });

        world.addComponent(entity, eventComponent);

        const receivedEvents: GameEvent[] = [];
        world.subscribeToEvent('component-event', (event) => {
            receivedEvents.push(event);
        });

        // Before update, no events should be processed
        expect(receivedEvents).toHaveLength(0);

        // Update should flush component events and process them
        world.update(16.67);

        expect(receivedEvents).toHaveLength(1);
        expect(receivedEvents[0]?.type).toBe('component-event');
        expect(receivedEvents[0]?.data).toEqual({ source: 'component' });
        expect(receivedEvents[0]?.source).toBe(`entity:${entity}`);
    });

    test('should emit events directly through World', () => {
        const world = new World();
        const receivedEvents: GameEvent[] = [];

        world.subscribeToEvent('direct-event', (event) => {
            receivedEvents.push(event);
        });

        const testEvent: GameEvent = {
            type: 'direct-event',
            timestamp: Date.now(),
            source: 'test',
            data: { message: 'Direct emission' },
        };

        world.emitEvent(testEvent);

        // Events are queued until processEvents is called
        expect(receivedEvents).toHaveLength(0);

        world.update(16.67);

        expect(receivedEvents).toHaveLength(1);
        expect(receivedEvents[0]).toEqual(testEvent);
    });

    test('should handle multiple entities with EventComponents', () => {
        const world = new World();
        const receivedEvents: GameEvent[] = [];

        world.subscribeToEvent('multi-entity', (event) => {
            receivedEvents.push(event);
        });

        // Create multiple entities with event components
        const entity1 = world.createEntity();
        const entity2 = world.createEntity();

        const eventComponent1 = new EventComponent();
        eventComponent1.queueEvent('multi-entity', { entityId: 1 });

        const eventComponent2 = new EventComponent();
        eventComponent2.queueEvent('multi-entity', { entityId: 2 });

        world.addComponent(entity1, eventComponent1);
        world.addComponent(entity2, eventComponent2);

        world.update(16.67);

        expect(receivedEvents).toHaveLength(2);

        // Events should have entity source information
        const sources = receivedEvents.map((e) => e.source);
        expect(sources).toContain(`entity:${entity1}`);
        expect(sources).toContain(`entity:${entity2}`);
    });

    test('should allow unsubscribing from events', () => {
        const world = new World();
        const receivedEvents: GameEvent[] = [];

        const unsubscribe = world.subscribeToEvent('unsub-test', (event) => {
            receivedEvents.push(event);
        });

        const testEvent: GameEvent = {
            type: 'unsub-test',
            timestamp: Date.now(),
            data: {},
        };

        world.emitEvent(testEvent);
        world.update(16.67);
        expect(receivedEvents).toHaveLength(1);

        // Unsubscribe and emit again
        unsubscribe();
        world.emitEvent(testEvent);
        world.update(16.67);

        // Should still be only 1 event (the first one)
        expect(receivedEvents).toHaveLength(1);
    });

    test('should process events before and after systems update', () => {
        const world = new World();
        const eventOrder: string[] = [];

        // Create a test system that emits events
        class TestSystem {
            readonly priority = 1;
            readonly name = 'TestSystem';

            update(world: World): void {
                eventOrder.push('system-update');
                world.emitEvent({
                    type: 'system-event',
                    timestamp: Date.now(),
                    data: { from: 'system' },
                });
            }
        }

        world.addSystem(new TestSystem());

        // Subscribe to events
        world.subscribeToEvent('pre-event', () => {
            eventOrder.push('pre-event-processed');
        });

        world.subscribeToEvent('system-event', () => {
            eventOrder.push('system-event-processed');
        });

        // Emit an event before update
        world.emitEvent({
            type: 'pre-event',
            timestamp: Date.now(),
            data: {},
        });

        world.update(16.67);

        // Events should be processed before systems, then after
        expect(eventOrder).toEqual([
            'pre-event-processed',
            'system-update',
            'system-event-processed',
        ]);
    });

    test('should provide access to EventBus', () => {
        const world = new World();
        const eventBus = world.getEventBus();

        expect(eventBus).toBeDefined();
        expect(typeof eventBus.emit).toBe('function');
        expect(typeof eventBus.subscribe).toBe('function');
    });
});
