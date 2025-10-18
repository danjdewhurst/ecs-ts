# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.12.0](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.11.0...ecs-ts/v0.12.0) (2025-10-18)


### ⚠ BREAKING CHANGES

* **core:** none

### ✨ Features

* **core:** add command buffer system for deferred operations ([f4dd329](https://github.com/danjdewhurst/ecs-ts/commit/f4dd3298b5267fb0264268a201537b661e5d031a))
* **core:** add comprehensive asset management system ([873ea1f](https://github.com/danjdewhurst/ecs-ts/commit/873ea1f12a58081eb303ac99a99eeb7e18cf8e48))
* **core:** add comprehensive scene management system ([740a566](https://github.com/danjdewhurst/ecs-ts/commit/740a566148d254957294b88371a55a9f8c39ec01))
* **core:** add comprehensive transform hierarchy system ([a0a3474](https://github.com/danjdewhurst/ecs-ts/commit/a0a3474ec5c956c1a3c224e7bfef214af4fae55b))


### 🐛 Bug Fixes

* **tests:** resolve TypeScript type narrowing issues in World tests ([6d5b865](https://github.com/danjdewhurst/ecs-ts/commit/6d5b865821960633a44822cebc456810be64ec42))

## [0.11.0](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.10.1...ecs-ts/v0.11.0) (2025-10-18)


### ✨ Features

* **core:** add comprehensive serialization system ([5c12c5e](https://github.com/danjdewhurst/ecs-ts/commit/5c12c5e375dc469885e145fda66833fcbeeae37e)), closes [#1](https://github.com/danjdewhurst/ecs-ts/issues/1)


### 📚 Documentation

* **core:** mark serialization & persistence as complete ([0bc052c](https://github.com/danjdewhurst/ecs-ts/commit/0bc052c070394de85f413ae47887404509404c28))


### 🎨 Maintenance

* amend pre commit hook ([e4dd39f](https://github.com/danjdewhurst/ecs-ts/commit/e4dd39fde067e4a2b56e8db3c1dc9e1c911e7554))

## [0.10.1](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.10.0...ecs-ts/v0.10.1) (2025-10-18)


### 📚 Documentation

* fix documentation accuracy issues ([118aa04](https://github.com/danjdewhurst/ecs-ts/commit/118aa042e0af26bea6fd534b15db66de56cd8f2a))

## [0.10.0](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.9.2...ecs-ts/v0.10.0) (2025-10-14)


### ⚠ BREAKING CHANGES

* **core:** None - fully backward compatible

### ✨ Features

* **core:** integrate SystemScheduler into World class ([c8b34c4](https://github.com/danjdewhurst/ecs-ts/commit/c8b34c45039e2a58fa1de254af28aee493346722))


### ⚡ Performance Improvements

* **core:** enhance SystemScheduler with better errors and caching ([755225f](https://github.com/danjdewhurst/ecs-ts/commit/755225f394017cc3898879d2048b4cbdae36ff54))


### 📚 Documentation

* **core:** add SystemScheduler documentation and examples ([cd2c411](https://github.com/danjdewhurst/ecs-ts/commit/cd2c411c03a42f59665645cddcd2211e00e1f199))

## [0.9.2](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.9.1...ecs-ts/v0.9.2) (2025-10-14)


### 🐛 Bug Fixes

* **docs:** resolve git case-sensitivity issues for file renames ([5e0d172](https://github.com/danjdewhurst/ecs-ts/commit/5e0d172ada188155f00f1d1285003946a5d0554d))


### 📚 Documentation

* update requirements to Bun 1.2+ only ([712072e](https://github.com/danjdewhurst/ecs-ts/commit/712072e26f8ee33c9679a59701a63c626b3af92e))


### 🔧 CI/CD

* expand Bun version matrix to test against 1.0, 1.1, 1.2, and latest ([80d0db0](https://github.com/danjdewhurst/ecs-ts/commit/80d0db0ea5e18fa8ffc2886dab436387b378058d))
* remove frozen-lockfile flag for multi-version compatibility ([243f3e5](https://github.com/danjdewhurst/ecs-ts/commit/243f3e5488e1ff10e4c649dfeb186b841424e51c))
* test against Bun 1.2, 1.3, and latest with frozen lockfile ([6b4be9f](https://github.com/danjdewhurst/ecs-ts/commit/6b4be9f09e6b2e5da73c494976aff455e185287a))


### 🎨 Maintenance

* **docs:** standardize file naming and add linting enforcement ([40eb086](https://github.com/danjdewhurst/ecs-ts/commit/40eb0863201341fa7597c553158086be3ee83c7a))

## [0.9.1](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.9.0...ecs-ts/v0.9.1) (2025-10-14)


### 🧪 Testing

* **core:** add comprehensive test coverage for core modules ([2bab839](https://github.com/danjdewhurst/ecs-ts/commit/2bab8396a37a30246a00f5a494759730548d6b58))

## [0.9.0](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.8.3...ecs-ts/v0.9.0) (2025-09-21)


### ✨ Features

* **core:** add interactive scaffolding tool with help system ([caf6997](https://github.com/danjdewhurst/ecs-ts/commit/caf6997e9ee95182c4d9c7adc1058a8547752e2c))


### 🐛 Bug Fixes

* **tests:** ensure deterministic ordering in project analysis ([d2dbaa5](https://github.com/danjdewhurst/ecs-ts/commit/d2dbaa58eaa176b585cf6408da015dc117ce022c))

## [0.8.3](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.8.2...ecs-ts/v0.8.3) (2025-09-21)


### 📚 Documentation

* streamline README for better clarity and visual appeal ([d40c03c](https://github.com/danjdewhurst/ecs-ts/commit/d40c03c7a2b66c4fcb0d4ee0bfc582728c886bd8))

## [0.8.2](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.8.1...ecs-ts/v0.8.2) (2025-09-21)


### 🐛 Bug Fixes

* resolve linting and type safety issues across codebase ([ca459f6](https://github.com/danjdewhurst/ecs-ts/commit/ca459f6d544f97cbe39c17d612edcfc1a4e1e9ab))


### 📚 Documentation

* add comprehensive documentation index and badge ([3717d73](https://github.com/danjdewhurst/ecs-ts/commit/3717d73a916bf3522fd0fe4c6937544146b89192))

## [0.8.1](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.8.0...ecs-ts/v0.8.1) (2025-09-21)


### 🎨 Maintenance

* added context7.json ([f4ee544](https://github.com/danjdewhurst/ecs-ts/commit/f4ee54494d4de7843d75dd2ce3208403c9bbfdb8))

## [0.8.0](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.7.5...ecs-ts/v0.8.0) (2025-09-21)


### ✨ Features

* **core:** add SQLite persistence example with Bun integration ([92cee0e](https://github.com/danjdewhurst/ecs-ts/commit/92cee0eebd20ecefb2f21f7ef74fa0955395bfc9))

## [0.7.5](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.7.4...ecs-ts/v0.7.5) (2025-09-21)


### 🎨 Maintenance

* remove planning documents and optimize project files ([e363796](https://github.com/danjdewhurst/ecs-ts/commit/e3637966222a83878e9af0d7eb2349892f044126))

## [0.7.4](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.7.3...ecs-ts/v0.7.4) (2025-09-21)


### 🐛 Bug Fixes

* **ci:** add NPM provenance and OIDC auth to bypass 2FA requirements ([3fd87c5](https://github.com/danjdewhurst/ecs-ts/commit/3fd87c56e1d7572e7edcd18ebba7d8546f3b2251))

## [0.7.3](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.7.2...ecs-ts/v0.7.3) (2025-09-21)


### 🐛 Bug Fixes

* **ci:** correct NPM publish condition for tag format ([33f1c19](https://github.com/danjdewhurst/ecs-ts/commit/33f1c19e8a16083722c829728b9b485b31f0d1c1))

## [0.7.2](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.7.1...ecs-ts/v0.7.2) (2025-09-21)


### 📚 Documentation

* update documentation to reflect npm package publication ([8c43210](https://github.com/danjdewhurst/ecs-ts/commit/8c4321062a102dba431419c3781d609eb0790260))

## [0.7.1](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.7.0...ecs-ts/v0.7.1) (2025-09-21)


### 🐛 Bug Fixes

* **ci:** add publishConfig for public scoped package publishing ([404bcd8](https://github.com/danjdewhurst/ecs-ts/commit/404bcd8b73371c96f7a3058895007fa90b95b022))

## [0.7.0](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.6.11...ecs-ts/v0.7.0) (2025-09-21)


### ✨ Features

* **ci:** enable automated npm publishing on releases ([f7f04ec](https://github.com/danjdewhurst/ecs-ts/commit/f7f04ec03d354a713c53311a7d94fbd4295b143d))
* enable npm publishing by removing private flag ([c412ca2](https://github.com/danjdewhurst/ecs-ts/commit/c412ca29e41fa5a1f98f9d11f84e32fdf865be16))

## [0.6.11](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.6.10...ecs-ts/v0.6.11) (2025-09-20)


### 📚 Documentation

* complete documentation plan with comprehensive guides and examples ([a58f693](https://github.com/danjdewhurst/ecs-ts/commit/a58f6933d18c3e4b86c7d66213590477c6305bfc))

## [0.6.10](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.6.9...ecs-ts/v0.6.10) (2025-09-20)


### 📚 Documentation

* complete comprehensive API documentation and guides ([b13f3e2](https://github.com/danjdewhurst/ecs-ts/commit/b13f3e2614d5dafc8343c3f55e9feeda4fc74e5f))
* update DOCS_PLAN.md to reflect completed documentation ([ac9b79d](https://github.com/danjdewhurst/ecs-ts/commit/ac9b79da1ca64ab9d45d055f4588d1507e7a08ae))

## [0.6.9](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.6.8...ecs-ts/v0.6.9) (2025-09-20)


### 📚 Documentation

* add comprehensive documentation structure and Priority 1 content ([6765e55](https://github.com/danjdewhurst/ecs-ts/commit/6765e5551ec21335a82c985d6ddb60790b1b0658))
* complete core API reference and begin advanced features ([f4c59aa](https://github.com/danjdewhurst/ecs-ts/commit/f4c59aa99cbfe01966da4be787eb637cda18ef41))

## [0.6.8](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.6.7...ecs-ts/v0.6.8) (2025-09-20)


### 🐛 Bug Fixes

* **ci:** handle forward slashes in release archive paths ([d90ac2f](https://github.com/danjdewhurst/ecs-ts/commit/d90ac2f396afb21e8016f0d874fa943aa54f167c))

## [0.6.7](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.6.6...ecs-ts/v0.6.7) (2025-09-20)


### 🐛 Bug Fixes

* **ci:** correct archive path in release workflow ([663c519](https://github.com/danjdewhurst/ecs-ts/commit/663c51959532c7a3df0429dd190be32af8a6bec1))

## [0.6.6](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.6.5...ecs-ts/v0.6.6) (2025-09-20)


### 🎨 Maintenance

* **docs:** update README for completed Phase 5 and 6 ([0d5d6f3](https://github.com/danjdewhurst/ecs-ts/commit/0d5d6f328cb788dd1ffd4257fab708824e4debec))

## [0.6.5](https://github.com/danjdewhurst/ecs-ts/compare/ecs-ts/v0.6.4...ecs-ts/v0.6.5) (2025-09-20)


### 🎨 Maintenance

* **docs:** update documentation for completed Phase 6 ([921d198](https://github.com/danjdewhurst/ecs-ts/commit/921d198ff5ef0321d079611a3d12ae22d89dca0d))

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
