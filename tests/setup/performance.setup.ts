import path from 'path';
import fs from 'fs-extra';

// Set timeout for performance tests
jest.setTimeout(60000);

// Create performance test directory if it doesn't exist
const PERF_TEST_DIR = path.join(__dirname, '../fixtures/perf-project');

// Global setup for performance tests
beforeAll(async () => {
  // Ensure performance test directory exists
  await fs.ensureDir(PERF_TEST_DIR);
});

// Global teardown for performance tests
afterAll(async () => {
  // Clean up test directories after performance tests
  await fs.remove(PERF_TEST_DIR);
});
