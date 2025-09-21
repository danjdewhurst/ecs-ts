import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

export interface FileToCreate {
    path: string;
    content: string;
}

export function ensureDirectoryExists(filePath: string): void {
    const dir = dirname(filePath);
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
    }
}

export function createFile(filePath: string, content: string): void {
    ensureDirectoryExists(filePath);

    if (existsSync(filePath)) {
        throw new Error(`File already exists: ${filePath}`);
    }

    writeFileSync(filePath, content, 'utf-8');
}

export function createFiles(files: FileToCreate[]): void {
    // First check if any files already exist
    const existingFiles = files.filter((f) => existsSync(f.path));
    if (existingFiles.length > 0) {
        throw new Error(
            `Files already exist: ${existingFiles.map((f) => f.path).join(', ')}`
        );
    }

    // Create all files
    files.forEach((file) => {
        ensureDirectoryExists(file.path);
        writeFileSync(file.path, file.content, 'utf-8');
    });
}

export function addToIndexFile(indexPath: string, exportLine: string): void {
    if (!existsSync(indexPath)) {
        createFile(indexPath, `${exportLine}\n`);
        return;
    }

    const currentContent = readFileSync(indexPath, 'utf-8');

    // Check if export already exists
    if (currentContent.includes(exportLine)) {
        return;
    }

    // Add new export
    const newContent = currentContent.endsWith('\n')
        ? `${currentContent}${exportLine}\n`
        : `${currentContent}\n${exportLine}\n`;

    writeFileSync(indexPath, newContent, 'utf-8');
}

export function getProjectRoot(): string {
    // Find project root by looking for package.json
    let current = process.cwd();
    while (current !== '/') {
        if (existsSync(join(current, 'package.json'))) {
            return current;
        }
        current = dirname(current);
    }
    throw new Error('Could not find project root (package.json not found)');
}

export function validateFileName(name: string): void {
    if (!name || name.trim().length === 0) {
        throw new Error('Name cannot be empty');
    }

    if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name)) {
        throw new Error(
            'Name must start with a letter and contain only letters, numbers, hyphens, and underscores'
        );
    }
}
