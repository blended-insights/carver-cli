import nock from 'nock';

const API_BASE_URL = 'https://api.carver.dev';

/**
 * Mock API authentication endpoint
 * @param success Whether authentication should succeed
 * @returns Nock scope
 */
function mockApiAuth(success = true) {
  if (success) {
    return nock(API_BASE_URL)
      .post('/api/auth/authenticate')
      .reply(200, {
        token: 'mock-token',
        expiresAt: new Date(Date.now() + 3600000).toISOString(),
      });
  } else {
    return nock(API_BASE_URL)
      .post('/api/auth/authenticate')
      .reply(401, {
        error: {
          code: 'auth_failed',
          message: 'Authentication failed',
        },
      });
  }
}

/**
 * Mock API project initialization endpoint
 * @param projectId Project ID to return
 * @returns Nock scope
 */
function mockProjectInit(projectId = 'mock-project-id') {
  return nock(API_BASE_URL).post('/api/projects/initialize').reply(200, {
    projectId,
    status: 'initializing',
  });
}

/**
 * Mock API project sync endpoint
 * @param filesProcessed Number of files processed
 * @returns Nock scope
 */
function mockProjectSync(filesProcessed = 0) {
  return nock(API_BASE_URL).post('/api/projects/sync').reply(200, {
    status: 'success',
    filesProcessed,
  });
}

/**
 * Mock API project status endpoint
 * @param pendingFiles Number of pending files
 * @returns Nock scope
 */
function mockProjectStatus(pendingFiles = 0) {
  return nock(API_BASE_URL)
    .get('/api/projects/status')
    .query(true)
    .reply(200, {
      status: pendingFiles > 0 ? 'pending' : 'synced',
      pendingFiles,
      lastSync: new Date().toISOString(),
    });
}

/**
 * Mock API prompt endpoint
 * @param response Custom response to return
 * @returns Nock scope
 */
function mockPromptEndpoint(response = { content: 'Mock response from AI' }) {
  return nock(API_BASE_URL).post('/api/prompts').reply(200, response);
}

/**
 * Mock WebSocket server connection
 * @param socketIoClient Socket.io client module
 */
function mockWebSocketServer(socketIoClient: { connect: jest.Mock<any, any, any> }) {
  // Create a mock socket instance
  const mockSocket = {
    on: jest.fn(),
    emit: jest.fn(),
    disconnect: jest.fn(),
    connected: true,
  };

  // Mock the socket.io-client connect function
  socketIoClient.connect = jest.fn().mockReturnValue(mockSocket);

  return mockSocket;
}

export {
  API_BASE_URL,
  mockApiAuth,
  mockProjectInit,
  mockProjectSync,
  mockProjectStatus,
  mockPromptEndpoint,
  mockWebSocketServer,
};
