import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
    existsSync,
    mkdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import {
    addToIndexFile,
    createFile,
    createFiles,
    ensureDirectoryExists,
    type FileToCreate,
    getProjectRoot,
    validateFileName,
} from './file-operations.ts';

const TEST_DIR = join(process.cwd(), 'test-temp');

beforeEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true, force: true });
    }
});

afterEach(() => {
    // Clean up test directory
    if (existsSync(TEST_DIR)) {
        rmSync(TEST_DIR, { recursive: true, force: true });
    }
});

describe('ensureDirectoryExists', () => {
    test('should create directory when it does not exist', () => {
        const filePath = join(TEST_DIR, 'nested', 'deep', 'file.ts');

        ensureDirectoryExists(filePath);

        expect(existsSync(dirname(filePath))).toBe(true);
    });

    test('should not fail when directory already exists', () => {
        const filePath = join(TEST_DIR, 'existing', 'file.ts');
        mkdirSync(dirname(filePath), { recursive: true });

        expect(() => ensureDirectoryExists(filePath)).not.toThrow();
        expect(existsSync(dirname(filePath))).toBe(true);
    });

    test('should handle nested directory creation', () => {
        const filePath = join(TEST_DIR, 'a', 'b', 'c', 'd', 'file.ts');

        ensureDirectoryExists(filePath);

        expect(existsSync(join(TEST_DIR, 'a'))).toBe(true);
        expect(existsSync(join(TEST_DIR, 'a', 'b'))).toBe(true);
        expect(existsSync(join(TEST_DIR, 'a', 'b', 'c'))).toBe(true);
        expect(existsSync(join(TEST_DIR, 'a', 'b', 'c', 'd'))).toBe(true);
    });
});

describe('createFile', () => {
    test('should create file with content', () => {
        const filePath = join(TEST_DIR, 'test.ts');
        const content = 'export const test = "hello";';

        createFile(filePath, content);

        expect(existsSync(filePath)).toBe(true);
        expect(readFileSync(filePath, 'utf-8')).toBe(content);
    });

    test('should create directory structure if needed', () => {
        const filePath = join(TEST_DIR, 'nested', 'deep', 'test.ts');
        const content = 'export const test = "hello";';

        createFile(filePath, content);

        expect(existsSync(filePath)).toBe(true);
        expect(readFileSync(filePath, 'utf-8')).toBe(content);
    });

    test('should throw error if file already exists', () => {
        const filePath = join(TEST_DIR, 'existing.ts');
        mkdirSync(TEST_DIR, { recursive: true });
        writeFileSync(filePath, 'existing content');

        expect(() => createFile(filePath, 'new content')).toThrow(
            `File already exists: ${filePath}`
        );
    });
});

describe('createFiles', () => {
    test('should create multiple files successfully', () => {
        const files: FileToCreate[] = [
            {
                path: join(TEST_DIR, 'file1.ts'),
                content: 'export const file1 = "content1";',
            },
            {
                path: join(TEST_DIR, 'subdir', 'file2.ts'),
                content: 'export const file2 = "content2";',
            },
            {
                path: join(TEST_DIR, 'file3.ts'),
                content: 'export const file3 = "content3";',
            },
        ];

        createFiles(files);

        files.forEach((file) => {
            expect(existsSync(file.path)).toBe(true);
            expect(readFileSync(file.path, 'utf-8')).toBe(file.content);
        });
    });

    test('should throw error if any file already exists', () => {
        mkdirSync(TEST_DIR, { recursive: true });
        const existingFile = join(TEST_DIR, 'existing.ts');
        writeFileSync(existingFile, 'existing');

        const files: FileToCreate[] = [
            {
                path: join(TEST_DIR, 'new.ts'),
                content: 'new content',
            },
            {
                path: existingFile,
                content: 'overwrite attempt',
            },
        ];

        expect(() => createFiles(files)).toThrow(
            `Files already exist: ${existingFile}`
        );

        // Should not create any files if one already exists
        expect(existsSync(join(TEST_DIR, 'new.ts'))).toBe(false);
    });

    test('should handle empty file list', () => {
        expect(() => createFiles([])).not.toThrow();
    });
});

