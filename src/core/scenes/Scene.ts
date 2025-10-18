import { World } from '../ecs/World.ts';

export enum SceneState {
    UNLOADED = 'unloaded',
    LOADING = 'loading',
    LOADED = 'loaded',
    ACTIVE = 'active',
    PAUSED = 'paused',
    UNLOADING = 'unloading',
}

export interface SceneLifecycleHooks {
    onLoad?: (world: World) => void | Promise<void>;
    onUnload?: (world: World) => void | Promise<void>;
    onEnter?: (world: World, previousScene?: Scene) => void | Promise<void>;
    onExit?: (world: World, nextScene?: Scene) => void | Promise<void>;
    onPause?: (world: World) => void | Promise<void>;
    onResume?: (world: World) => void | Promise<void>;
}

export interface SceneConfig {
    name: string;
    id?: string;
    preload?: boolean;
    persistent?: boolean;
    lifecycle?: SceneLifecycleHooks;
}

export interface LoadProgress {
    total: number;
    loaded: number;
    percentage: number;
    message?: string;
}

export class Scene {
    readonly name: string;
    readonly id: string;
    readonly persistent: boolean;
    private world: World;
    private state: SceneState = SceneState.UNLOADED;
    private lifecycle: SceneLifecycleHooks;
    private loadProgress: LoadProgress = {
        total: 100,
        loaded: 0,
        percentage: 0,
    };

    constructor(config: SceneConfig) {
        this.name = config.name;
        this.id = config.id ?? crypto.randomUUID();
        this.persistent = config.persistent ?? false;
        this.lifecycle = config.lifecycle ?? {};
        this.world = new World();
    }

    getWorld(): World {
        return this.world;
    }

    getState(): SceneState {
        return this.state;
    }

    isLoaded(): boolean {
        return (
            this.state === SceneState.LOADED ||
            this.state === SceneState.ACTIVE ||
            this.state === SceneState.PAUSED
        );
    }

    isActive(): boolean {
        return this.state === SceneState.ACTIVE;
    }

    isPaused(): boolean {
        return this.state === SceneState.PAUSED;
    }

    getLoadProgress(): Readonly<LoadProgress> {
        return { ...this.loadProgress };
    }

    updateProgress(loaded: number, total: number, message?: string): void {
        this.loadProgress = {
            total,
            loaded,
            percentage: total > 0 ? (loaded / total) * 100 : 0,
            message,
        };
    }

    async load(): Promise<void> {
        if (this.isLoaded()) {
            return;
        }

        this.state = SceneState.LOADING;
        this.updateProgress(0, 100, 'Loading scene...');

        try {
            if (this.lifecycle.onLoad) {
                await this.lifecycle.onLoad(this.world);
            }
            this.updateProgress(100, 100, 'Scene loaded');
            this.state = SceneState.LOADED;
        } catch (error) {
            this.state = SceneState.UNLOADED;
            throw new Error(
                `Failed to load scene "${this.name}": ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    async unload(): Promise<void> {
        if (this.state === SceneState.UNLOADED) {
            return;
        }

        this.state = SceneState.UNLOADING;

        try {
            if (this.lifecycle.onUnload) {
                await this.lifecycle.onUnload(this.world);
            }

            if (!this.persistent) {
                this.world.shutdown();
                this.world = new World();
            }

            this.state = SceneState.UNLOADED;
            this.updateProgress(0, 100);
        } catch (error) {
            throw new Error(
                `Failed to unload scene "${this.name}": ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    async enter(previousScene?: Scene): Promise<void> {
        if (this.state !== SceneState.LOADED) {
            throw new Error(
                `Cannot enter scene "${this.name}" - scene must be loaded first`
            );
        }

        try {
            if (this.lifecycle.onEnter) {
                await this.lifecycle.onEnter(this.world, previousScene);
            }
            this.state = SceneState.ACTIVE;
        } catch (error) {
            throw new Error(
                `Failed to enter scene "${this.name}": ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    async exit(nextScene?: Scene): Promise<void> {
        if (
            this.state !== SceneState.ACTIVE &&
            this.state !== SceneState.PAUSED
        ) {
            return;
        }

        try {
            if (this.lifecycle.onExit) {
                await this.lifecycle.onExit(this.world, nextScene);
            }
            this.state = SceneState.LOADED;
        } catch (error) {
            throw new Error(
                `Failed to exit scene "${this.name}": ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    async pause(): Promise<void> {
        if (this.state !== SceneState.ACTIVE) {
            return;
        }

        try {
            if (this.lifecycle.onPause) {
                await this.lifecycle.onPause(this.world);
            }
            this.state = SceneState.PAUSED;
        } catch (error) {
            throw new Error(
                `Failed to pause scene "${this.name}": ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    async resume(): Promise<void> {
        if (this.state !== SceneState.PAUSED) {
            return;
        }

        try {
            if (this.lifecycle.onResume) {
                await this.lifecycle.onResume(this.world);
            }
            this.state = SceneState.ACTIVE;
        } catch (error) {
            throw new Error(
                `Failed to resume scene "${this.name}": ${error instanceof Error ? error.message : String(error)}`
            );
        }
    }

    update(deltaTime: number): void {
        if (this.state === SceneState.ACTIVE) {
            this.world.update(deltaTime);
        }
    }
}
