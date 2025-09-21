import { join } from 'node:path';
import inquirer from 'inquirer';
import {
    SYSTEM_TEMPLATE,
    SYSTEM_TEST_TEMPLATE,
    type SystemTemplateVars,
} from '../templates/system.template.ts';
import {
    addToIndexFile,
    createFiles,
    type FileToCreate,
    validateFileName,
} from '../utils/file-operations.ts';
import {
    analyzeProject,
    getExistingComponentTypes,
    getExistingSystemNames,
} from '../utils/project-analysis.ts';
import { renderTemplate, toPascalCase } from '../utils/template-engine.ts';

interface SystemQueryPattern {
    components: string[];
    type: 'simple' | 'callback';
}

export async function systemCommand(): Promise<void> {
    console.log('🔧 System Scaffolding\n');

    const structure = analyzeProject();
    const existingSystemNames = getExistingSystemNames();
    const existingComponentTypes = getExistingComponentTypes();

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'System name (e.g., "Movement", "Health"):',
            validate: (input: string) => {
                try {
                    validateFileName(input);
                    const systemName = `${toPascalCase(input)}System`;

                    if (structure.existingSystems.includes(systemName)) {
                        return `System ${systemName} already exists`;
                    }

                    if (existingSystemNames.includes(systemName)) {
                        return `System name '${systemName}' already exists`;
                    }

                    return true;
                } catch (error) {
                    return (error as Error).message;
                }
            },
        },
        {
            type: 'number',
            name: 'priority',
            message: 'System priority (lower numbers run first):',
            default: 1,
            validate: (input: number) => {
                if (Number.isInteger(input) && input > 0) return true;
                return 'Priority must be a positive integer';
            },
        },
    ]);

    const systemName = `${toPascalCase(answers.name)}System`;
    const systemFile = systemName;

    // Ask about dependencies
    let dependencies: string[] = [];
    if (existingSystemNames.length > 0) {
        const depAnswers = await inquirer.prompt([
            {
                type: 'checkbox',
                name: 'dependencies',
                message:
                    'Select system dependencies (systems that must run before this one):',
                choices: existingSystemNames.map((name) => ({
                    name,
                    value: name,
                })),
            },
        ]);
        dependencies = depAnswers.dependencies;
    }

    // Ask about component queries
    const queryPatterns: SystemQueryPattern[] = [];
    if (existingComponentTypes.length > 0) {
        const queryAnswer = await inquirer.prompt([
            {
                type: 'confirm',
                name: 'addQueries',
                message: 'Add component queries to the system?',
                default: true,
            },
        ]);

        if (queryAnswer.addQueries) {
            console.log(
                '\n📝 Add component queries (press Enter on empty selection to finish):'
            );

            while (true) {
                const queryAnswers = await inquirer.prompt([
                    {
                        type: 'checkbox',
                        name: 'components',
                        message: 'Select components for this query:',
                        choices: existingComponentTypes.map((type) => ({
                            name: type,
                            value: type,
                        })),
                        validate: (input: string[]) => {
                            if (input.length === 0) return true; // Empty to finish
                            return input.length > 0
                                ? true
                                : 'Select at least one component';
                        },
                    },
                ]);

                if (queryAnswers.components.length === 0) break;

                const patternAnswers = await inquirer.prompt([
                    {
                        type: 'list',
                        name: 'type',
                        message: 'Query pattern:',
                        choices: [
                            {
                                name: 'Simple iteration (for...of entityIds)',
                                value: 'simple',
                            },
                            {
                                name: 'Callback-based (queryWithComponents)',
                                value: 'callback',
                            },
                        ],
                    },
                ]);

                queryPatterns.push({
                    components: queryAnswers.components,
                    type: patternAnswers.type,
                });

                console.log(
                    `✓ Added query: [${queryAnswers.components.join(', ')}] using ${patternAnswers.type} pattern`
                );
            }
        }
    }

    const generateTestsAnswer = await inquirer.prompt([
        {
            type: 'confirm',
            name: 'generateTests',
            message: 'Generate test file?',
            default: true,
        },
    ]);

    // Generate template variables
    const templateVars = buildTemplateVars(
        systemName,
        systemFile,
        answers.priority,
        dependencies,
        queryPatterns,
        existingComponentTypes
    );

    // Create files
    const filesToCreate: FileToCreate[] = [
        {
            path: join(structure.systemsDir, `${systemFile}.ts`),
            content: renderTemplate(SYSTEM_TEMPLATE, templateVars),
        },
    ];

    if (generateTestsAnswer.generateTests) {
        filesToCreate.push({
            path: join(structure.systemsDir, `${systemFile}.test.ts`),
            content: renderTemplate(SYSTEM_TEST_TEMPLATE, templateVars),
        });
    }

    createFiles(filesToCreate);

    // Update index file
    const exportLine = `export { ${systemName} } from './${systemFile}.ts';`;
    addToIndexFile(join(structure.systemsDir, 'index.ts'), exportLine);

    console.log(`\n✅ Created system: ${systemName}`);
    console.log(`📁 Files created:`);
    for (const file of filesToCreate) {
        console.log(`   - ${file.path}`);
    }
    if (dependencies.length > 0) {
        console.log(`🔗 Dependencies: ${dependencies.join(', ')}`);
    }
    if (queryPatterns.length > 0) {
        console.log(
            `🔍 Queries: ${queryPatterns.map((q) => `[${q.components.join(', ')}]`).join(', ')}`
        );
    }
}

