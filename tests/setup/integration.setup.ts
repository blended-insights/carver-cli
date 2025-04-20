import nock from 'nock';

// Set timeout for integration tests
jest.setTimeout(10000);

// Global setup for integration tests
beforeAll(() => {
  // Disable real HTTP requests
  nock.disableNetConnect();
  // Allow localhost connections for local testing
  nock.enableNetConnect('127.0.0.1');
});

// After each test, clean up any remaining mocks
afterEach(() => {
  nock.cleanAll();
});

// Global teardown for integration tests
afterAll(() => {
  nock.enableNetConnect();
  jest.restoreAllMocks();
});
