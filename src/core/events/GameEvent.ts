export interface GameEvent {
    readonly type: string;
    readonly timestamp: number;
    readonly source?: string;
    readonly data: Record<string, unknown>;
}
