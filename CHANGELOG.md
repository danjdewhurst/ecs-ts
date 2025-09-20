# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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