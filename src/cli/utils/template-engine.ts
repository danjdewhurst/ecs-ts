export interface TemplateVars {
    [key: string]: string | boolean | number | string[] | undefined;
}

export function renderTemplate(template: string, vars: TemplateVars): string {
    return template.replace(/\{\{([^}]+)\}\}/g, (_match, key) => {
        const value = vars[key.trim()];
        if (value === undefined) {
            throw new Error(`Template variable '${key}' is not defined`);
        }
        if (Array.isArray(value)) {
            return value.join(', ');
        }
        return String(value);
    });
}

export function toPascalCase(str: string): string {
    return str
        .split(/[-_\s]+/)
        .map(
            (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join('');
}

export function toCamelCase(str: string): string {
    const pascal = toPascalCase(str);
    return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

export function toKebabCase(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .replace(/[\s_]+/g, '-')
        .toLowerCase();
}

export function toSnakeCase(str: string): string {
    return str
        .replace(/([a-z])([A-Z])/g, '$1_$2')
        .replace(/[\s-]+/g, '_')
        .toLowerCase();
}
