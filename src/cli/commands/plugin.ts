import { join } from 'node:path';
import inquirer from 'inquirer';
import {
    PLUGIN_TEMPLATE,
    PLUGIN_TEST_TEMPLATE,
    type PluginTemplateVars,
} from '../templates/plugin.template.ts';
import {
    addToIndexFile,
    createFiles,
    type FileToCreate,
    validateFileName,
} from '../utils/file-operations.ts';
import { analyzeProject } from '../utils/project-analysis.ts';
import { renderTemplate } from '../utils/template-engine.ts';

interface PluginTemplate {
    name: string;
    description: string;
    value: string;
}

interface PluginData {
    name: string;
    description: string;
    features?: string[];
    initializeBody: string;
    shutdownBody: string;
    customMethods: string;
    privateFields: string;
}

const PLUGIN_TEMPLATES: PluginTemplate[] = [
    {
        name: 'Storage Plugin - Save/load game state',
        description:
            'A plugin for persisting game state to localStorage or files',
        value: 'storage',
    },
    {
        name: 'Network Plugin - Multiplayer functionality',
        description:
            'A plugin for network communication and multiplayer features',
        value: 'network',
    },
    {
        name: 'Audio Plugin - Sound and music management',
        description: 'A plugin for managing audio playback and sound effects',
        value: 'audio',
    },
    {
        name: 'Analytics Plugin - Game metrics and telemetry',
        description: 'A plugin for collecting and sending game analytics data',
        value: 'analytics',
    },
    {
        name: 'Debug Plugin - Development tools and debugging',
        description: 'A plugin for debugging tools and development utilities',
        value: 'debug',
    },
    {
        name: 'Custom Plugin - Design your own plugin',
        description: 'A custom plugin template',
        value: 'custom',
    },
];

export async function pluginCommand(): Promise<void> {
    console.log('🔧 Plugin Scaffolding\\n');

    const structure = analyzeProject();

    const answers = await inquirer.prompt([
        {
            type: 'list',
            name: 'template',
            message: 'Select plugin template:',
            choices: PLUGIN_TEMPLATES,
            pageSize: PLUGIN_TEMPLATES.length,
        },
    ]);

    let pluginData: PluginData;

    if (answers.template === 'custom') {
        pluginData = await createCustomPlugin();
    } else {
        pluginData = getPrebuiltPlugin(answers.template);
    }

    const nameAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Plugin name:',
            default: `${pluginData.name}Plugin`,
            validate: (input: string) => {
                try {
                    validateFileName(input);
                    const pluginName = input.endsWith('Plugin')
                        ? input
                        : `${input}Plugin`;

                    if (structure.existingPlugins.includes(pluginName)) {
                        return `Plugin ${pluginName} already exists`;
                    }

                    return true;
                } catch (error) {
                    return (error as Error).message;
                }
            },
        },
    ]);

    const versionAnswer = await inquirer.prompt([
        {
            type: 'input',
            name: 'version',
            message: 'Plugin version:',
            default: '1.0.0',
            validate: (input: string) => {
                if (!/^\\d+\\.\\d+\\.\\d+$/.test(input)) {
                    return 'Version must be in format x.y.z (e.g., 1.0.0)';
                }
                return true;
            },
        },
    ]);

    const dependenciesAnswer = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'dependencies',
            message: 'Select plugin dependencies:',
            choices: structure.existingPlugins
                .filter((p) => p !== nameAnswer.name)
                .map((plugin) => ({ name: plugin, value: plugin })),
        },
    ]);

    const generateTestsAnswer = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'generateTests',
            message: 'Generate test file?',
            default: true,
        },
    ]);

    const pluginName = nameAnswer.name.endsWith('Plugin')
        ? nameAnswer.name
        : `${nameAnswer.name}Plugin`;
    const pluginFile = pluginName;

    // Generate template variables
    const templateVars = buildTemplateVars(
        pluginName,
        pluginFile,
        versionAnswer.version,
        dependenciesAnswer.dependencies,
        pluginData
    );

    // Create files
    const filesToCreate: FileToCreate[] = [
        {
            path: join(structure.pluginsDir, `${pluginFile}.ts`),
            content: renderTemplate(PLUGIN_TEMPLATE, templateVars),
        },
    ];

    if (generateTestsAnswer.generateTests) {
        filesToCreate.push({
            path: join(structure.pluginsDir, `${pluginFile}.test.ts`),
            content: renderTemplate(PLUGIN_TEST_TEMPLATE, templateVars),
        });
    }

    createFiles(filesToCreate);

    // Update index file
    const exportLine = `export { ${pluginName} } from './${pluginFile}.ts';`;
    addToIndexFile(join(structure.pluginsDir, 'index.ts'), exportLine);

    console.log(`\\n✅ Created plugin: ${pluginName}`);
    console.log(`📁 Files created:`);
    for (const file of filesToCreate) {
        console.log(`   - ${file.path}`);
    }
    if (dependenciesAnswer.dependencies.length > 0) {
        console.log(
            `🔗 Dependencies: ${dependenciesAnswer.dependencies.join(', ')}`
        );
    }
    console.log(`\\n💡 To use this plugin:`);
    console.log(`   const plugin = new ${pluginName}();`);
    console.log(`   world.addPlugin(plugin);`);
}

