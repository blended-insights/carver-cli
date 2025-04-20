import mockFs from 'mock-fs';
import os from 'os';
import path from 'path';

/**
 * Setup mock file system with default structure
 * @param initialStructure Custom file structure to add
 */
function setupMockFs(initialStructure = {}) {
  mockFs({
    // Mock home directory with default .carver config
    [os.homedir()]: {
      '.carver': {
        'config.json': JSON.stringify({
          apiUrl: 'https://api.carver.dev',
        }),
      },
    },
    // Add test project structure
    '/test-project': {
      'package.json': JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
      }),
      src: {
        'index.js': 'console.log("Hello world");',
        utils: {
          'helpers.js': 'export const add = (a, b) => a + b;',
        },
      },
      '.gitignore': 'node_modules\n.DS_Store\n',
    },
    // Allow temp directory access
    '/tmp': {},
    // Custom structure passed by the test
    ...initialStructure,
  });
}

/**
 * Clean up mock file system
 */
function cleanupMockFs() {
  mockFs.restore();
}

/**
 * Project options for creating mock project
 */
interface MockProjectOptions {
  includeCarverConfig?: boolean;
  includeGitIgnore?: boolean;
  fileCount?: number;
}

/**
 * Create a mock project directory structure
 * @param dir Base directory for the project
 * @param options Project options
 */
function createMockProject(dir, options: MockProjectOptions = {}) {
  const { includeCarverConfig = true, includeGitIgnore = true, fileCount = 5 } = options;

  const fsStructure = {
    [dir]: {
      'package.json': JSON.stringify({
        name: path.basename(dir),
        version: '1.0.0',
      }),
      src: {},
    },
  };

  // Add .carver config if needed
  if (includeCarverConfig) {
    fsStructure[dir]['.carver'] = {
      'config.json': JSON.stringify({
        apiKey: 'test-api-key',
        projectId: 'test-project-id',
        lastSync: new Date().toISOString(),
      }),
    };
  }

  // Add .gitignore if needed
  if (includeGitIgnore) {
    fsStructure[dir]['.gitignore'] = 'node_modules\n.DS_Store\n.carver\n';
  }

  // Generate source files
  for (let i = 0; i < fileCount; i++) {
    fsStructure[dir]['src'][`file${i}.js`] = `// This is test file ${i}\nconsole.log("File ${i}");`;
  }

  // Setup mock filesystem with this structure
  setupMockFs(fsStructure);

  return dir;
}

export { setupMockFs, cleanupMockFs, createMockProject };
