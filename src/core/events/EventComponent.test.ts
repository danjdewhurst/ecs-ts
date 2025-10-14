import { describe, expect, test } from 'bun:test';
import { EventComponent } from './EventComponent';

describe('EventComponent', () => {
    test('should construct EventComponent with correct initial state', () => {
        // Arrange & Act
        const component = new EventComponent();

        // Assert - verify constructor properly initializes all fields
        expect(component).toBeInstanceOf(EventComponent);
        expect(component.type).toBe('event');
        expect(component.hasPendingEvents()).toBe(false);
        expect(component.getPendingEventCount()).toBe(0);
        expect(component.flushEvents()).toEqual([]);
    });

    test('should initialize with correct default state', () => {
        // Arrange & Act
        const component = new EventComponent();

        // Assert - verify all initial properties
        expect(component.type).toBe('event');
        expect(component.hasPendingEvents()).toBe(false);
        expect(component.getPendingEventCount()).toBe(0);
        expect(component.flushEvents()).toEqual([]);
    });

    test('should have readonly type property', () => {
        // Arrange
        const component = new EventComponent();

        // Act
        const type = component.type;

        // Assert - verify type is correct and readonly
        expect(type).toBe('event');
        expect(component.type).toBe('event');
    });

    test('should create multiple independent instances', () => {
        // Arrange & Act
        const component1 = new EventComponent();
        const component2 = new EventComponent();

        // Add event to first component
        component1.queueEvent('test-1', { data: 'one' });

        // Assert - instances are independent
        expect(component1.getPendingEventCount()).toBe(1);
        expect(component2.getPendingEventCount()).toBe(0);
        expect(component1.type).toBe('event');
        expect(component2.type).toBe('event');
    });

    test('should queue events correctly', () => {
        const component = new EventComponent();

        expect(component.hasPendingEvents()).toBe(false);
        expect(component.getPendingEventCount()).toBe(0);

        component.queueEvent('player-action', { action: 'jump' });

        expect(component.hasPendingEvents()).toBe(true);
        expect(component.getPendingEventCount()).toBe(1);
    });

    test('should flush events correctly', () => {
        const component = new EventComponent();

        component.queueEvent('event-1', { data: 'first' });
        component.queueEvent('event-2', { data: 'second' });

        expect(component.getPendingEventCount()).toBe(2);

        const flushedEvents = component.flushEvents();

        expect(flushedEvents).toHaveLength(2);
        expect(flushedEvents[0]?.type).toBe('event-1');
        expect(flushedEvents[0]?.data).toEqual({ data: 'first' });
        expect(flushedEvents[1]?.type).toBe('event-2');
        expect(flushedEvents[1]?.data).toEqual({ data: 'second' });

        // After flushing, no events should remain
        expect(component.hasPendingEvents()).toBe(false);
        expect(component.getPendingEventCount()).toBe(0);
    });

    test('should add timestamps to events', () => {
        const component = new EventComponent();
        const beforeTime = Date.now();

        component.queueEvent('timed-event', { test: 'data' });

        const afterTime = Date.now();
        const events = component.flushEvents();

        expect(events).toHaveLength(1);
        expect(events[0]?.timestamp).toBeGreaterThanOrEqual(beforeTime);
        expect(events[0]?.timestamp).toBeLessThanOrEqual(afterTime);
    });

    test('should handle multiple flushes', () => {
        const component = new EventComponent();

        component.queueEvent('first-batch', { batch: 1 });
        let events = component.flushEvents();
        expect(events).toHaveLength(1);
        expect(events[0]?.type).toBe('first-batch');

        component.queueEvent('second-batch', { batch: 2 });
        events = component.flushEvents();
        expect(events).toHaveLength(1);
        expect(events[0]?.type).toBe('second-batch');
    });

    test('should return empty array when no events to flush', () => {
        const component = new EventComponent();

        const events = component.flushEvents();
        expect(events).toHaveLength(0);
        expect(Array.isArray(events)).toBe(true);
    });

    test('should queue multiple events with different data types', () => {
        // Arrange
        const component = new EventComponent();

        // Act
        component.queueEvent('string-event', { value: 'test' });
        component.queueEvent('number-event', { value: 42 });
        component.queueEvent('boolean-event', { value: true });
        component.queueEvent('array-event', { value: [1, 2, 3] });
        component.queueEvent('object-event', { nested: { key: 'value' } });

        // Assert
        expect(component.getPendingEventCount()).toBe(5);
        const events = component.flushEvents();
        expect(events).toHaveLength(5);
        expect(events[0]?.data).toEqual({ value: 'test' });
        expect(events[1]?.data).toEqual({ value: 42 });
        expect(events[2]?.data).toEqual({ value: true });
        expect(events[3]?.data).toEqual({ value: [1, 2, 3] });
        expect(events[4]?.data).toEqual({ nested: { key: 'value' } });
    });

    test('should handle empty data objects', () => {
        // Arrange
        const component = new EventComponent();

        // Act
        component.queueEvent('empty-event', {});

        // Assert
        const events = component.flushEvents();
        expect(events).toHaveLength(1);
        expect(events[0]?.type).toBe('empty-event');
        expect(events[0]?.data).toEqual({});
    });

    test('should preserve event order when flushing', () => {
        // Arrange
        const component = new EventComponent();

        // Act
        for (let i = 0; i < 10; i++) {
            component.queueEvent(`event-${i}`, { index: i });
        }

        // Assert
        const events = component.flushEvents();
        expect(events).toHaveLength(10);
        for (let i = 0; i < 10; i++) {
            expect(events[i]?.type).toBe(`event-${i}`);
            expect(events[i]?.data).toEqual({ index: i });
        }
    });

    test('should return independent copy of events on flush', () => {
        // Arrange
        const component = new EventComponent();
        component.queueEvent('test-event', { value: 'original' });

        // Act
        const firstFlush = component.flushEvents();
        component.queueEvent('test-event', { value: 'modified' });
        const secondFlush = component.flushEvents();

        // Assert - first flush should not be affected by later changes
        expect(firstFlush).toHaveLength(1);
        expect(firstFlush[0]?.data).toEqual({ value: 'original' });
        expect(secondFlush).toHaveLength(1);
        expect(secondFlush[0]?.data).toEqual({ value: 'modified' });
    });

    test('should handle rapid event queuing and flushing', () => {
        // Arrange
        const component = new EventComponent();

        // Act & Assert - simulate rapid game loop
        for (let frame = 0; frame < 5; frame++) {
            component.queueEvent('frame-event', { frame });
            expect(component.getPendingEventCount()).toBe(1);
            expect(component.hasPendingEvents()).toBe(true);

            const events = component.flushEvents();
            expect(events).toHaveLength(1);
            expect(events[0]?.data).toEqual({ frame });
            expect(component.hasPendingEvents()).toBe(false);
        }
    });

    test('should handle complex nested data structures', () => {
        // Arrange
        const component = new EventComponent();
        const complexData = {
            player: {
                id: 'player-123',
                position: { x: 10, y: 20, z: 30 },
                inventory: ['sword', 'shield', 'potion'],
                stats: {
                    health: 100,
                    mana: 50,
                    level: 5,
                },
            },
        };

        // Act
        component.queueEvent('player-update', complexData);

        // Assert
        const events = component.flushEvents();
        expect(events).toHaveLength(1);
        expect(events[0]?.data).toEqual(complexData);
    });

    test('should check pending events status correctly after multiple operations', () => {
        // Arrange
        const component = new EventComponent();

        // Act & Assert - initially empty
        expect(component.hasPendingEvents()).toBe(false);
        expect(component.getPendingEventCount()).toBe(0);

        // Add events
        component.queueEvent('event-1', { data: 1 });
        expect(component.hasPendingEvents()).toBe(true);
        expect(component.getPendingEventCount()).toBe(1);

        component.queueEvent('event-2', { data: 2 });
        expect(component.hasPendingEvents()).toBe(true);
        expect(component.getPendingEventCount()).toBe(2);

        // Flush
        component.flushEvents();
        expect(component.hasPendingEvents()).toBe(false);
        expect(component.getPendingEventCount()).toBe(0);

        // Add and flush again
        component.queueEvent('event-3', { data: 3 });
        expect(component.hasPendingEvents()).toBe(true);
        component.flushEvents();
        expect(component.hasPendingEvents()).toBe(false);
    });

    test('should handle event type with special characters', () => {
        // Arrange
        const component = new EventComponent();

        // Act
        component.queueEvent('event:with:colons', { test: 'data' });
        component.queueEvent('event-with-dashes', { test: 'data' });
        component.queueEvent('event.with.dots', { test: 'data' });
        component.queueEvent('event_with_underscores', { test: 'data' });

        // Assert
        const events = component.flushEvents();
        expect(events).toHaveLength(4);
        expect(events[0]?.type).toBe('event:with:colons');
        expect(events[1]?.type).toBe('event-with-dashes');
        expect(events[2]?.type).toBe('event.with.dots');
        expect(events[3]?.type).toBe('event_with_underscores');
    });

    test('should maintain timestamp order for rapidly queued events', () => {
        // Arrange
        const component = new EventComponent();

        // Act
        component.queueEvent('event-1', { data: 1 });
        component.queueEvent('event-2', { data: 2 });
        component.queueEvent('event-3', { data: 3 });

        // Assert
        const events = component.flushEvents();
        expect(events[0]?.timestamp).toBeLessThanOrEqual(
            events[1]?.timestamp ?? 0
        );
        expect(events[1]?.timestamp).toBeLessThanOrEqual(
            events[2]?.timestamp ?? 0
        );
    });
});
