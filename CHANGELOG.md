# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.6.4](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.6.3...ecs-ts/v0.6.4) (2025-09-20)


### 🎨 Maintenance

* **ci:** remove duplicate release workflow and update documentation ([87e7fa0](https://github.com/danjdewhurst/ecs-ts/commit/87e7fa0465950926d941b7182f79c8773a5cbb92))

## [0.6.3](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.6.2...ecs-ts/v0.6.3) (2025-09-20)


### 🐛 Bug Fixes

* remove remaining currentSize reference in ObjectPool ([1a0fa25](https://github.com/danjdewhurst/ecs-ts/commit/1a0fa255dd5fa486aec82d1cb581511e6e90c30f))

## [0.6.2](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.6.1...ecs-ts/v0.6.2) (2025-09-20)


### 🐛 Bug Fixes

* resolve linting and TypeScript compilation errors ([674fffb](https://github.com/danjdewhurst/ecs-ts/commit/674fffbc2ddaa214b96b2c68b2e898b7c10ba31d))

## [0.6.1](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.6.0...ecs-ts/v0.6.1) (2025-09-20)


### 📚 Documentation

* add philosophy references to README and CLAUDE.md ([8a989fd](https://github.com/danjdewhurst/ecs-ts/commit/8a989fdcab5742cf6a8ab8c43e65a1c7f4659954))

## [0.6.0](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.5.0...ecs-ts/v0.6.0) (2025-09-20)


### ✨ Features

* **plugins:** implement complete plugin architecture with dependency resolution ([ca451a6](https://github.com/danjdewhurst/ecs-ts/commit/ca451a6f8bf685cd7b5f7613fcaa140f305d96a3))


### 📚 Documentation

* update PLAN.md to reflect Phase 5 completion ([40c1393](https://github.com/danjdewhurst/ecs-ts/commit/40c13930abe0f1b5b36ac6dab3c63720118015ab))

## [0.5.0](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.4.0...ecs-ts/v0.5.0) (2025-09-20)


### ⚠ BREAKING CHANGES

* **ci:** Release process now uses conventional commits for automated versioning
* **events:** World.update() now processes events before and after system execution, potentially affecting system execution timing.

### ✨ Features

* **ci:** implement comprehensive GitHub releases automation ([69156d0](https://github.com/danjdewhurst/ecs-ts/commit/69156d057870ebcbca8aa7f7227caf6d2005a9bd))
* **events:** implement complete event system with comprehensive testing ([60dfb8c](https://github.com/danjdewhurst/ecs-ts/commit/60dfb8c5f15e89c49e6f7d93cd13d6cd32506f09))
* initial implementation of ECS Game Engine ([d0b53c9](https://github.com/danjdewhurst/ecs-ts/commit/d0b53c96e8a4187dd7313f1b4636030f4cb855dd))
* **websocket:** implement complete WebSocket multiplayer system ([857b4ce](https://github.com/danjdewhurst/ecs-ts/commit/857b4ce475490f36a4231f9d82fe32e5ab81e2ac))


### 🐛 Bug Fixes

* **ci:** update Release Please workflow configuration ([cda73a5](https://github.com/danjdewhurst/ecs-ts/commit/cda73a5596417d61045e34100632277afc619ead))
* remove unneeded lines from husky pre commit ([73c0991](https://github.com/danjdewhurst/ecs-ts/commit/73c0991029c7ff86b94613cd8ccdca0459eeca18))


### 🎨 Maintenance

* add Biome for code formatting and linting ([3946714](https://github.com/danjdewhurst/ecs-ts/commit/3946714c9268416bc488f0d56ba1a9ed66b31c86))

## [Unreleased]

### Added
- GitHub releases optimization and automation
- Conventional commits integration
- Automated release notes generation
- Security scanning in release pipeline

## [0.4.0] - 2025-09-20

### Added
- Complete WebSocket integration with Bun server
- Real-time multiplayer support with type-safe protocols
- Client connection management and authentication
- WebSocket server examples and comprehensive testing

### Changed
- Enhanced networking architecture for multiplayer games
- Improved performance for real-time communication

### Fixed
- Connection handling edge cases
- Memory management in WebSocket connections

## [0.3.0] - 2025-09-01

### Added
- Complete event system implementation
- Event bus with type-safe event handling
- Event component integration
- System-to-system communication via events
- Comprehensive event system testing

### Changed
- Enhanced system architecture for event-driven communication
- Improved error resilience in event processing

### Fixed
- Event handling edge cases
- Memory leaks in event subscriptions

## [0.2.0] - 2025-09-01

### Added
- System scheduler with dependency resolution
- Priority-based system execution
- System dependency management
- Performance optimizations for system execution
- Biome for code formatting and linting

### Changed
- Enhanced system architecture for better performance
- Improved query system efficiency

### Fixed
- System execution order issues
- Dependency resolution edge cases
- Unneeded lines from husky pre commit

## [0.1.0] - 2025-09-01

### Added
- Core Entity Component System (ECS) implementation
- Entity management with ID recycling
- Component storage architecture
- Archetype-based entity organization
- World container for ECS coordination
- High-performance query system
- TypeScript support with full type safety
- Bun runtime integration
- Comprehensive test suite (59 unit tests)
- Development tooling and CI/CD pipeline

### Features
- O(1) entity creation and component operations
- Archetype-based component storage for optimal performance
- Type-safe component and system interfaces
- Modern development experience with Bun
- Zero-config development with hot reloading

[Unreleased]: https://github.com/danjdewhurst/ecs-ts/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/danjdewhurst/ecs-ts/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/danjdewhurst/ecs-ts/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/danjdewhurst/ecs-ts/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/danjdewhurst/ecs-ts/releases/tag/v0.1.0
