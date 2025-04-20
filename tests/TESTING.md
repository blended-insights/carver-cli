# Carver CLI Testing Guide

This document describes the testing approach for the Carver CLI project, including instructions for running tests and creating new tests.

## Test Types

The project includes the following types of tests:

### Unit Tests

Unit tests focus on individual components in isolation:

- **Location**: `tests/unit/`
- **Run with**: `npm run test:unit`
- **Target coverage**: 90%+

Unit tests verify the behavior of individual classes, functions, and methods without external dependencies. Dependencies are mocked using Jest's mocking capabilities.

Example test files:

- `tests/unit/services/configService.test.ts`
- `tests/unit/utils/logger.test.ts`

### Integration Tests

Integration tests verify interactions between components:

- **Location**: `tests/integration/`
- **Run with**: `npm run test:integration`
- **Target coverage**: 70%+

Integration tests focus on verifying that different parts of the system work together correctly. They test command flows and API interactions using mocked external dependencies.

Example test files:

- `tests/integration/commands/init.test.ts`
- `tests/integration/commands/login.test.ts`

### End-to-End Tests

E2E tests verify the entire CLI workflow:

- **Location**: `tests/e2e/`
- **Run with**: `npm run test:e2e`
- **Target coverage**: Cover all critical user workflows

E2E tests simulate real user interactions with the CLI, executing sequences of commands and verifying their effects.

Example test files:

- `tests/e2e/workflows/project-lifecycle.test.ts`

### Performance Tests

Performance tests focus on execution speed and resource usage:

- **Location**: `tests/performance/`
- **Run with**: `npm run test:performance`

Performance tests measure metrics like execution time and memory consumption to ensure the CLI remains efficient.

Example test files:

- `tests/performance/scan-performance.test.ts`
- `tests/performance/watcher-memory.test.ts`

## Running Tests

- Run all tests: `npm test`
- Run unit tests: `npm run test:unit`
- Run integration tests: `npm run test:integration`
- Run E2E tests: `npm run test:e2e`
- Run performance tests: `npm run test:performance`
- Run with coverage report: `npm run test:coverage`
- Run in watch mode: `npm run test:watch`

## Test Configuration

Tests are configured using Jest. The main configuration file is located at `jest.config.js`. This configuration file sets up different test environments for each test type.

### Setup Files

Each test type has its own setup file:

- Unit tests: `tests/setup/unit.setup.ts`
- Integration tests: `tests/setup/integration.setup.ts`
- E2E tests: `tests/setup/e2e.setup.ts`
- Performance tests: `tests/setup/performance.setup.ts`

These setup files handle common initialization and cleanup tasks for each test type.

## Mocking Strategy

### API Mocking

API interactions are mocked using `nock`. Helper functions for creating common API mocks are available in `tests/mocks/api.ts`.

Example usage:

```typescript
import { mockApiAuth, mockProjectInit } from '../../mocks/api';

// Mock successful authentication
const authMock = mockApiAuth(true);

// Mock project initialization
const initMock = mockProjectInit('test-project-id');

// Verify mocks were called
expect(authMock.isDone()).toBe(true);
expect(initMock.isDone()).toBe(true);
```

### File System Mocking

File system operations are mocked using `mock-fs`. Helper functions for setting up mock file systems are available in `tests/mocks/fs.ts`.

Example usage:

```typescript
import { setupMockFs, cleanupMockFs } from '../../mocks/fs';

beforeEach(() => {
  // Set up mock file system
  setupMockFs({
    '/test-project': {
      'package.json': JSON.stringify({ name: 'test-project' }),
      src: {
        'index.js': 'console.log("Hello world");',
      },
    },
  });
});

afterEach(() => {
  // Clean up mock file system
  cleanupMockFs();
});
```

## Test Fixtures

Reusable test fixtures are available in the `tests/fixtures/` directory. This includes:

- Test projects
- Sample files
- Configuration templates

## Test Utilities

### Command Execution

The `tests/utils/exec.ts` file provides utilities for executing commands and spawning processes:

```typescript
import { exec, spawn } from '../../utils/exec';

// Execute a command and get the result
const { stdout, stderr, exitCode } = await exec('node', [
  '../bin/carver.js',
  'init',
  '--key=test-api-key',
]);

// Spawn a long-running process
const process = spawn('node', ['../bin/carver.js', 'watch']);
```

### Time Utilities

The `tests/utils/time.ts` file provides utilities for working with time:

```typescript
import { delay, measureTime } from '../../utils/time';

// Wait for a specified time
await delay(1000); // Wait for 1 second

// Measure execution time
const { result, duration } = await measureTime(async () => {
  // Function to measure
  return await someAsyncFunction();
});
```

### Process Utilities

The `tests/utils/process.ts` file provides utilities for working with processes:

```typescript
import { getProcessMemoryUsage } from '../../utils/process';

// Get memory usage of a process
const memoryUsage = await getProcessMemoryUsage(process.pid);
```

## Creating New Tests

When creating new tests, follow these guidelines:

### File Naming and Location

- Place tests in the appropriate directory based on test type
- Name test files with `.test.ts` extension
- Use descriptive names that indicate what functionality is being tested

### Test Structure

- Use descriptive test names with the pattern `should [expected behavior]`
- Group related tests using `describe` blocks
- Use `beforeEach` and `afterEach` for setup and cleanup
- Isolate tests from each other (no test should depend on another test)

Example structure:

```typescript
describe('ConfigService', () => {
  let configService: ConfigService;

  beforeEach(() => {
    // Setup
    configService = new ConfigService();
  });

  afterEach(() => {
    // Cleanup
  });

  describe('load()', () => {
    test('should load config from default location', async () => {
      // Test implementation
    });

    test('should create default config if not exists', async () => {
      // Test implementation
    });
  });

  // More test groups...
});
```

### Mock External Dependencies

- Always mock external dependencies in unit tests
- Use the provided mocking utilities
- Verify that mocks were called correctly

### Check Test Coverage

- Run `npm run test:coverage` to generate a coverage report
- Address areas with low coverage
- Aim for the target coverage percentages for each test type

## Troubleshooting Tests

### Tests Fail in CI but Pass Locally

- Check for platform-specific issues
- Ensure all paths use proper path separators
- Verify that timeouts are appropriate for CI environment

### Flaky Tests

- Increase timeouts for asynchronous operations
- Ensure proper cleanup between tests
- Add additional logging to diagnose issues

### Performance Test Failures

- Adjust thresholds based on the CI environment
- Skip performance tests in CI if necessary
- Use environment variables to control test behavior

## Adding New Test Types

To add a new test type:

1. Create a new directory under `tests/`
2. Add a setup file in `tests/setup/`
3. Update `jest.config.js` to include the new test type
4. Add a new script to `package.json`

## Continuous Integration

Tests are automatically run in the CI pipeline for:

- Pull requests to main branch
- Pushes to main and develop branches

Test results and coverage reports are available in the CI pipeline interface.
