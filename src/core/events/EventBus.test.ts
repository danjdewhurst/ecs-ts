import { test, expect, describe } from "bun:test";
import { EventBus } from './EventBus';
import type { GameEvent } from './GameEvent';

describe('EventBus', () => {
    test('should emit and process events', () => {
        const eventBus = new EventBus();
        const receivedEvents: GameEvent[] = [];
        
        eventBus.subscribe('test-event', (event) => {
            receivedEvents.push(event);
        });

        const testEvent: GameEvent = {
            type: 'test-event',
            timestamp: Date.now(),
            data: { message: 'Hello World' }
        };

        eventBus.emit(testEvent);
        expect(eventBus.hasQueuedEvents()).toBe(true);

        eventBus.processEvents();
        expect(receivedEvents).toHaveLength(1);
        expect(receivedEvents[0]).toEqual(testEvent);
        expect(eventBus.hasQueuedEvents()).toBe(false);
    });

    test('should handle multiple listeners for same event type', () => {
        const eventBus = new EventBus();
        const listener1Events: GameEvent[] = [];
        const listener2Events: GameEvent[] = [];
        
        eventBus.subscribe('multi-listener', (event) => {
            listener1Events.push(event);
        });
        
        eventBus.subscribe('multi-listener', (event) => {
            listener2Events.push(event);
        });

        const testEvent: GameEvent = {
            type: 'multi-listener',
            timestamp: Date.now(),
            data: { value: 42 }
        };

        eventBus.emit(testEvent);
        eventBus.processEvents();

        expect(listener1Events).toHaveLength(1);
        expect(listener2Events).toHaveLength(1);
        expect(listener1Events[0]).toEqual(testEvent);
        expect(listener2Events[0]).toEqual(testEvent);
    });

    test('should allow unsubscribing from events', () => {
        const eventBus = new EventBus();
        const receivedEvents: GameEvent[] = [];
        
        const unsubscribe = eventBus.subscribe('unsubscribe-test', (event) => {
            receivedEvents.push(event);
        });

        const testEvent: GameEvent = {
            type: 'unsubscribe-test',
            timestamp: Date.now(),
            data: {}
        };

        // First event should be received
        eventBus.emit(testEvent);
        eventBus.processEvents();
        expect(receivedEvents).toHaveLength(1);

        // Unsubscribe
        unsubscribe();

        // Second event should not be received
        eventBus.emit(testEvent);
        eventBus.processEvents();
        expect(receivedEvents).toHaveLength(1);
    });

    test('should handle listener errors gracefully', () => {
        const eventBus = new EventBus();
        const consoleError = console.error;
        const errorMessages: string[] = [];
        
        // Mock console.error to capture error messages
        console.error = (...args: any[]) => {
            errorMessages.push(args.join(' '));
        };

        eventBus.subscribe('error-test', () => {
            throw new Error('Test error');
        });

        const workingEvents: GameEvent[] = [];
        eventBus.subscribe('error-test', (event) => {
            workingEvents.push(event);
        });

        const testEvent: GameEvent = {
            type: 'error-test',
            timestamp: Date.now(),
            data: { test: 'value' }
        };

        eventBus.emit(testEvent);
        eventBus.processEvents();

        // Restore console.error
        console.error = consoleError;

        // Should have logged an error but continued processing
        expect(errorMessages).toHaveLength(1);
        expect(errorMessages[0]).toContain('Event listener error for error-test');
        expect(workingEvents).toHaveLength(1);
    });

    test('should queue multiple events and process in order', () => {
        const eventBus = new EventBus();
        const processedEvents: GameEvent[] = [];
        
        eventBus.subscribe('ordered-test', (event) => {
            processedEvents.push(event);
        });

        const events: GameEvent[] = [
            { type: 'ordered-test', timestamp: 1, data: { order: 1 } },
            { type: 'ordered-test', timestamp: 2, data: { order: 2 } },
            { type: 'ordered-test', timestamp: 3, data: { order: 3 } }
        ];

        // Emit all events
        events.forEach(event => eventBus.emit(event));
        expect(eventBus.hasQueuedEvents()).toBe(true);

        // Process all at once
        eventBus.processEvents();
        
        expect(processedEvents).toHaveLength(3);
        expect(processedEvents[0]!.data.order).toBe(1);
        expect(processedEvents[1]!.data.order).toBe(2);
        expect(processedEvents[2]!.data.order).toBe(3);
    });

    test('should provide listener count', () => {
        const eventBus = new EventBus();
        
        expect(eventBus.getListenerCount('test-count')).toBe(0);

        const unsubscribe1 = eventBus.subscribe('test-count', () => {});
        expect(eventBus.getListenerCount('test-count')).toBe(1);

        const unsubscribe2 = eventBus.subscribe('test-count', () => {});
        expect(eventBus.getListenerCount('test-count')).toBe(2);

        unsubscribe1();
        expect(eventBus.getListenerCount('test-count')).toBe(1);

        unsubscribe2();
        expect(eventBus.getListenerCount('test-count')).toBe(0);
    });

    test('should clear event queue', () => {
        const eventBus = new EventBus();
        
        eventBus.emit({ type: 'test', timestamp: Date.now(), data: {} });
        eventBus.emit({ type: 'test', timestamp: Date.now(), data: {} });
        
        expect(eventBus.hasQueuedEvents()).toBe(true);
        eventBus.clearQueue();
        expect(eventBus.hasQueuedEvents()).toBe(false);
    });
});