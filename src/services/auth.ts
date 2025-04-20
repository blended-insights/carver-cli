/* eslint-disable camelcase */

import axios, { AxiosInstance } from 'axios';
import { getConfig } from '../utils/config';
import { logger } from '../utils/logger';
import { CredentialService } from './credentialService';

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // timestamp in milliseconds
}

export interface AuthOptions {
  apiEndpoint?: string;
  timeout?: number;
}

/**
 * AuthService handles authentication and token management for the Carver API
 */
export class AuthService {
  private client: AxiosInstance;
  private credentialService: CredentialService;
  private tokens: AuthTokens | null = null;
  private refreshPromise: Promise<AuthTokens> | null = null;
  private tokenRefreshThreshold = 5 * 60 * 1000; // 5 minutes in milliseconds

  constructor(options?: AuthOptions) {
    this.credentialService = new CredentialService();

    const config = getConfig();

    // Initialize axios client specifically for auth operations
    this.client = axios.create({
      baseURL: options?.apiEndpoint || config.apiEndpoint,
      timeout: options?.timeout || config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': `carver-cli/${config.version || '1.0.0'}`,
      },
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response) {
          logger.error(`Auth Error: ${error.response.status} ${error.response.statusText}`);
          logger.debug('Auth Error Details:', error.response.data);
        } else if (error.request) {
          logger.error('Auth Error: No response received');
        } else {
          logger.error('Auth Error:', error.message);
        }

        return Promise.reject(error);
      },
    );
  }

  /**
   * Authenticate with API key
   * @param apiKey API key
   * @returns Authentication result
   */
  async authenticateWithApiKey(apiKey: string): Promise<boolean> {
    try {
      const response = await this.client.post('/auth/token', {
        apiKey,
        grant_type: 'api_key',
      });

      if (response.status === 200 && response.data.accessToken) {
        // Store tokens in memory
        this.tokens = {
          accessToken: response.data.accessToken,
          refreshToken: response.data.refreshToken,
          expiresAt: Date.now() + response.data.expiresIn * 1000,
        };

        // Store API key securely
        await this.credentialService.storeApiKey(apiKey);

        logger.debug('Authentication successful');
        return true;
      }

      logger.error('Authentication failed: Invalid response format');
      return false;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('Authentication failed:', errorMessage);
      return false;
    }
  }

  /**
   * Get the current access token, refreshing if necessary
   * @returns Valid access token
   */
  async getAccessToken(): Promise<string> {
    // If we don't have tokens, try to authenticate with stored API key
    if (!this.tokens) {
      const apiKey = await this.credentialService.getApiKey();
      if (apiKey) {
        const success = await this.authenticateWithApiKey(apiKey);
        if (!success) {
          throw new Error('Failed to authenticate with stored API key');
        }
      } else {
        throw new Error('No authentication credentials available');
      }
    }

    // Check if token is about to expire
    if (this.tokens && this.tokens.expiresAt - Date.now() < this.tokenRefreshThreshold) {
      // Refresh token if it's about to expire
      await this.refreshAccessToken();
    }

    return this.tokens!.accessToken;
  }

  /**
   * Refresh the access token using the refresh token
   * @returns New auth tokens
   */
  async refreshAccessToken(): Promise<AuthTokens> {
    // If there's already a refresh in progress, return that promise
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    // Create a new refresh promise
    this.refreshPromise = (async () => {
      try {
        if (!this.tokens || !this.tokens.refreshToken) {
          throw new Error('No refresh token available');
        }

        const response = await this.client.post('/auth/token', {
          refresh_token: this.tokens.refreshToken,
          grant_type: 'refresh_token',
        });

        if (response.status === 200 && response.data.accessToken) {
          this.tokens = {
            accessToken: response.data.accessToken,
            refreshToken: response.data.refreshToken || this.tokens.refreshToken,
            expiresAt: Date.now() + response.data.expiresIn * 1000,
          };

          logger.debug('Token refreshed successfully');
          return this.tokens;
        }

        throw new Error('Invalid response from token refresh endpoint');
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Failed to refresh token:', errorMessage);

        // Clear tokens to force a full re-authentication on next request
        this.tokens = null;

        throw new Error('Failed to refresh access token');
      } finally {
        // Clear the refresh promise
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Logout and clear stored credentials
   */
  async logout(): Promise<void> {
    // Clear in-memory tokens
    this.tokens = null;

    // Clear stored API key
    await this.credentialService.deleteApiKey();

    logger.debug('Logged out successfully');
  }

  /**
   * Check if the user is authenticated
   * @returns Authentication status
   */
  async isAuthenticated(): Promise<boolean> {
    try {
      // Try to get a valid access token
      await this.getAccessToken();
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate authentication headers for API requests
   * @returns Headers object with authorization
   */
  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAccessToken();
    return {
      Authorization: `Bearer ${token}`,
    };
  }
}
