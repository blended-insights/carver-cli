/* eslint-disable no-console */

import { measureTime } from '../utils/time';
import path from 'path';
import fs from 'fs-extra';
import { exec } from '../utils/exec';
import { createMockProject } from '../mocks/fs';

describe('File Scanning Performance', () => {
  const tmpDir = path.join(__dirname, '../fixtures/perf-project');

  beforeEach(async () => {
    if (fs.existsSync(tmpDir)) {
      await fs.remove(tmpDir);
    }
    await fs.ensureDir(tmpDir);
  });

  afterEach(async () => {
    await fs.remove(tmpDir);
  });

  test('should scan medium project efficiently', async () => {
    // Skip this test in CI environment
    if (process.env.CI) {
      console.log('Skipping performance test in CI environment');
      return;
    }

    // Create project with 500 files
    await createMockProject(tmpDir, {
      includeCarverConfig: false,
      includeGitIgnore: true,
      fileCount: 500,
    });

    // Measure initialization time
    const { duration } = await measureTime(async () => {
      return await exec('node', [
        '../../bin/carver.js',
        'init',
        '--key=test-api-key',
        '--project=test-hub-project',
        '--directory=' + tmpDir,
      ]);
    });

    console.log(`Init command for 500 files completed in ${duration}ms`);

    // Performance assertion - adjust threshold based on observed performance
    expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
  }, 30000);

  test('should scan large project efficiently', async () => {
    // Skip this test in CI environment
    if (process.env.CI) {
      console.log('Skipping performance test in CI environment');
      return;
    }

    // Create project with 1000 files
    await createMockProject(tmpDir, {
      includeCarverConfig: false,
      includeGitIgnore: true,
      fileCount: 1000,
    });

    // Measure initialization time
    const { duration } = await measureTime(async () => {
      return await exec('node', [
        '../../bin/carver.js',
        'init',
        '--key=test-api-key',
        '--project=test-hub-project',
        '--directory=' + tmpDir,
      ]);
    });

    console.log(`Init command for 1000 files completed in ${duration}ms`);

    // Performance assertion - adjust threshold based on observed performance
    expect(duration).toBeLessThan(10000); // Should complete in under 10 seconds
  }, 60000);

  test('should handle projects with deep directory structures', async () => {
    // Skip this test in CI environment
    if (process.env.CI) {
      console.log('Skipping performance test in CI environment');
      return;
    }

    // Create directory structure
    await fs.ensureDir(tmpDir);

    // Create a deep directory structure (5 levels deep)
    await generateDeepDirectoryStructure(tmpDir, 5, 3, 10);

    // Measure initialization time
    const { duration } = await measureTime(async () => {
      return await exec('node', [
        '../../bin/carver.js',
        'init',
        '--key=test-api-key',
        '--project=test-hub-project',
        '--directory=' + tmpDir,
      ]);
    });

    console.log(`Init command for deep directory structure completed in ${duration}ms`);

    // Performance assertion - adjust threshold based on observed performance
    expect(duration).toBeLessThan(15000); // Should complete in under 15 seconds
  }, 60000);
});

/**
 * Generate a deep directory structure recursively
 * @param basePath Base directory path
 * @param depth Maximum depth to create
 * @param breadth Number of subdirectories per directory
 * @param filesPerDir Number of files per directory
 * @param currentDepth Current recursion depth
 */
async function generateDeepDirectoryStructure(
  basePath: string,
  depth: number,
  breadth: number,
  filesPerDir: number,
  currentDepth = 0,
): Promise<void> {
  // Create files in the current directory
  for (let i = 0; i < filesPerDir; i++) {
    const filePath = path.join(basePath, `file-${currentDepth}-${i}.js`);
    await fs.writeFile(
      filePath,
      `// File at depth ${currentDepth}\nconsole.log("File ${i} at depth ${currentDepth}");`,
    );
  }

  // Stop recursion if we've reached maximum depth
  if (currentDepth >= depth) {
    return;
  }

  // Create subdirectories
  for (let i = 0; i < breadth; i++) {
    const dirPath = path.join(basePath, `dir-${currentDepth}-${i}`);
    await fs.ensureDir(dirPath);
    await generateDeepDirectoryStructure(dirPath, depth, breadth, filesPerDir, currentDepth + 1);
  }
}