function buildTemplateVars(
    systemName: string,
    systemFile: string,
    priority: number,
    dependencies: string[],
    queryPatterns: SystemQueryPattern[],
    _existingComponentTypes: string[]
): SystemTemplateVars {
    let imports = '';
    let dependenciesStr = '';
    let updateBody = '\n        // TODO: Implement system logic here';
    let testImports = '';
    let testMethods = '';

    // Build dependencies
    if (dependencies.length > 0) {
        dependenciesStr = `\n    readonly dependencies = [${dependencies.map((d) => `'${d}'`).join(', ')}];`;
    }

    // Build imports and queries
    if (queryPatterns.length > 0) {
        const componentImports = new Set<string>();
        queryPatterns.forEach((pattern) => {
            pattern.components.forEach((comp) => {
                // Convert component type to component interface name
                const componentName = `${comp
                    .split('-')
                    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                    .join('')}Component`;
                componentImports.add(componentName);
            });
        });

        if (componentImports.size > 0) {
            imports = `\nimport type { ${Array.from(componentImports).join(', ')} } from '../components/index.ts';`;
            testImports = `\nimport { ${Array.from(componentImports).join(', ')}, ${Array.from(
                componentImports
            )
                .map((name) => name.replace('Component', ''))
                .map((name) => `create${name}Component`)
                .join(', ')} } from '../components/index.ts';`;
        }

        // Build update body with queries
        updateBody = '\n';
        for (const pattern of queryPatterns) {
            const componentNames = pattern.components.map(
                (comp) =>
                    `${comp
                        .split('-')
                        .map(
                            (part) =>
                                part.charAt(0).toUpperCase() + part.slice(1)
                        )
                        .join('')}Component`
            );

            if (pattern.type === 'simple') {
                updateBody += `        // Query entities with ${pattern.components.join(', ')} components\n`;
                updateBody += `        const entities = this.queryEntities(world, ${pattern.components.map((c) => `'${c}'`).join(', ')});\n\n`;
                updateBody += `        for (const entityId of entities) {\n`;
                pattern.components.forEach((comp, index) => {
                    const componentName = componentNames[index];
                    const variableName = comp.replace(/-/g, '').toLowerCase();
                    updateBody += `            const ${variableName} = world.getComponent<${componentName}>(entityId, '${comp}');\n`;
                });
                updateBody += `\n            // TODO: Implement logic for entities with ${pattern.components.join(', ')}\n`;
                updateBody += `        }\n\n`;
            } else {
                // For simplicity, just use the first component in callback pattern
                const firstComponent = pattern.components[0];
                if (!firstComponent) continue;
                const componentName = componentNames[0];
                const variableName = firstComponent
                    .replace(/-/g, '')
                    .toLowerCase();

                updateBody += `        // Query entities with ${firstComponent} component\n`;
                updateBody += `        this.queryWithComponents<${componentName}>(world, '${firstComponent}', (entityId, ${variableName}) => {\n`;
                updateBody += `            // TODO: Implement logic for ${firstComponent} component\n`;
                updateBody += `        });\n\n`;
            }
        }
    }

    // Build test methods
    if (queryPatterns.length > 0) {
        testMethods =
            "\n\n    test('should process entities correctly', () => {\n";
        testMethods += '        const world = new World();\n';
        testMethods += `        const system = new ${systemName}();\n\n`;
        testMethods += '        // Create test entity\n';
        testMethods += '        const entity = world.createEntity();\n\n';

        // Add test components
        queryPatterns[0]?.components.forEach((comp) => {
            const componentName = `${comp
                .split('-')
                .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
                .join('')}Component`;
            const factoryName = `create${componentName}`;

            testMethods += `        world.addComponent(entity, ${factoryName}(/* add test parameters */));\n`;
        });

        testMethods += '\n        expect(() => {\n';
        testMethods += '            system.update(world, 1.0);\n';
        testMethods += '        }).not.toThrow();\n';
        testMethods += '    });';
    }

    return {
        systemName,
        systemFile,
        priority,
        imports,
        dependencies: dependenciesStr,
        updateBody,
        testImports,
        testMethods,
    };
}
