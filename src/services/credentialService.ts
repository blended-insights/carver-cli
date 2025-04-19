import * as keytar from 'keytar';
import { logger } from '../utils/logger';

const SERVICE_NAME = 'carver-cli';

export class CredentialService {
  /**
   * Store API key securely
   * @param key API key to store
   * @returns Promise that resolves when the key is stored
   */
  async storeApiKey(key: string): Promise<void> {
    try {
      await keytar.setPassword(SERVICE_NAME, 'api-key', key);
      logger.debug('API key stored securely');
    } catch (error) {
      logger.error('Failed to store API key:', error);
      throw new Error('Failed to securely store API key');
    }
  }

  /**
   * Retrieve stored API key
   * @returns Promise that resolves with the stored API key, or null if not found
   */
  async getApiKey(): Promise<string | null> {
    try {
      const key = await keytar.getPassword(SERVICE_NAME, 'api-key');
      return key;
    } catch (error) {
      logger.error('Failed to retrieve API key:', error);
      return null;
    }
  }

  /**
   * Delete stored API key
   * @returns Promise that resolves when the key is deleted
   */
  async deleteApiKey(): Promise<boolean> {
    try {
      const result = await keytar.deletePassword(SERVICE_NAME, 'api-key');
      if (result) {
        logger.debug('API key deleted');
      } else {
        logger.debug('No API key found to delete');
      }
      return result;
    } catch (error) {
      logger.error('Failed to delete API key:', error);
      return false;
    }
  }

  /**
   * Store project-specific credentials
   * @param projectId Project ID
   * @param credentials Credentials to store
   * @returns Promise that resolves when the credentials are stored
   */
  async storeProjectCredentials(projectId: string, credentials: any): Promise<void> {
    try {
      await keytar.setPassword(SERVICE_NAME, `project-${projectId}`, JSON.stringify(credentials));
      logger.debug(`Credentials stored for project ${projectId}`);
    } catch (error) {
      logger.error(`Failed to store credentials for project ${projectId}:`, error);
      throw new Error('Failed to securely store project credentials');
    }
  }

  /**
   * Retrieve project-specific credentials
   * @param projectId Project ID
   * @returns Promise that resolves with the stored credentials, or null if not found
   */
  async getProjectCredentials(projectId: string): Promise<any | null> {
    try {
      const credentialsJson = await keytar.getPassword(SERVICE_NAME, `project-${projectId}`);
      if (!credentialsJson) {
        return null;
      }
      return JSON.parse(credentialsJson);
    } catch (error) {
      logger.error(`Failed to retrieve credentials for project ${projectId}:`, error);
      return null;
    }
  }

  /**
   * Delete project-specific credentials
   * @param projectId Project ID
   * @returns Promise that resolves when the credentials are deleted
   */
  async deleteProjectCredentials(projectId: string): Promise<boolean> {
    try {
      const result = await keytar.deletePassword(SERVICE_NAME, `project-${projectId}`);
      if (result) {
        logger.debug(`Credentials deleted for project ${projectId}`);
      } else {
        logger.debug(`No credentials found for project ${projectId}`);
      }
      return result;
    } catch (error) {
      logger.error(`Failed to delete credentials for project ${projectId}:`, error);
      return false;
    }
  }
}
