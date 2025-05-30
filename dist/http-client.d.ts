import type { VoltageApiConfig, ApiResponse, ApiError } from './types';
export declare class VoltageApiError extends Error implements ApiError {
    status?: number;
    code?: string;
    details?: unknown;
    constructor(message: string, status?: number, code?: string, details?: unknown);
}
export interface RequestOptions {
    method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    body?: unknown;
    headers?: Record<string, string>;
    timeout?: number;
}
export declare class HttpClient {
    private baseUrl;
    private apiKey?;
    private bearerToken?;
    private timeout;
    constructor(config: VoltageApiConfig);
    private getAuthHeaders;
    private withTimeout;
    request<T>(endpoint: string, options?: RequestOptions): Promise<ApiResponse<T>>;
    get<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>>;
    post<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>>;
    put<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>>;
    patch<T>(endpoint: string, body?: unknown, headers?: Record<string, string>): Promise<ApiResponse<T>>;
    delete<T>(endpoint: string, headers?: Record<string, string>): Promise<ApiResponse<T>>;
}
//# sourceMappingURL=http-client.d.ts.map