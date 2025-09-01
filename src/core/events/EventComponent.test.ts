import { test, expect, describe } from "bun:test";
import { EventComponent } from './EventComponent';

describe('EventComponent', () => {
    test('should have correct type', () => {
        const component = new EventComponent();
        expect(component.type).toBe('event');
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
        expect(flushedEvents[0]!.type).toBe('event-1');
        expect(flushedEvents[0]!.data).toEqual({ data: 'first' });
        expect(flushedEvents[1]!.type).toBe('event-2');
        expect(flushedEvents[1]!.data).toEqual({ data: 'second' });
        
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
        expect(events[0]!.timestamp).toBeGreaterThanOrEqual(beforeTime);
        expect(events[0]!.timestamp).toBeLessThanOrEqual(afterTime);
    });

    test('should handle multiple flushes', () => {
        const component = new EventComponent();
        
        component.queueEvent('first-batch', { batch: 1 });
        let events = component.flushEvents();
        expect(events).toHaveLength(1);
        expect(events[0]!.type).toBe('first-batch');
        
        component.queueEvent('second-batch', { batch: 2 });
        events = component.flushEvents();
        expect(events).toHaveLength(1);
        expect(events[0]!.type).toBe('second-batch');
    });

    test('should return empty array when no events to flush', () => {
        const component = new EventComponent();
        
        const events = component.flushEvents();
        expect(events).toHaveLength(0);
        expect(Array.isArray(events)).toBe(true);
    });
});