async function createCustomPlugin(): Promise<PluginData> {
    console.log('\\n📝 Custom Plugin Configuration:');

    const customAnswers = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Plugin base name (without "Plugin" suffix):',
            validate: (input: string) =>
                input.trim() ? true : 'Name cannot be empty',
        },
        {
            type: 'input',
            name: 'description',
            message: 'Plugin description:',
            validate: (input: string) =>
                input.trim() ? true : 'Description cannot be empty',
        },
    ]);

    const featuresAnswer = await inquirer.prompt([
        {
            type: 'checkbox',
            name: 'features',
            message: 'Select plugin features:',
            choices: [
                { name: 'Event handling', value: 'events' },
                { name: 'Component management', value: 'components' },
                { name: 'System integration', value: 'systems' },
                { name: 'External API integration', value: 'api' },
                { name: 'File operations', value: 'files' },
                { name: 'Configuration management', value: 'config' },
            ],
        },
    ]);

    return {
        name: customAnswers.name,
        description: customAnswers.description,
        features: featuresAnswer.features,
        initializeBody: buildCustomInitialize(featuresAnswer.features),
        shutdownBody: buildCustomShutdown(featuresAnswer.features),
        customMethods: buildCustomMethods(featuresAnswer.features),
        privateFields: buildCustomFields(featuresAnswer.features),
    };
}

function getPrebuiltPlugin(templateType: string): PluginData {
    switch (templateType) {
        case 'storage':
            return {
                name: 'Storage',
                description: 'A plugin for persisting game state',
                initializeBody: `
        // Set up storage backend
        console.log('Setting up storage backend...');

        // Register storage events
        if (this.world) {
            // TODO: Set up event listeners for save/load operations
        }`,
                shutdownBody: `
        // Clean up storage resources
        console.log('Cleaning up storage resources...');

        // TODO: Flush any pending saves and close connections`,
                customMethods: `

    saveGameState(key: string, data: unknown): boolean {
        try {
            const serialized = JSON.stringify(data);
            localStorage.setItem(\`ecs-game-\${key}\`, serialized);
            console.log(\`Game state saved to key: \${key}\`);
            return true;
        } catch (error) {
            console.error('Failed to save game state:', error);
            return false;
        }
    }

    loadGameState(key: string): unknown {
        try {
            const data = localStorage.getItem(\`ecs-game-\${key}\`);
            if (data) {
                const parsed = JSON.parse(data);
                console.log(\`Game state loaded from key: \${key}\`);
                return parsed;
            }
            return null;
        } catch (error) {
            console.error('Failed to load game state:', error);
            return null;
        }
    }

    deleteGameState(key: string): boolean {
        try {
            localStorage.removeItem(\`ecs-game-\${key}\`);
            console.log(\`Game state deleted for key: \${key}\`);
            return true;
        } catch (error) {
            console.error('Failed to delete game state:', error);
            return false;
        }
    }`,
                privateFields: `
    private storageBackend: 'localStorage' | 'file' = 'localStorage';`,
            };

        case 'network':
            return {
                name: 'Network',
                description: 'A plugin for network communication',
                initializeBody: `
        // Set up network connection
        console.log('Setting up network connection...');

        // TODO: Initialize WebSocket or other network protocols
        if (this.world) {
            // Register network event handlers
        }`,
                shutdownBody: `
        // Close network connections
        console.log('Closing network connections...');

        // TODO: Clean up network resources and close connections`,
                customMethods: `

    sendMessage(message: unknown): boolean {
        try {
            // TODO: Implement network message sending
            console.log('Sending network message:', message);
            return true;
        } catch (error) {
            console.error('Failed to send network message:', error);
            return false;
        }
    }

    onMessageReceived(callback: (message: unknown) => void): void {
        // TODO: Register callback for received messages
        console.log('Registered network message handler');
    }

    disconnect(): void {
        // TODO: Disconnect from network
        console.log('Disconnecting from network...');
    }`,
                privateFields: `
    private isConnected: boolean = false;
    private messageHandlers: Array<(message: unknown) => void> = [];`,
            };

        case 'debug':
            return {
                name: 'Debug',
                description: 'A plugin for debugging and development tools',
                initializeBody: `
        // Set up debug tools
        console.log('Setting up debug tools...');

        if (this.world) {
            // Register debug commands
            this.registerDebugCommands();
        }`,
                shutdownBody: `
        // Clean up debug resources
        console.log('Cleaning up debug resources...');

        // TODO: Remove debug UI and event listeners`,
                customMethods: `

    private registerDebugCommands(): void {
        // TODO: Register debug commands
        console.log('Debug commands registered');
    }

    logWorldState(): void {
        if (!this.world) return;

        console.log('=== World Debug State ===');
        console.log('Entity count:', this.world.getEntityCount());
        console.log('Component types:', this.world.getComponentTypes());
        console.log('Archetype stats:', this.world.getArchetypeStats());
        console.log('========================');
    }

    enableDebugMode(enabled: boolean): void {
        this.debugMode = enabled;
        console.log(\`Debug mode \${enabled ? 'enabled' : 'disabled'}\`);
    }`,
                privateFields: `
    private debugMode: boolean = false;
    private debugCommands: Map<string, () => void> = new Map();`,
            };

        default:
            return getPrebuiltPlugin('storage');
    }
}

