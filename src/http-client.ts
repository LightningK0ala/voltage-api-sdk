import type { VoltageApiConfig, ApiResponse, ApiError } from './types';

export class VoltageApiError extends Error implements ApiError {
  public status?: number;
  public code?: string;
  public details?: unknown;

  constructor(message: string, status?: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'VoltageApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeout?: number;
}

export class HttpClient {
  private baseUrl: string;
  private apiKey?: string;
  private bearerToken?: string;
  private timeout: number;

  constructor(config: VoltageApiConfig) {
    this.baseUrl = config.baseUrl || 'https://voltageapi.com/v1';
    this.apiKey = config.apiKey;
    this.bearerToken = config.bearerToken;
    this.timeout = config.timeout || 30000;

    // Ensure baseUrl doesn't end with a slash
    if (this.baseUrl.endsWith('/')) {
      this.baseUrl = this.baseUrl.slice(0, -1);
    }

    // Check if fetch is available
    if (typeof fetch === 'undefined') {
      throw new Error(
        'Fetch is not available. Please use Node.js 18+ or provide a fetch polyfill.'
      );
    }
  }

  private getAuthHeaders(): Record<string, string> {
    const headers: Record<string, string> = {};

    if (this.bearerToken) {
      headers['Authorization'] = `Bearer ${this.bearerToken}`;
    } else if (this.apiKey) {
      headers['X-Api-Key'] = this.apiKey;
    }

    return headers;
  }

  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    let timeoutId: NodeJS.Timeout | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = setTimeout(() => reject(new VoltageApiError('Request timeout', 408)), timeoutMs);
    });

    try {
      const result = await Promise.race([promise, timeoutPromise]);
      if (timeoutId) clearTimeout(timeoutId);
      return result;
    } catch (error) {
      if (timeoutId) clearTimeout(timeoutId);
      throw error;
    }
  }

  async request<T>(endpoint: string, options: RequestOptions = {}): Promise<ApiResponse<T>> {
    const { method = 'GET', body, headers = {}, timeout = this.timeout } = options;

    const url = `${this.baseUrl}${endpoint}`;
    const authHeaders = this.getAuthHeaders();

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...headers,
    };

    const config: RequestInit = {
      method,
      headers: requestHeaders,
    };

    if (body && method !== 'GET') {
      config.body = JSON.stringify(body);
    }

    try {
      const response = await this.withTimeout(fetch(url, config), timeout);

      const responseText = await response.text();
      let data: T;

      try {
        data = responseText ? JSON.parse(responseText) : null;
      } catch (parseError) {
        throw new VoltageApiError(
          'Failed to parse response as JSON',
          response.status,
          'PARSE_ERROR',
          parseError
        );
      }

      if (!response.ok) {
        const errorMessage =
          typeof data === 'object' && data !== null && 'message' in data
            ? (data as { message: string }).message
            : `HTTP ${response.status}: ${response.statusText}`;

        throw new VoltageApiError(errorMessage, response.status, 'HTTP_ERROR', data);
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText,
      };
    } catch (error) {
      if (error instanceof VoltageApiError) {
        throw error;
      }

      // Handle network errors, CORS issues, etc.
      throw new VoltageApiError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        undefined,
        'NETWORK_ERROR',
        error
      );
    }
  }

  async get<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'GET', headers });
  }

  async post<T>(
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'POST', body, headers });
  }

  async put<T>(
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PUT', body, headers });
  }

  async patch<T>(
    endpoint: string,
    body?: unknown,
    headers?: Record<string, string>
  ): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'PATCH', body, headers });
  }

  async delete<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE', headers });
  }
}