describe('addToIndexFile', () => {
    test('should create index file if it does not exist', () => {
        const indexPath = join(TEST_DIR, 'index.ts');
        const exportLine = 'export { Component } from "./Component.ts";';

        addToIndexFile(indexPath, exportLine);

        expect(existsSync(indexPath)).toBe(true);
        expect(readFileSync(indexPath, 'utf-8')).toBe(`${exportLine}\n`);
    });

    test('should append to existing index file', () => {
        const indexPath = join(TEST_DIR, 'index.ts');
        mkdirSync(TEST_DIR, { recursive: true });
        writeFileSync(indexPath, 'export { Existing } from "./Existing.ts";\n');

        const exportLine = 'export { Component } from "./Component.ts";';
        addToIndexFile(indexPath, exportLine);

        const content = readFileSync(indexPath, 'utf-8');
        expect(content).toContain('export { Existing }');
        expect(content).toContain('export { Component }');
        expect(content.split('\n').length).toBe(3); // 2 exports + final newline
    });

    test('should not duplicate existing exports', () => {
        const indexPath = join(TEST_DIR, 'index.ts');
        const exportLine = 'export { Component } from "./Component.ts";';
        mkdirSync(TEST_DIR, { recursive: true });
        writeFileSync(indexPath, `${exportLine}\n`);

        addToIndexFile(indexPath, exportLine);

        const content = readFileSync(indexPath, 'utf-8');
        const lines = content.split('\n').filter((line) => line.trim());
        expect(lines.length).toBe(1); // Should only have one export line
        expect(lines[0]).toBe(exportLine);
    });

    test('should handle index file without trailing newline', () => {
        const indexPath = join(TEST_DIR, 'index.ts');
        mkdirSync(TEST_DIR, { recursive: true });
        writeFileSync(indexPath, 'export { Existing } from "./Existing.ts";'); // No trailing newline

        const exportLine = 'export { Component } from "./Component.ts";';
        addToIndexFile(indexPath, exportLine);

        const content = readFileSync(indexPath, 'utf-8');
        expect(content).toBe(
            'export { Existing } from "./Existing.ts";\n' +
                'export { Component } from "./Component.ts";\n'
        );
    });
});

describe('getProjectRoot', () => {
    test('should find project root when package.json exists', () => {
        // Arrange - we're in a real project with package.json at root
        const originalCwd = process.cwd();

        // Act
        const projectRoot = getProjectRoot();

        // Assert
        expect(projectRoot).toBe(originalCwd);
        expect(existsSync(join(projectRoot, 'package.json'))).toBe(true);
    });

    test('should traverse up directories to find project root', () => {
        // Arrange - create a nested directory structure and change into it
        const originalCwd = process.cwd();
        const nestedDir = join(TEST_DIR, 'deeply', 'nested', 'directory');
        mkdirSync(nestedDir, { recursive: true });

        try {
            // Act - change to nested directory
            process.chdir(nestedDir);
            const projectRoot = getProjectRoot();

            // Assert - should still find the original project root
            expect(projectRoot).toBe(originalCwd);
            expect(existsSync(join(projectRoot, 'package.json'))).toBe(true);
        } finally {
            // Cleanup - restore original directory
            process.chdir(originalCwd);
        }
    });

    test('should throw error when package.json cannot be found', () => {
        // Arrange - create isolated directory without package.json and change into it
        const originalCwd = process.cwd();
        const isolatedDir = join(TEST_DIR, 'isolated');
        mkdirSync(isolatedDir, { recursive: true });

        try {
            // Mock process.cwd to return a path where no package.json exists up to root
            // We'll use a temporary override approach
            const originalProcessCwd = process.cwd;
            process.cwd = () => '/tmp/nonexistent/deeply/nested/path';

            // Act & Assert
            expect(() => getProjectRoot()).toThrow(
                'Could not find project root (package.json not found)'
            );

            // Restore process.cwd
            process.cwd = originalProcessCwd;
        } finally {
            // Cleanup - restore original directory
            process.chdir(originalCwd);
        }
    });
});

describe('validateFileName', () => {
    test('should accept valid file names', () => {
        const validNames = [
            'Component',
            'MyComponent',
            'health-system',
            'movement_system',
            'test123',
            'Component-Test',
            'my_component_name',
        ];

        validNames.forEach((name) => {
            expect(() => validateFileName(name)).not.toThrow();
        });
    });

    test('should reject empty or whitespace-only names', () => {
        const invalidNames = ['', '   ', '\t', '\n'];

        invalidNames.forEach((name) => {
            expect(() => validateFileName(name)).toThrow(
                'Name cannot be empty'
            );
        });
    });

    test('should reject names starting with non-letter', () => {
        const invalidNames = [
            '123Component',
            '-component',
            '_component',
            '!component',
        ];

        invalidNames.forEach((name) => {
            expect(() => validateFileName(name)).toThrow(
                'Name must start with a letter and contain only letters, numbers, hyphens, and underscores'
            );
        });
    });

    test('should reject names with invalid characters', () => {
        const invalidNames = [
            'Component!',
            'Component@System',
            'Component System', // space
            'Component.ts',
            'Component/System',
            'Component\\System',
        ];

        invalidNames.forEach((name) => {
            expect(() => validateFileName(name)).toThrow(
                'Name must start with a letter and contain only letters, numbers, hyphens, and underscores'
            );
        });
    });

    test('should accept names with mixed valid characters', () => {
        const validNames = [
            'MyComponent123',
            'health-system-v2',
            'movement_system_new',
            'TestComponent-Final',
        ];

        validNames.forEach((name) => {
            expect(() => validateFileName(name)).not.toThrow();
        });
    });
});
