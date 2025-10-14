import { describe, expect, test } from 'bun:test';
import { EventBus } from './EventBus';
import type { GameEvent } from './GameEvent';

describe('EventBus', () => {
    test('should construct EventBus with empty state', () => {
        // Arrange & Act
        const eventBus = new EventBus();

        // Assert - verify constructor initializes properly
        expect(eventBus).toBeInstanceOf(EventBus);
        expect(eventBus.hasQueuedEvents()).toBe(false);
        expect(eventBus.getListenerCount('any-event')).toBe(0);
    });

    test('should create new EventBus instance with empty state', () => {
        // Arrange & Act
        const eventBus = new EventBus();

        // Assert
        expect(eventBus.hasQueuedEvents()).toBe(false);
        expect(eventBus.getListenerCount('any-event')).toBe(0);
    });

    test('should emit and process events', () => {
        const eventBus = new EventBus();
        const receivedEvents: GameEvent[] = [];

        eventBus.subscribe('test-event', (event) => {
            receivedEvents.push(event);
        });

        const testEvent: GameEvent = {
            type: 'test-event',
            timestamp: Date.now(),
            data: { message: 'Hello World' },
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
            data: { value: 42 },
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
            data: {},
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
        // biome-ignore lint/suspicious/noExplicitAny: Console.error accepts any arguments
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
            data: { test: 'value' },
        };

        eventBus.emit(testEvent);
        eventBus.processEvents();

        // Restore console.error
        console.error = consoleError;

        // Should have logged an error but continued processing
        expect(errorMessages).toHaveLength(1);
        expect(errorMessages[0]).toContain(
            'Event listener error for error-test'
        );
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
            { type: 'ordered-test', timestamp: 3, data: { order: 3 } },
        ];

        // Emit all events
        for (const event of events) {
            eventBus.emit(event);
        }
        expect(eventBus.hasQueuedEvents()).toBe(true);

        // Process all at once
        eventBus.processEvents();

        expect(processedEvents).toHaveLength(3);
        expect(processedEvents[0]?.data.order).toBe(1);
        expect(processedEvents[1]?.data.order).toBe(2);
        expect(processedEvents[2]?.data.order).toBe(3);
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

    test('should process events with no listeners without error', () => {
        // Arrange
        const eventBus = new EventBus();
        const testEvent: GameEvent = {
            type: 'no-listener-event',
            timestamp: Date.now(),
            data: { value: 123 },
        };

        // Act
        eventBus.emit(testEvent);
        eventBus.processEvents();

        // Assert - should not throw and queue should be empty
        expect(eventBus.hasQueuedEvents()).toBe(false);
    });

    test('should handle unsubscribe when event type has been removed', () => {
        // Arrange
        const eventBus = new EventBus();
        const listener1 = () => {};
        const listener2 = () => {};

        const unsubscribe1 = eventBus.subscribe('remove-test', listener1);
        const unsubscribe2 = eventBus.subscribe('remove-test', listener2);

        // Act - remove first listener
        unsubscribe1();
        expect(eventBus.getListenerCount('remove-test')).toBe(1);

        // Remove second listener
        unsubscribe2();
        expect(eventBus.getListenerCount('remove-test')).toBe(0);

        // Act - calling unsubscribe again should not throw
        unsubscribe1();
        unsubscribe2();

        // Assert - should still be 0
        expect(eventBus.getListenerCount('remove-test')).toBe(0);
    });

    test('should handle subscribe with same listener function multiple times', () => {
        // Arrange
        const eventBus = new EventBus();
        const sharedListener = () => {};

        // Act - subscribe the same function twice (Set should deduplicate)
        const unsubscribe1 = eventBus.subscribe(
            'same-listener',
            sharedListener
        );
        const unsubscribe2 = eventBus.subscribe(
            'same-listener',
            sharedListener
        );

        // Assert - Set should only store one instance
        expect(eventBus.getListenerCount('same-listener')).toBe(1);

        // Unsubscribe once should remove it
        unsubscribe1();
        expect(eventBus.getListenerCount('same-listener')).toBe(0);

        // Second unsubscribe should be safe (no-op)
        unsubscribe2();
        expect(eventBus.getListenerCount('same-listener')).toBe(0);
    });

    test('should handle immediate unsubscribe without emitting events', () => {
        // Arrange
        const eventBus = new EventBus();
        const listener = () => {};

        // Act - subscribe and immediately unsubscribe without processing any events
        const unsubscribe = eventBus.subscribe('immediate-unsub', listener);
        expect(eventBus.getListenerCount('immediate-unsub')).toBe(1);

        // Unsubscribe right away
        unsubscribe();

        // Assert
        expect(eventBus.getListenerCount('immediate-unsub')).toBe(0);
    });

    test('should handle empty event queue processing', () => {
        // Arrange
        const eventBus = new EventBus();
        const receivedEvents: GameEvent[] = [];

        eventBus.subscribe('empty-queue-test', (event) => {
            receivedEvents.push(event);
        });

        // Act - process with no events
        eventBus.processEvents();

        // Assert
        expect(receivedEvents).toHaveLength(0);
        expect(eventBus.hasQueuedEvents()).toBe(false);
    });

    test('should handle multiple different event types', () => {
        // Arrange
        const eventBus = new EventBus();
        const typeAEvents: GameEvent[] = [];
        const typeBEvents: GameEvent[] = [];

        eventBus.subscribe('type-a', (event) => typeAEvents.push(event));
        eventBus.subscribe('type-b', (event) => typeBEvents.push(event));

        const eventA: GameEvent = {
            type: 'type-a',
            timestamp: Date.now(),
            data: { name: 'A' },
        };
        const eventB: GameEvent = {
            type: 'type-b',
            timestamp: Date.now(),
            data: { name: 'B' },
        };

        // Act
        eventBus.emit(eventA);
        eventBus.emit(eventB);
        eventBus.emit(eventA);
        eventBus.processEvents();

        // Assert
        expect(typeAEvents).toHaveLength(2);
        expect(typeBEvents).toHaveLength(1);
        expect(typeAEvents[0]).toEqual(eventA);
        expect(typeBEvents[0]).toEqual(eventB);
    });

    test('should clear queue without processing events', () => {
        // Arrange
        const eventBus = new EventBus();
        const receivedEvents: GameEvent[] = [];

        eventBus.subscribe('clear-test', (event) => {
            receivedEvents.push(event);
        });

        const testEvent: GameEvent = {
            type: 'clear-test',
            timestamp: Date.now(),
            data: {},
        };

        // Act
        eventBus.emit(testEvent);
        eventBus.emit(testEvent);
        expect(eventBus.hasQueuedEvents()).toBe(true);

        eventBus.clearQueue();

        // Process after clearing
        eventBus.processEvents();

        // Assert
        expect(receivedEvents).toHaveLength(0);
        expect(eventBus.hasQueuedEvents()).toBe(false);
    });

    test('should handle event emitted during event processing', () => {
        // Arrange
        const eventBus = new EventBus();
        const processedEvents: string[] = [];

        eventBus.subscribe('trigger-event', (_event) => {
            processedEvents.push('first');
            // Emit another event during processing
            eventBus.emit({
                type: 'secondary-event',
                timestamp: Date.now(),
                data: {},
            });
        });

        eventBus.subscribe('secondary-event', () => {
            processedEvents.push('second');
        });

        // Act
        eventBus.emit({
            type: 'trigger-event',
            timestamp: Date.now(),
            data: {},
        });
        eventBus.processEvents();

        // The secondary event should still be queued
        expect(eventBus.hasQueuedEvents()).toBe(true);
        expect(processedEvents).toEqual(['first']);

        // Process the secondary event
        eventBus.processEvents();
        expect(processedEvents).toEqual(['first', 'second']);
    });
});