function buildTemplateVars(
    pluginName: string,
    pluginFile: string,
    version: string,
    dependencies: string[],
    pluginData: PluginData
): PluginTemplateVars {
    let dependenciesStr = '';
    let testMethods = '';

    if (dependencies.length > 0) {
        dependenciesStr = `\\n    readonly dependencies = [${dependencies.map((d) => `'${d}'`).join(', ')}];`;
    }

    // Build test methods
    if (pluginData.customMethods) {
        testMethods = `\\n\\n    test('should have custom methods', () => {
        const plugin = new ${pluginName}();

        // Test that custom methods exist
        expect(typeof plugin.saveGameState).toBe('function');
        expect(typeof plugin.loadGameState).toBe('function');
    });`;
    }

    return {
        pluginName,
        pluginFile,
        version,
        dependencies: dependenciesStr,
        privateFields: pluginData.privateFields || '',
        initializeBody:
            pluginData.initializeBody ||
            '\\n        // TODO: Add plugin initialization logic here',
        shutdownBody:
            pluginData.shutdownBody ||
            '\\n        // TODO: Add plugin cleanup logic here',
        customMethods: pluginData.customMethods || '',
        testMethods,
    };
}

function buildCustomInitialize(features: string[]): string {
    let body = '';

    if (features.includes('events')) {
        body +=
            "\n        // Set up event handling\n        console.log('Setting up event handlers...');";
    }

    if (features.includes('components')) {
        body +=
            "\n        // Set up component management\n        console.log('Setting up component management...');";
    }

    if (features.includes('systems')) {
        body +=
            "\n        // Set up system integration\n        console.log('Setting up system integration...');";
    }

    if (features.includes('api')) {
        body +=
            "\n        // Set up API integration\n        console.log('Setting up external API integration...');";
    }

    if (features.includes('files')) {
        body +=
            "\n        // Set up file operations\n        console.log('Setting up file operations...');";
    }

    if (features.includes('config')) {
        body +=
            "\n        // Set up configuration management\n        console.log('Setting up configuration management...');";
    }

    return body || '\n        // TODO: Add plugin initialization logic here';
}

function buildCustomShutdown(features: string[]): string {
    let body = '';

    if (features.includes('events')) {
        body +=
            "\n        // Clean up event handlers\n        console.log('Cleaning up event handlers...');";
    }

    if (features.includes('api')) {
        body +=
            "\n        // Close API connections\n        console.log('Closing API connections...');";
    }

    if (features.includes('files')) {
        body +=
            "\n        // Close file handles\n        console.log('Closing file handles...');";
    }

    return body || '\n        // TODO: Add plugin cleanup logic here';
}

function buildCustomMethods(features: string[]): string {
    let methods = '';

    if (features.includes('config')) {
        methods += `\n\n    setConfig(key: string, value: unknown): void {
        // TODO: Implement configuration setting
        console.log(\`Setting config \${key} = \${value}\`);
    }

    getConfig(key: string): unknown {
        // TODO: Implement configuration getting
        console.log(\`Getting config \${key}\`);
        return null;
    }`;
    }

    if (features.includes('api')) {
        methods += `\n\n    callExternalAPI(endpoint: string, data?: unknown): Promise<unknown> {
        // TODO: Implement external API calls
        console.log(\`Calling API endpoint: \${endpoint}\`);
        return Promise.resolve({});
    }`;
    }

    return methods;
}

function buildCustomFields(features: string[]): string {
    let fields = '';

    if (features.includes('config')) {
        fields += '\n    private config: Map<string, unknown> = new Map();';
    }

    if (features.includes('events')) {
        fields +=
            '\n    private eventHandlers: Map<string, Function[]> = new Map();';
    }

    return fields;
}
