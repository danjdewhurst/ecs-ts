# Installation

Get started with the ECS Game Engine in just a few minutes.

## Prerequisites

The ECS Game Engine is built for modern JavaScript runtimes with first-class support for Bun and TypeScript.

### Required

- **Bun** 1.1.0 or later (recommended) or **Node.js** 18.0.0 or later
- **TypeScript** 5.0 or later

### Installing Bun

If you don't have Bun installed, install it using the official installer:

```bash
# macOS/Linux
curl -fsSL https://bun.sh/install | bash

# Windows (PowerShell)
powershell -c "irm bun.sh/install.ps1 | iex"
```

Verify your installation:

```bash
bun --version
```

## Installation Options

### Option 1: Install from NPM (Recommended)

```bash
# Using Bun (recommended)
bun add @danjdewhurst/ecs-ts

# Using npm
npm install @danjdewhurst/ecs-ts

# Using yarn
yarn add @danjdewhurst/ecs-ts

# Using pnpm
pnpm add @danjdewhurst/ecs-ts
```

### Option 2: Development Build from Source

For development, contributing, or running examples:

```bash
# Clone the repository
git clone https://github.com/danjdewhurst/ecs-ts.git
cd ecs-ts

# Install dependencies
bun install

# Build the project
bun run build

# Run tests to verify installation
bun test
```

## Project Setup

### Create a New Project

```bash
# Create a new directory
mkdir my-ecs-game
cd my-ecs-game

# Initialize package.json
bun init

# Install the ECS engine
bun add @danjdewhurst/ecs-ts

# Install TypeScript if needed
bun add -d typescript @types/bun
```

### TypeScript Configuration

Create a `tsconfig.json` file in your project root:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "allowImportingTsExtensions": true,
    "noEmit": true,
    "lib": ["ES2022"],
    "types": ["bun-types"]
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Basic Package.json Scripts

Add these scripts to your `package.json`:

```json
{
  "scripts": {
    "dev": "bun --watch src/index.ts",
    "start": "bun src/index.ts",
    "build": "bun build src/index.ts --outdir dist --target node",
    "test": "bun test",
    "typecheck": "tsc --noEmit"
  }
}
```

## Verify Installation

Create a simple test file to verify everything is working:

**`src/test-installation.ts`**

```typescript
import { World, BaseSystem, type Component } from '@danjdewhurst/ecs-ts';

// Simple test component
interface TestComponent extends Component {
  readonly type: 'test';
  message: string;
}

// Simple test system
class TestSystem extends BaseSystem {
  readonly priority = 1;
  readonly name = 'TestSystem';

  update(world: World): void {
    console.log('✅ ECS Engine is working!');
  }
}

// Test the installation
const world = new World();
world.addSystem(new TestSystem());

const entity = world.createEntity();
world.addComponent(entity, {
  type: 'test',
  message: 'Hello, ECS!'
} as TestComponent);

world.update(0);
console.log(`Created entity ${entity} with test component`);
console.log('🎮 Installation verified successfully!');
```

Run the test:

```bash
bun src/test-installation.ts
```

You should see:

```
✅ ECS Engine is working!
Created entity 0 with test component
🎮 Installation verified successfully!
```

## Troubleshooting

### Common Issues

**"Cannot resolve module" errors:**
- Ensure TypeScript is configured with `"moduleResolution": "bundler"`
- Verify the engine is properly installed in `node_modules`

**Type errors with Bun:**
- Add `"types": ["bun-types"]` to your tsconfig.json
- Install bun types: `bun add -d @types/bun`

**Performance issues:**
- Use Bun for best performance (10x faster startup than Node.js)
- Enable TypeScript strict mode for better optimization

### Getting Help

- 📖 **Documentation**: [View the full documentation](../README.md)
- 🐛 **Issues**: [Report bugs on GitHub](https://github.com/danjdewhurst/ecs-ts/issues)
- 💬 **Discussions**: [Join community discussions](https://github.com/danjdewhurst/ecs-ts/discussions)

## Next Steps

- 🚀 **[Quick Start Guide](./quick-start.md)** - Build your first ECS application in 5 minutes
- 🎯 **[Core Concepts](./core-concepts.md)** - Understand entities, components, and systems
- 🎮 **[First Game Tutorial](./first-game.md)** - Build a complete game step-by-step

## System Requirements

### Development Environment

- **Memory**: 2GB+ RAM recommended
- **Storage**: 100MB+ free space
- **CPU**: Any modern processor (ARM64 and x64 supported)

### Runtime Performance

- **Entities**: Handles 100,000+ entities efficiently
- **Components**: Sub-microsecond component access
- **Systems**: Dependency-aware scheduling with minimal overhead
- **Memory**: Entity ID recycling and object pooling for optimal memory usage

The ECS engine is designed for high-performance game development with cache-friendly data structures and archetype-based component storage.