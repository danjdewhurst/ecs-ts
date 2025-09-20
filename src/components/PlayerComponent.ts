import type { Component } from '../core/ecs/Component';

export interface PlayerComponent extends Component {
    readonly type: 'player';
    readonly clientId: string;
    name: string;
    health: number;
    maxHealth: number;
    score: number;
}

export function createPlayerComponent(
    clientId: string,
    name: string,
    maxHealth = 100
): PlayerComponent {
    return {
        type: 'player',
        clientId,
        name,
        health: maxHealth,
        maxHealth,
        score: 0,
    };
}
