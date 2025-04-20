/* eslint-disable no-console */

import path from 'path';
import fs from 'fs-extra';
import { spawn } from '../utils/exec';
import { getProcessMemoryUsage } from '../utils/process';
import { delay } from '../utils/time';
import { createMockProject } from '../mocks/fs';

describe('File Watcher Resource Usage', () => {
  const tmpDir = path.join(__dirname, '../fixtures/perf-project');
  let watchProcess: any;

  beforeEach(async () => {
    if (fs.existsSync(tmpDir)) {
      await fs.remove(tmpDir);
    }
    await fs.ensureDir(tmpDir);
  });

  afterEach(async () => {
    if (watchProcess) {
      watchProcess.kill();
      await delay(500); // Wait for process to terminate
    }
    await fs.remove(tmpDir);
  });

  test('should maintain reasonable memory usage with medium project', async () => {
    // Skip this test in CI environment
    if (process.env.CI) {
      console.log('Skipping performance test in CI environment');
      return;
    }

    // Create project with 500 files
    await createMockProject(tmpDir, {
      includeCarverConfig: true, // Include config to avoid initialization
      includeGitIgnore: true,
      fileCount: 500,
    });

    // Change to test directory
    process.chdir(tmpDir);

    // Start watch process
    console.log('Starting watcher process...');
    watchProcess = spawn('node', ['../../bin/carver.js', 'watch']);

    // Wait for watcher to initialize
    await delay(5000);

    // Get initial memory usage
    const initialMemoryUsage = await getProcessMemoryUsage(watchProcess.pid);
    console.log(`Initial memory usage: ${(initialMemoryUsage / 1024 / 1024).toFixed(2)} MB`);

    // Make some file changes
    for (let i = 0; i < 50; i++) {
      const filePath = path.join(tmpDir, 'src', `file${i}.js`);
      await fs.appendFile(filePath, `\n// Modification ${Date.now()}`);
      await delay(50); // Short delay between modifications
    }

    // Wait for changes to be processed
    await delay(2000);

    // Check memory usage after changes
    const finalMemoryUsage = await getProcessMemoryUsage(watchProcess.pid);
    console.log(`Final memory usage: ${(finalMemoryUsage / 1024 / 1024).toFixed(2)} MB`);

    // Memory should not increase drastically
    expect(finalMemoryUsage).toBeLessThan(200 * 1024 * 1024); // Less than 200MB

    // Check memory growth
    const memoryGrowth = finalMemoryUsage - initialMemoryUsage;
    console.log(`Memory growth: ${(memoryGrowth / 1024 / 1024).toFixed(2)} MB`);

    // Growth should be reasonable
    expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
  }, 60000);

  test('should handle rapid file changes efficiently', async () => {
    // Skip this test in CI environment
    if (process.env.CI) {
      console.log('Skipping performance test in CI environment');
      return;
    }

    // Create project with 100 files
    await createMockProject(tmpDir, {
      includeCarverConfig: true,
      includeGitIgnore: true,
      fileCount: 100,
    });

    // Change to test directory
    process.chdir(tmpDir);

    // Start watch process
    console.log('Starting watcher process...');
    watchProcess = spawn('node', ['../../bin/carver.js', 'watch']);

    // Collect output for verification
    let watchOutput = '';
    watchProcess.stdout.on('data', (data: Buffer) => {
      watchOutput += data.toString();
    });

    // Wait for watcher to initialize
    await delay(5000);

    // Record start time
    const startTime = Date.now();

    // Make rapid file changes
    const changePromises: Promise<void>[] = [];
    for (let i = 0; i < 20; i++) {
      changePromises.push(
        (async () => {
          const filePath = path.join(tmpDir, 'src', `file${i}.js`);
          // Multiple changes to the same file in rapid succession
          for (let j = 0; j < 5; j++) {
            await fs.appendFile(filePath, `\n// Rapid change ${j} at ${Date.now()}`);
            await delay(10); // Very short delay between modifications
          }
        })(),
      );
    }

    // Wait for all changes to complete
    await Promise.all(changePromises);

    // Wait for changes to be processed
    await delay(5000);

    // Record end time
    const endTime = Date.now();
    const processingTime = endTime - startTime;

    console.log(`Processed 100 rapid changes in ${processingTime}ms`);

    // Processing should be reasonably fast
    expect(processingTime).toBeLessThan(30000); // Should process in under 30 seconds

    // Verify that changes were detected
    expect(watchOutput).toContain('File changed');
  }, 60000);
});
