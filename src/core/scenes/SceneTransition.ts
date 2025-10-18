import type { Scene } from './Scene.ts';

export enum TransitionPhase {
    NONE = 'none',
    FADE_OUT = 'fade_out',
    TRANSITION = 'transition',
    FADE_IN = 'fade_in',
    COMPLETE = 'complete',
}

export interface TransitionCallbacks {
    onFadeOut?: (progress: number) => void | Promise<void>;
    onTransition?: (fromScene?: Scene, toScene?: Scene) => void | Promise<void>;
    onFadeIn?: (progress: number) => void | Promise<void>;
    onComplete?: () => void | Promise<void>;
}

export interface TransitionConfig {
    duration?: number;
    fadeOutDuration?: number;
    fadeInDuration?: number;
    callbacks?: TransitionCallbacks;
}

export interface TransitionState {
    phase: TransitionPhase;
    progress: number;
    fromScene?: Scene;
    toScene?: Scene;
}

const DEFAULT_TRANSITION_DURATION = 500;

export class SceneTransition {
    private phase: TransitionPhase = TransitionPhase.NONE;
    private progress = 0;
    private fadeOutDuration: number;
    private fadeInDuration: number;
    private callbacks: TransitionCallbacks;
    private fromScene?: Scene;
    private toScene?: Scene;

    constructor(config: TransitionConfig = {}) {
        const duration = config.duration ?? DEFAULT_TRANSITION_DURATION;
        this.fadeOutDuration = config.fadeOutDuration ?? duration / 2;
        this.fadeInDuration = config.fadeInDuration ?? duration / 2;
        this.callbacks = config.callbacks ?? {};
    }

    async execute(
        fromScene: Scene | undefined,
        toScene: Scene | undefined
    ): Promise<void> {
        this.fromScene = fromScene;
        this.toScene = toScene;
        this.phase = TransitionPhase.FADE_OUT;
        this.progress = 0;

        try {
            await this.fadeOut();
            await this.transition();
            await this.fadeIn();
            await this.complete();
        } catch (error) {
            this.phase = TransitionPhase.NONE;
            throw error;
        }
    }

    getState(): Readonly<TransitionState> {
        return {
            phase: this.phase,
            progress: this.progress,
            fromScene: this.fromScene,
            toScene: this.toScene,
        };
    }

    isActive(): boolean {
        return (
            this.phase !== TransitionPhase.NONE &&
            this.phase !== TransitionPhase.COMPLETE
        );
    }

    private async fadeOut(): Promise<void> {
        if (this.fadeOutDuration <= 0 || !this.callbacks.onFadeOut) {
            return;
        }

        this.phase = TransitionPhase.FADE_OUT;
        const steps = 20;
        const stepDuration = this.fadeOutDuration / steps;

        for (let i = 0; i <= steps; i++) {
            this.progress = i / steps;
            if (this.callbacks.onFadeOut) {
                await this.callbacks.onFadeOut(this.progress);
            }
            if (i < steps) {
                await this.sleep(stepDuration);
            }
        }
    }

    private async transition(): Promise<void> {
        this.phase = TransitionPhase.TRANSITION;
        this.progress = 0;

        if (this.callbacks.onTransition) {
            await this.callbacks.onTransition(this.fromScene, this.toScene);
        }

        this.progress = 1;
    }

    private async fadeIn(): Promise<void> {
        if (this.fadeInDuration <= 0 || !this.callbacks.onFadeIn) {
            return;
        }

        this.phase = TransitionPhase.FADE_IN;
        const steps = 20;
        const stepDuration = this.fadeInDuration / steps;

        for (let i = 0; i <= steps; i++) {
            this.progress = i / steps;
            if (this.callbacks.onFadeIn) {
                await this.callbacks.onFadeIn(this.progress);
            }
            if (i < steps) {
                await this.sleep(stepDuration);
            }
        }
    }

    private async complete(): Promise<void> {
        this.phase = TransitionPhase.COMPLETE;
        this.progress = 1;

        if (this.callbacks.onComplete) {
            await this.callbacks.onComplete();
        }

        this.phase = TransitionPhase.NONE;
    }

    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
