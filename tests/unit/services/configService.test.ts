import { ConfigService } from '../../../src/services/configService';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs-extra';

describe('ConfigService', () => {
  let configService: any;
  const mockHomedir = '/mock/home';
  const mockConfigPath = path.join(mockHomedir, '.carver', 'config.json');

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(os, 'homedir').mockReturnValue(mockHomedir);
    configService = new ConfigService();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('load()', () => {
    test('should load config from default location', async () => {
      const mockConfig = { apiUrl: 'https://api.carver.dev' };
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readJSON as jest.Mock).mockResolvedValue(mockConfig);

      await configService.load();

      expect(fs.readJSON).toHaveBeenCalledWith(mockConfigPath);
      expect(configService.get('apiUrl')).toEqual('https://api.carver.dev');
    });

    test('should create default config if not exists', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.ensureDir as jest.Mock).mockResolvedValue(undefined);
      (fs.writeJSON as jest.Mock).mockResolvedValue(undefined);

      await configService.load();

      expect(fs.ensureDir).toHaveBeenCalledWith(path.dirname(mockConfigPath));
      expect(fs.writeJSON).toHaveBeenCalledWith(
        mockConfigPath,
        expect.objectContaining({
          apiUrl: expect.any(String),
        }),
        { spaces: 2 },
      );
    });

    test('should throw error if config cannot be loaded', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readJSON as jest.Mock).mockRejectedValue(new Error('Failed to read config'));

      await expect(configService.load()).rejects.toThrow('Failed to read config');
    });
  });

  describe('get()', () => {
    test('should return config value by key', async () => {
      const mockConfig = {
        apiUrl: 'https://api.carver.dev',
        apiKey: 'test-api-key',
        projectId: 'test-project-id',
      };
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readJSON as jest.Mock).mockResolvedValue(mockConfig);

      await configService.load();

      expect(configService.get('apiUrl')).toEqual('https://api.carver.dev');
      expect(configService.get('apiKey')).toEqual('test-api-key');
      expect(configService.get('projectId')).toEqual('test-project-id');
    });

    test('should return undefined for non-existent key', async () => {
      const mockConfig = { apiUrl: 'https://api.carver.dev' };
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readJSON as jest.Mock).mockResolvedValue(mockConfig);

      await configService.load();

      expect(configService.get('nonExistentKey')).toBeUndefined();
    });
  });

  describe('set()', () => {
    test('should update config value', async () => {
      const mockConfig = { apiUrl: 'https://api.carver.dev' };
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readJSON as jest.Mock).mockResolvedValue(mockConfig);
      (fs.writeJSON as jest.Mock).mockResolvedValue(undefined);

      await configService.load();
      await configService.set('apiKey', 'new-api-key');

      expect(configService.get('apiKey')).toEqual('new-api-key');
      expect(fs.writeJSON).toHaveBeenCalledWith(
        mockConfigPath,
        expect.objectContaining({
          apiUrl: 'https://api.carver.dev',
          apiKey: 'new-api-key',
        }),
        { spaces: 2 },
      );
    });

    test('should throw error if config not loaded', async () => {
      expect(() => configService.set('apiKey', 'test-value')).toThrow('Config not loaded');
    });
  });

  describe('save()', () => {
    test('should save config to file', async () => {
      const mockConfig = { apiUrl: 'https://api.carver.dev' };
      (fs.existsSync as jest.Mock).mockReturnValue(true);
      (fs.readJSON as jest.Mock).mockResolvedValue(mockConfig);
      (fs.writeJSON as jest.Mock).mockResolvedValue(undefined);

      await configService.load();
      await configService.save();

      expect(fs.writeJSON).toHaveBeenCalledWith(
        mockConfigPath,
        expect.objectContaining({
          apiUrl: 'https://api.carver.dev',
        }),
        { spaces: 2 },
      );
    });

    test('should throw error if config not loaded', async () => {
      await expect(configService.save()).rejects.toThrow('Config not loaded');
    });
  });

  describe('getConfigPath()', () => {
    test('should return default config path', () => {
      const path = configService.getConfigPath();
      expect(path).toEqual(mockConfigPath);
    });

    test('should return custom config path', () => {
      const customDir = '/custom/dir';
      const path = configService.getConfigPath(customDir);
      expect(path).toEqual('/custom/dir/.carver/config.json');
    });
  });
});
