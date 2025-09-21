#!/usr/bin/env bun

import inquirer from 'inquirer';
import { componentCommand } from './commands/component.ts';
import { exampleCommand } from './commands/example.ts';
import { gameCommand } from './commands/game.ts';
import { pluginCommand } from './commands/plugin.ts';
import { systemCommand } from './commands/system.ts';

interface ScaffoldChoice {
    name: string;
    value: string;
    description: string;
}

interface ParsedArgs {
    command?: string;
    flags: Set<string>;
    options: Record<string, string>;
    args: string[];
}

const SCAFFOLD_TYPES: ScaffoldChoice[] = [
    {
        name: 'Component - Generate ECS component with interface and factory',
        value: 'component',
        description: 'Create a new component following ECS patterns',
    },
    {
        name: 'System - Generate ECS system extending BaseSystem',
        value: 'system',
        description: 'Create a new system with proper lifecycle methods',
    },
    {
        name: 'Example - Generate complete usage example',
        value: 'example',
        description:
            'Create a new example demonstrating specific functionality',
    },
    {
        name: 'Game Template - Generate complete game setup',
        value: 'game',
        description: 'Create a full game template with components and systems',
    },
    {
        name: 'Plugin - Generate plugin following plugin architecture',
        value: 'plugin',
        description:
            'Create a new plugin with lifecycle and integration patterns',
    },
];

const COMMAND_ALIASES = new Map([
    ['c', 'component'],
    ['comp', 'component'],
    ['s', 'system'],
    ['sys', 'system'],
    ['e', 'example'],
    ['ex', 'example'],
    ['g', 'game'],
    ['game-template', 'game'],
    ['p', 'plugin'],
    ['plug', 'plugin'],
]);

function parseArgs(argv: string[]): ParsedArgs {
    const args = argv.slice(2); // Remove 'bun' and script path
    const flags = new Set<string>();
    const options: Record<string, string> = {};
    const remaining: string[] = [];
    let command: string | undefined;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === undefined) continue;

        if (arg.startsWith('--')) {
            const flagName = arg.slice(2);
            if (flagName.includes('=')) {
                const [key, value] = flagName.split('=', 2);
                if (key && value !== undefined) {
                    options[key] = value;
                }
            } else {
                flags.add(flagName);
            }
        } else if (arg.startsWith('-')) {
            const flagName = arg.slice(1);
            flags.add(flagName);
        } else {
            // First non-flag argument is the command
            if (!command) {
                command = COMMAND_ALIASES.get(arg) || arg;
            } else {
                remaining.push(arg);
            }
        }
    }

    return {
        command,
        flags,
        options,
        args: remaining,
    };
}

function showHelp(): void {
    console.log('🎮 ECS Game Engine Scaffolding Tool\n');
    console.log('USAGE:');
    console.log('  bun run scaffold [command] [options]');
    console.log('  bun run scaffold [flags]\n');

    console.log('COMMANDS:');
    console.log(
        '  component, c, comp     Generate ECS component with interface and factory'
    );
    console.log(
        '  system, s, sys         Generate ECS system extending BaseSystem'
    );
    console.log('  example, e, ex         Generate complete usage example');
    console.log('  game, g, game-template Generate complete game setup');
    console.log(
        '  plugin, p, plug        Generate plugin following plugin architecture\n'
    );

    console.log('FLAGS:');
    console.log('  --help, -h             Show this help message');
    console.log('  --version, -v          Show version information');
    console.log(
        '  --interactive, -i      Force interactive mode (default when no command)\n'
    );

    console.log('EXAMPLES:');
    console.log('  bun run scaffold                    # Interactive mode');
    console.log(
        '  bun run scaffold component          # Generate component interactively'
    );
    console.log(
        '  bun run scaffold c                  # Generate component (alias)'
    );
    console.log(
        '  bun run scaffold system             # Generate system interactively'
    );
    console.log('  bun run scaffold --help             # Show this help\n');

    console.log(
        'For more information, visit: https://github.com/danjdewhurst/ecs-ts'
    );
}

function showVersion(): void {
    // Could read from package.json, but keeping it simple for now
    console.log('ECS Game Engine Scaffolding Tool v0.8.3');
}

async function runInteractiveMode(): Promise<void> {
    console.log('🎮 ECS Game Engine Scaffolding Tool\n');

    const { scaffoldType } = await inquirer.prompt([
        {
            type: 'list',
            name: 'scaffoldType',
            message: 'What would you like to scaffold?',
            choices: SCAFFOLD_TYPES,
            pageSize: SCAFFOLD_TYPES.length,
        },
    ]);

    console.log('');
    await executeCommand(scaffoldType);
}

async function executeCommand(command: string): Promise<void> {
    switch (command) {
        case 'component':
            await componentCommand();
            break;
        case 'system':
            await systemCommand();
            break;
        case 'example':
            await exampleCommand();
            break;
        case 'game':
            await gameCommand();
            break;
        case 'plugin':
            await pluginCommand();
            break;
        default:
            console.error(`❌ Unknown scaffold type: ${command}`);
            console.log('Use --help to see available commands');
            process.exit(1);
    }
}

async function main(): Promise<void> {
    try {
        const parsed = parseArgs(process.argv);

        // Handle flags
        if (parsed.flags.has('help') || parsed.flags.has('h')) {
            showHelp();
            return;
        }

        if (parsed.flags.has('version') || parsed.flags.has('v')) {
            showVersion();
            return;
        }

        // Interactive mode if no command or explicit interactive flag
        if (
            !parsed.command ||
            parsed.flags.has('interactive') ||
            parsed.flags.has('i')
        ) {
            await runInteractiveMode();
        } else {
            // Non-interactive mode with direct command
            console.log('🎮 ECS Game Engine Scaffolding Tool\n');
            await executeCommand(parsed.command);
        }

        console.log('\n✅ Scaffolding completed successfully!');
        console.log('💡 Run `bun run check:fix` to format the generated code.');
        console.log(
            '💡 Run `bun test` to ensure everything is working correctly.'
        );
    } catch (error) {
        if (
            error instanceof Error &&
            error.message.includes('User force closed the prompt')
        ) {
            console.log('\n👋 Scaffolding cancelled.');
            process.exit(0);
        }
        console.error('\n❌ Scaffolding failed:', error);
        process.exit(1);
    }
}

if (import.meta.main) {
    main();
}
