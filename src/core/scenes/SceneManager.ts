import { Scene, type SceneConfig } from './Scene.ts';
import {
    SceneTransition,
    type TransitionCallbacks,
    type TransitionConfig,
} from './SceneTransition.ts';

export interface SceneManagerConfig {
    defaultTransition?: TransitionConfig;
}

export interface SceneRegistration {
    scene: Scene;
    preload: boolean;
}

export interface SceneManagerStats {
    totalScenes: number;
    loadedScenes: number;
    activeScene: string | null;
    preloadedScenes: string[];
}

export type SceneLoadProgressCallback = (
    sceneName: string,
    progress: number,
    message?: string
) => void;

export class SceneManager {
    private scenes = new Map<string, SceneRegistration>();
    private activeScene: Scene | undefined;
    private defaultTransition: TransitionConfig;
    private currentTransition: SceneTransition | undefined;
    private progressCallbacks = new Set<SceneLoadProgressCallback>();

    constructor(config: SceneManagerConfig = {}) {
        this.defaultTransition = config.defaultTransition ?? {};
    }

    registerScene(config: SceneConfig): Scene {
        if (this.scenes.has(config.name)) {
            throw new Error(`Scene "${config.name}" is already registered`);
        }

        const scene = new Scene(config);
        const registration: SceneRegistration = {
            scene,
            preload: config.preload ?? false,
        };

        this.scenes.set(config.name, registration);

        if (registration.preload) {
            void this.preloadScene(config.name);
        }

        return scene;
    }

    unregisterScene(sceneName: string): boolean {
        const registration = this.scenes.get(sceneName);
        if (!registration) {
            return false;
        }

        if (registration.scene === this.activeScene) {
            throw new Error(
                `Cannot unregister active scene "${sceneName}". Switch to another scene first.`
            );
        }

        if (registration.scene.isLoaded()) {
            void registration.scene.unload();
        }

        return this.scenes.delete(sceneName);
    }

    getScene(sceneName: string): Scene | undefined {
        return this.scenes.get(sceneName)?.scene;
    }

    getActiveScene(): Scene | undefined {
        return this.activeScene;
    }

    getSceneNames(): string[] {
        return Array.from(this.scenes.keys());
    }

    hasScene(sceneName: string): boolean {
        return this.scenes.has(sceneName);
    }

    isSceneLoaded(sceneName: string): boolean {
        const registration = this.scenes.get(sceneName);
        return registration?.scene.isLoaded() ?? false;
    }

    isSceneActive(sceneName: string): boolean {
        const registration = this.scenes.get(sceneName);
        return (
            registration !== undefined &&
            registration.scene === this.activeScene &&
            registration.scene.isActive()
        );
    }

    async preloadScene(sceneName: string): Promise<void> {
        const registration = this.scenes.get(sceneName);
        if (!registration) {
            throw new Error(`Scene "${sceneName}" not found`);
        }

        if (registration.scene.isLoaded()) {
            return;
        }

        await this.loadSceneWithProgress(registration.scene);
    }

    async preloadScenes(sceneNames: string[]): Promise<void> {
        const promises = sceneNames.map((name) => this.preloadScene(name));
        await Promise.all(promises);
    }

    async switchTo(
        sceneName: string,
        transition?: TransitionConfig | TransitionCallbacks
    ): Promise<void> {
        const registration = this.scenes.get(sceneName);
        if (!registration) {
            throw new Error(`Scene "${sceneName}" not found`);
        }

        const nextScene = registration.scene;
        const previousScene = this.activeScene;

        if (previousScene === nextScene) {
            return;
        }

        if (this.currentTransition?.isActive()) {
            throw new Error('A scene transition is already in progress');
        }

        const transitionConfig = this.resolveTransitionConfig(transition);
        this.currentTransition = new SceneTransition(transitionConfig);

        try {
            if (!nextScene.isLoaded()) {
                await this.loadSceneWithProgress(nextScene);
            }

            await this.executeTransition(previousScene, nextScene);

            if (previousScene && !previousScene.persistent) {
                await previousScene.unload();
            }
        } finally {
            this.currentTransition = undefined;
        }
    }

