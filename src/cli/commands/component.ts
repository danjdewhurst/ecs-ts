import { join } from 'node:path';
import inquirer from 'inquirer';
import {
    COMPONENT_TEMPLATE,
    COMPONENT_TEST_TEMPLATE,
    type ComponentTemplateVars,
} from '../templates/component.template.ts';
import {
    addToIndexFile,
    createFiles,
    type FileToCreate,
    validateFileName,
} from '../utils/file-operations.ts';
import {
    analyzeProject,
    getExistingComponentTypes,
} from '../utils/project-analysis.ts';
import {
    renderTemplate,
    toKebabCase,
    toPascalCase,
} from '../utils/template-engine.ts';

interface ComponentProperty {
    name: string;
    type: string;
    optional: boolean;
    defaultValue?: string;
}

export async function componentCommand(): Promise<void> {
    console.log('🔧 Component Scaffolding\n');

    const structure = analyzeProject();
    const existingTypes = getExistingComponentTypes();

    const answers = await inquirer.prompt([
        {
            type: 'input',
            name: 'name',
            message: 'Component name (e.g., "Health", "Transform"):',
            validate: (input: string) => {
                try {
                    validateFileName(input);
                    const componentName = `${toPascalCase(input)}Component`;
                    const componentType = toKebabCase(input);

                    if (structure.existingComponents.includes(componentName)) {
                        return `Component ${componentName} already exists`;
                    }

                    if (existingTypes.includes(componentType)) {
                        return `Component type '${componentType}' already exists`;
                    }

                    return true;
                } catch (error) {
                    return (error as Error).message;
                }
            },
        },
        {
            type: 'confirm',
            name: 'addProperties',
            message: 'Add custom properties to the component?',
            default: true,
        },
    ]);

    const componentName = `${toPascalCase(answers.name)}Component`;
    const componentType = toKebabCase(answers.name);
    const componentFile = componentName;

    const properties: ComponentProperty[] = [];

    if (answers.addProperties) {
        console.log(
            '\n📝 Add properties (press Enter on empty name to finish):'
        );

        while (true) {
            const propertyAnswers = await inquirer.prompt([
                {
                    type: 'input',
                    name: 'name',
                    message: 'Property name:',
                    validate: (input: string) => {
                        if (!input.trim()) return true; // Empty to finish
                        if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(input)) {
                            return 'Property name must be valid identifier';
                        }
                        if (properties.some((p) => p.name === input)) {
                            return 'Property name already exists';
                        }
                        return true;
                    },
                },
            ]);

            if (!propertyAnswers.name.trim()) break;

            const typeAnswers = await inquirer.prompt([
                {
                    type: 'list',
                    name: 'type',
                    message: `Type for property '${propertyAnswers.name}':`,
                    choices: [
                        'number',
                        'string',
                        'boolean',
                        'number[]',
                        'string[]',
                        'Vector2 (x: number, y: number)',
                        'Vector3 (x: number, y: number, z: number)',
                        'Custom type',
                    ],
                },
            ]);

            let propertyType = typeAnswers.type;
            if (typeAnswers.type === 'Vector2 (x: number, y: number)') {
                propertyType = '{ x: number; y: number }';
            } else if (
                typeAnswers.type === 'Vector3 (x: number, y: number, z: number)'
            ) {
                propertyType = '{ x: number; y: number; z: number }';
            } else if (typeAnswers.type === 'Custom type') {
                const customAnswers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'customType',
                        message: 'Enter custom type:',
                        validate: (input: string) =>
                            input.trim() ? true : 'Type cannot be empty',
                    },
                ]);
                propertyType = customAnswers.customType;
            }

            const optionalAnswers = await inquirer.prompt([
                {
                    type: 'confirm',
                    name: 'optional',
                    message: `Is '${propertyAnswers.name}' optional?`,
                    default: false,
                },
            ]);

            let defaultValue: string | undefined;
            if (!optionalAnswers.optional) {
                const defaultAnswers = await inquirer.prompt([
                    {
                        type: 'input',
                        name: 'defaultValue',
                        message: `Default value for '${propertyAnswers.name}' (optional):`,
                    },
                ]);
                if (defaultAnswers.defaultValue.trim()) {
                    defaultValue = defaultAnswers.defaultValue;
                }
            }

            properties.push({
                name: propertyAnswers.name,
                type: propertyType,
                optional: optionalAnswers.optional,
                defaultValue,
            });

            console.log(
                `✓ Added property: ${propertyAnswers.name}: ${propertyType}${optionalAnswers.optional ? '?' : ''}`
            );
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
        componentName,
        componentType,
        componentFile,
        properties
    );

    // Create files
    const filesToCreate: FileToCreate[] = [
        {
            path: join(structure.componentsDir, `${componentFile}.ts`),
            content: renderTemplate(COMPONENT_TEMPLATE, templateVars),
        },
    ];

    if (generateTestsAnswer.generateTests) {
        filesToCreate.push({
            path: join(structure.componentsDir, `${componentFile}.test.ts`),
            content: renderTemplate(COMPONENT_TEST_TEMPLATE, templateVars),
        });
    }

    createFiles(filesToCreate);

    // Update index file
    const exportLine = `export { ${componentName}, create${componentName} } from './${componentFile}.ts';`;
    addToIndexFile(join(structure.componentsDir, 'index.ts'), exportLine);

    console.log(`\n✅ Created component: ${componentName}`);
    console.log(`📁 Files created:`);
    for (const file of filesToCreate) {
        console.log(`   - ${file.path}`);
    }
    if (properties.length > 0) {
        console.log(
            `📋 Properties: ${properties.map((p) => `${p.name}: ${p.type}${p.optional ? '?' : ''}`).join(', ')}`
        );
    }
}

