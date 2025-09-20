import type { Component } from '../core/ecs/Component';

export interface PositionComponent extends Component {
    readonly type: 'position';
    x: number;
    y: number;
    z?: number;
}

export function createPositionComponent(
    x: number,
    y: number,
    z = 0
): PositionComponent {
    return {
        type: 'position',
        x,
        y,
        z,
    };
}
