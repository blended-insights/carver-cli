import path from 'path';
import fs from 'fs-extra';

// Set timeout for E2E tests
jest.setTimeout(30000);

// Create E2E test directory if it doesn't exist
const E2E_TEST_DIR = path.join(__dirname, '../fixtures/e2e-project');

// Global setup for E2E tests
beforeAll(async () => {
  // Ensure E2E test directory exists
  await fs.ensureDir(E2E_TEST_DIR);
});

// Global teardown for E2E tests
afterAll(async () => {
  // Do not remove the test directory after tests
  // This is intentional to allow inspection of results if needed
  // Comment out the line below to enable cleanup
  // await fs.remove(E2E_TEST_DIR);
});