function buildTemplateVars(
    componentName: string,
    componentType: string,
    componentFile: string,
    properties: ComponentProperty[]
): ComponentTemplateVars {
    let propertiesStr = '';
    let factoryParams = '';
    let factoryBody = '';
    let testParams = '';
    let testAssertions = '';

    if (properties.length > 0) {
        // Build properties string
        propertiesStr =
            '\n' +
            properties
                .map((p) => {
                    const optional = p.optional ? '?' : '';
                    return `    ${p.name}${optional}: ${p.type};`;
                })
                .join('\n');

        // Build factory parameters
        const requiredParams = properties.filter((p) => !p.optional);
        const optionalParams = properties.filter((p) => p.optional);

        const params: string[] = [];
        requiredParams.forEach((p) => {
            params.push(`${p.name}: ${p.type}`);
        });
        optionalParams.forEach((p) => {
            params.push(`${p.name}?: ${p.type}`);
        });

        factoryParams = params.join(', ');

        // Build factory body
        factoryBody =
            '\n' +
            properties
                .map((p) => {
                    if (p.defaultValue && !p.optional) {
                        return `        ${p.name}: ${p.name} ?? ${p.defaultValue},`;
                    }
                    if (p.optional) {
                        return `        ...(${p.name} !== undefined && { ${p.name} }),`;
                    }
                    return `        ${p.name},`;
                })
                .join('\n');

        // Build test parameters
        testParams = properties
            .filter((p) => !p.optional)
            .map((p) => {
                return getTestValue(p.type);
            })
            .join(', ');

        // Build test assertions
        testAssertions =
            '\n' +
            properties
                .filter((p) => !p.optional)
                .map((p) => {
                    const testValue = getTestValue(p.type);
                    return `        expect(component.${p.name}).toBe(${testValue});`;
                })
                .join('\n');
    }

    return {
        componentName,
        componentType,
        componentFile,
        properties: propertiesStr,
        factoryParams,
        factoryBody,
        testParams,
        testAssertions,
    };
}

function getTestValue(type: string): string {
    if (type === 'number') return '42';
    if (type === 'string') return "'test'";
    if (type === 'boolean') return 'true';
    if (type === 'number[]') return '[1, 2, 3]';
    if (type === 'string[]') return "['a', 'b']";
    if (type.includes('x: number; y: number; z: number'))
        return '{ x: 1, y: 2, z: 3 }';
    if (type.includes('x: number; y: number')) return '{ x: 1, y: 2 }';
    return '{}';
}
