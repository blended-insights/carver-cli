// Set timeout for unit tests
jest.setTimeout(5000);

// Global setup for unit tests
beforeAll(() => {
  // Mock console methods to keep tests clean
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

// Global teardown for unit tests
afterAll(() => {
  jest.restoreAllMocks();
});
