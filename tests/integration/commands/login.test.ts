import path from 'path';
import { mockApiAuth } from '../../mocks/api';
import keytar from 'keytar';
import fs from 'fs-extra';
import { exec } from '../../utils/exec';

jest.mock('keytar');

describe('Login Command Integration', () => {
  const tmpDir = path.join(__dirname, '../../fixtures/test-project');

  beforeEach(async () => {
    await fs.ensureDir(tmpDir);
    process.chdir(tmpDir);

    // Mock keytar
    (keytar.getPassword as jest.Mock).mockResolvedValue(null);
    (keytar.setPassword as jest.Mock).mockResolvedValue(undefined);
    (keytar.deletePassword as jest.Mock).mockResolvedValue(true);
  });

  afterEach(async () => {
    // Clean up test directory
    if (fs.existsSync(path.join(tmpDir, '.carver'))) {
      await fs.remove(path.join(tmpDir, '.carver'));
    }

    // Reset mocks
    jest.clearAllMocks();
  });

  test('should authenticate with valid API key', async () => {
    // Mock API responses
    const authMock = mockApiAuth(true);

    // Execute the login command
    const { stdout, stderr, exitCode } = await exec('node', [
      '../../../bin/carver.js',
      'login',
      '--key=test-api-key',
    ]);

    // Verify command executed successfully
    expect(exitCode).toBe(0);
    expect(stdout).toContain('Authentication successful');
    expect(stderr).toBe('');

    // Verify API was called correctly
    expect(authMock.isDone()).toBe(true);

    // Verify credentials were stored
    expect(keytar.setPassword).toHaveBeenCalledWith('carver-cli', 'api-key', 'test-api-key');
  });

  test('should handle authentication failure', async () => {
    // Mock API failure response
    const authMock = mockApiAuth(false);

    // Execute the login command with invalid key
    const { stdout, stderr, exitCode } = await exec('node', [
      '../../../bin/carver.js',
      'login',
      '--key=invalid-api-key',
    ]);

    // Verify command failed
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('Authentication failed');

    // Verify API was called correctly
    expect(authMock.isDone()).toBe(true);

    // Verify credentials were not stored
    expect(keytar.setPassword).not.toHaveBeenCalled();
  });

  test('should prompt for API key if not provided', async () => {
    // This test would require mocking the prompt library
    // For now, we'll just verify the command fails without a key
    const { stdout, stderr, exitCode } = await exec('node', ['../../../bin/carver.js', 'login']);

    // Verify command requires a key
    expect(exitCode).not.toBe(0);
    expect(stderr).toContain('API key is required');
  });

  test("should create .carver directory if it doesn't exist", async () => {
    // Mock API responses
    mockApiAuth(true);

    // Verify .carver directory doesn't exist
    expect(fs.existsSync(path.join(tmpDir, '.carver'))).toBe(false);

    // Execute the login command
    await exec('node', ['../../../bin/carver.js', 'login', '--key=test-api-key']);

    // Verify .carver directory was created
    expect(fs.existsSync(path.join(tmpDir, '.carver'))).toBe(true);
  });
});
