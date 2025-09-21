import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { extname, join } from 'node:path';
import { getProjectRoot } from './file-operations.ts';

export interface ProjectStructure {
    componentsDir: string;
    systemsDir: string;
    examplesDir: string;
    pluginsDir: string;
    coreDir: string;
    existingComponents: string[];
    existingSystems: string[];
    existingExamples: string[];
    existingPlugins: string[];
}

export function analyzeProject(): ProjectStructure {
    const root = getProjectRoot();
    const srcDir = join(root, 'src');

    const structure: ProjectStructure = {
        componentsDir: join(srcDir, 'components'),
        systemsDir: join(srcDir, 'systems'),
        examplesDir: join(root, 'examples'),
        pluginsDir: join(srcDir, 'core', 'plugins'),
        coreDir: join(srcDir, 'core'),
        existingComponents: [],
        existingSystems: [],
        existingExamples: [],
        existingPlugins: [],
    };

    // Analyze existing components
    if (existsSync(structure.componentsDir)) {
        structure.existingComponents = readdirSync(structure.componentsDir)
            .filter((file) => extname(file) === '.ts' && file !== 'index.ts')
            .map((file) => file.replace('.ts', ''));
    }

    // Analyze existing systems
    if (existsSync(structure.systemsDir)) {
        structure.existingSystems = readdirSync(structure.systemsDir)
            .filter((file) => extname(file) === '.ts' && file !== 'index.ts')
            .map((file) => file.replace('.ts', ''));
    }

    // Analyze existing examples
    if (existsSync(structure.examplesDir)) {
        structure.existingExamples = readdirSync(structure.examplesDir)
            .filter((file) => extname(file) === '.ts')
            .map((file) => file.replace('.ts', ''));
    }

    // Analyze existing plugins
    if (existsSync(structure.pluginsDir)) {
        structure.existingPlugins = readdirSync(structure.pluginsDir)
            .filter(
                (file) =>
                    extname(file) === '.ts' &&
                    file !== 'index.ts' &&
                    !file.includes('.test.')
            )
            .map((file) => file.replace('.ts', ''));
    }

    return structure;
}

export function getExistingComponentTypes(): string[] {
    try {
        const structure = analyzeProject();
        const componentTypes: string[] = [];

        structure.existingComponents.forEach((componentFile) => {
            const filePath = join(
                structure.componentsDir,
                `${componentFile}.ts`
            );
            if (existsSync(filePath)) {
                const content = readFileSync(filePath, 'utf-8');
                const typeMatch = content.match(
                    /readonly type: ['"]([^'"]+)['"]/
                );
                if (typeMatch?.[1]) {
                    componentTypes.push(typeMatch[1]);
                }
            }
        });

        return componentTypes;
    } catch {
        return [];
    }
}

export function getExistingSystemNames(): string[] {
    try {
        const structure = analyzeProject();
        const systemNames: string[] = [];

        structure.existingSystems.forEach((systemFile) => {
            const filePath = join(structure.systemsDir, `${systemFile}.ts`);
            if (existsSync(filePath)) {
                const content = readFileSync(filePath, 'utf-8');
                const nameMatch = content.match(
                    /readonly name = ['"]([^'"]+)['"]/
                );
                if (nameMatch?.[1]) {
                    systemNames.push(nameMatch[1]);
                }
            }
        });

        return systemNames;
    } catch {
        return [];
    }
}