    async unloadScene(sceneName: string): Promise<void> {
        const registration = this.scenes.get(sceneName);
        if (!registration) {
            throw new Error(`Scene "${sceneName}" not found`);
        }

        if (registration.scene === this.activeScene) {
            throw new Error(
                `Cannot unload active scene "${sceneName}". Switch to another scene first.`
            );
        }

        await registration.scene.unload();
    }

    async unloadInactiveScenes(except: string[] = []): Promise<void> {
        const promises: Promise<void>[] = [];

        for (const [name, registration] of this.scenes) {
            if (
                registration.scene !== this.activeScene &&
                registration.scene.isLoaded() &&
                !registration.scene.persistent &&
                !except.includes(name)
            ) {
                promises.push(registration.scene.unload());
            }
        }

        await Promise.all(promises);
    }

    update(deltaTime: number): void {
        if (this.activeScene) {
            this.activeScene.update(deltaTime);
        }
    }

    async pauseActiveScene(): Promise<void> {
        if (this.activeScene) {
            await this.activeScene.pause();
        }
    }

    async resumeActiveScene(): Promise<void> {
        if (this.activeScene) {
            await this.activeScene.resume();
        }
    }

    onLoadProgress(callback: SceneLoadProgressCallback): () => void {
        this.progressCallbacks.add(callback);
        return () => this.progressCallbacks.delete(callback);
    }

    getStats(): SceneManagerStats {
        let loadedScenes = 0;
        const preloadedScenes: string[] = [];

        for (const [name, registration] of this.scenes) {
            if (registration.scene.isLoaded()) {
                loadedScenes++;
                if (
                    registration.preload &&
                    registration.scene !== this.activeScene
                ) {
                    preloadedScenes.push(name);
                }
            }
        }

        return {
            totalScenes: this.scenes.size,
            loadedScenes,
            activeScene: this.activeScene?.name ?? null,
            preloadedScenes,
        };
    }

    async shutdown(): Promise<void> {
        if (this.activeScene) {
            await this.activeScene.exit();
            this.activeScene = undefined;
        }

        const unloadPromises: Promise<void>[] = [];
        for (const registration of this.scenes.values()) {
            if (registration.scene.isLoaded()) {
                unloadPromises.push(registration.scene.unload());
            }
        }

        await Promise.all(unloadPromises);
        this.scenes.clear();
    }

    private async loadSceneWithProgress(scene: Scene): Promise<void> {
        const progressInterval = setInterval(() => {
            const progress = scene.getLoadProgress();
            this.notifyProgress(
                scene.name,
                progress.percentage,
                progress.message
            );
        }, 50);

        try {
            await scene.load();
            this.notifyProgress(scene.name, 100, 'Scene loaded');
        } finally {
            clearInterval(progressInterval);
        }
    }

    private async executeTransition(
        previousScene: Scene | undefined,
        nextScene: Scene
    ): Promise<void> {
        if (!this.currentTransition) {
            return;
        }

        await this.currentTransition.execute(previousScene, nextScene);

        if (previousScene) {
            await previousScene.exit(nextScene);
        }

        await nextScene.enter(previousScene);
        this.activeScene = nextScene;
    }

    private resolveTransitionConfig(
        transition?: TransitionConfig | TransitionCallbacks
    ): TransitionConfig {
        if (!transition) {
            return this.defaultTransition;
        }

        if (
            'onFadeOut' in transition ||
            'onFadeIn' in transition ||
            'onTransition' in transition
        ) {
            return {
                ...this.defaultTransition,
                callbacks: transition as TransitionCallbacks,
            };
        }

        return transition as TransitionConfig;
    }

    private notifyProgress(
        sceneName: string,
        progress: number,
        message?: string
    ): void {
        for (const callback of this.progressCallbacks) {
            callback(sceneName, progress, message);
        }
    }
}
