/* eslint-disable no-console */

import * as fs from 'fs-extra';
import path from 'path';
import { exec, spawn } from '../../utils/exec';
import { delay } from '../../utils/time';
import { createMockProject } from '../../mocks/fs';

describe('Project Lifecycle E2E', () => {
  const tmpDir = path.join(__dirname, '../../fixtures/e2e-project');
  let watchProcess: ReturnType<typeof spawn> | undefined;

  beforeAll(async () => {
    // Create fresh test directory
    if (fs.existsSync(tmpDir)) {
      await fs.remove(tmpDir);
    }
    await fs.ensureDir(tmpDir);
  });

  afterAll(async () => {
    // Clean up after all tests
    if (fs.existsSync(tmpDir)) {
      await fs.remove(tmpDir);
    }
  });

  afterEach(async () => {
    // Kill watch process if it's running
    if (watchProcess) {
      watchProcess.kill();
      await delay(500); // Wait for process to terminate
    }

    // Clean up .carver directory
    if (fs.existsSync(path.join(tmpDir, '.carver'))) {
      await fs.remove(path.join(tmpDir, '.carver'));
    }
  });

  test('complete project lifecycle', async () => {
    // Skip this test when running in CI environment
    if (process.env.CI) {
      console.log('Skipping E2E test in CI environment');
      return;
    }

    // Create a test project
    createMockProject(tmpDir, {
      includeCarverConfig: false,
      includeGitIgnore: true,
      fileCount: 10,
    });

    // Change to test directory
    process.chdir(tmpDir);

    // Step 1: Initialize project
    console.log('Step 1: Initializing project...');
    let result = await exec('node', [
      '../../../bin/carver.js',
      'init',
      '--key=test-api-key',
      '--project=test-hub-project',
    ]);

    // Verify initialization
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Project initialized successfully');
    expect(fs.existsSync(path.join(tmpDir, '.carver'))).toBe(true);
    expect(fs.existsSync(path.join(tmpDir, '.carver', 'config.json'))).toBe(true);

    // Verify config file
    const config = await fs.readJSON(path.join(tmpDir, '.carver', 'config.json'));
    expect(config.apiKey).toBe('test-api-key');
    expect(config.projectId).toBe('test-hub-project');

    // Step 2: Check status
    console.log('Step 2: Checking status...');
    result = await exec('node', ['../../../bin/carver.js', 'status']);

    // Initially, files should need syncing
    expect(result.stdout).toContain('pending');

    // Step 3: Sync project
    console.log('Step 3: Syncing project...');
    result = await exec('node', ['../../../bin/carver.js', 'sync']);

    // Verify sync completed
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Synchronization complete');

    // Step 4: Start file watcher
    console.log('Step 4: Starting file watcher...');
    watchProcess = spawn('node', ['../../../bin/carver.js', 'watch']);

    // Collect output for verification
    let watchOutput = '';
    watchProcess.stdout?.on('data', (data) => {
      watchOutput += data.toString();
    });

    // Wait for watcher to initialize
    await delay(3000);
    expect(watchOutput).toContain('Watching for changes');

    // Step 5: Create a new file
    console.log('Step 5: Creating a new file...');
    const newFilePath = path.join(tmpDir, 'src', 'newFeature.js');
    await fs.writeFile(newFilePath, 'console.log("New feature");');

    // Wait for file to be processed
    await delay(2000);
    expect(watchOutput).toContain('File changed');

    // Step 6: Check status again
    console.log('Step 6: Checking status after changes...');
    result = await exec('node', ['../../../bin/carver.js', 'status']);

    // Should show pending changes
    expect(result.stdout).toContain('pending');

    // Step 7: Sync changes
    console.log('Step 7: Syncing changes...');
    result = await exec('node', ['../../../bin/carver.js', 'sync']);

    // Verify sync completed
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Synchronization complete');

    // Step 8: Delete the file
    console.log('Step 8: Deleting the file...');
    await fs.remove(newFilePath);

    // Wait for file deletion to be processed
    await delay(2000);
    expect(watchOutput).toContain('File deleted');

    // Step 9: Final sync
    console.log('Step 9: Final sync...');
    result = await exec('node', ['../../../bin/carver.js', 'sync']);

    // Verify final sync completed
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Synchronization complete');

    // Step 10: Verify final status
    console.log('Step 10: Verifying final status...');
    result = await exec('node', ['../../../bin/carver.js', 'status']);

    // Should show all files in sync
    expect(result.stdout).toContain('All files in sync');

    // Step 11: Test prompt command
    console.log('Step 11: Testing prompt command...');
    result = await exec('node', [
      '../../../bin/carver.js',
      'prompt',
      '"Add a function to calculate factorial"',
    ]);

    // Verify prompt command
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Response:');

    // Step 12: Logout
    console.log('Step 12: Logging out...');
    result = await exec('node', ['../../../bin/carver.js', 'logout']);

    // Verify logout completed
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain('Logged out successfully');
  }, 60000); // Set timeout to 60 seconds for this test
});
