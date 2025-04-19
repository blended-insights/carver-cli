import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Test directory setup
const TEST_DIR = path.join(__dirname, '../../fixtures/test-project');

describe('Init Command Integration', () => {
  beforeEach(() => {
    // Create test directory if it doesn't exist
    if (!fs.existsSync(TEST_DIR)) {
      fs.mkdirSync(TEST_DIR, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test directory
    if (fs.existsSync(path.join(TEST_DIR, '.carver'))) {
      fs.rmSync(path.join(TEST_DIR, '.carver'), { recursive: true, force: true });
    }
    if (fs.existsSync(path.join(TEST_DIR, '.gitignore'))) {
      fs.unlinkSync(path.join(TEST_DIR, '.gitignore'));
    }
  });

  it('should initialize a project with the provided key and project ID', async () => {
    // Mock API key and project ID for test
    const testApiKey = 'test-api-key';
    const testProjectId = 'test-project-id';
    
    // Run the init command
    await execAsync(`node ../../bin/carver.js init --key ${testApiKey} --project ${testProjectId} --directory ${TEST_DIR}`);
    
    // Verify .carver directory was created
    expect(fs.existsSync(path.join(TEST_DIR, '.carver'))).toBe(true);
    
    // Verify config file was created with correct values
    const configPath = path.join(TEST_DIR, '.carver', 'config.json');
    expect(fs.existsSync(configPath)).toBe(true);
    
    const configContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(configContent);
    
    expect(config.apiKey).toBe(testApiKey);
    expect(config.projectId).toBe(testProjectId);
    expect(config).toHaveProperty('lastSync');
    
    // Verify .gitignore was updated
    const gitignorePath = path.join(TEST_DIR, '.gitignore');
    expect(fs.existsSync(gitignorePath)).toBe(true);
    
    const gitignoreContent = fs.readFileSync(gitignorePath, 'utf-8');
    expect(gitignoreContent).toContain('.carver/');
  }, 10000); // Increase timeout to 10 seconds for integration test
});
