'use strict';

class VoltageApiError extends Error {
    constructor(message, status, code, details) {
        super(message);
        this.name = 'VoltageApiError';
        this.status = status;
        this.code = code;
        this.details = details;
    }
}
class HttpClient {
    constructor(config) {
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
            throw new Error('Fetch is not available. Please use Node.js 18+ or provide a fetch polyfill.');
        }
    }
    getAuthHeaders() {
        const headers = {};
        if (this.bearerToken) {
            headers['Authorization'] = `Bearer ${this.bearerToken}`;
        }
        else if (this.apiKey) {
            headers['X-Api-Key'] = this.apiKey;
        }
        return headers;
    }
    async withTimeout(promise, timeoutMs) {
        let timeoutId;
        const timeoutPromise = new Promise((_, reject) => {
            timeoutId = setTimeout(() => reject(new VoltageApiError('Request timeout', 408)), timeoutMs);
        });
        try {
            const result = await Promise.race([promise, timeoutPromise]);
            if (timeoutId)
                clearTimeout(timeoutId);
            return result;
        }
        catch (error) {
            if (timeoutId)
                clearTimeout(timeoutId);
            throw error;
        }
    }
    async request(endpoint, options = {}) {
        const { method = 'GET', body, headers = {}, timeout = this.timeout } = options;
        const url = `${this.baseUrl}${endpoint}`;
        const authHeaders = this.getAuthHeaders();
        const requestHeaders = {
            'Content-Type': 'application/json',
            ...authHeaders,
            ...headers,
        };
        const config = {
            method,
            headers: requestHeaders,
        };
        if (body && method !== 'GET') {
            config.body = JSON.stringify(body);
        }
        try {
            const response = await this.withTimeout(fetch(url, config), timeout);
            const responseText = await response.text();
            let data;
            try {
                data = responseText ? JSON.parse(responseText) : null;
            }
            catch (parseError) {
                throw new VoltageApiError('Failed to parse response as JSON', response.status, 'PARSE_ERROR', parseError);
            }
            if (!response.ok) {
                const errorMessage = typeof data === 'object' && data !== null && 'message' in data
                    ? data.message
                    : `HTTP ${response.status}: ${response.statusText}`;
                throw new VoltageApiError(errorMessage, response.status, 'HTTP_ERROR', data);
            }
            return {
                data,
                status: response.status,
                statusText: response.statusText,
            };
        }
        catch (error) {
            if (error instanceof VoltageApiError) {
                throw error;
            }
            // Handle network errors, CORS issues, etc.
            throw new VoltageApiError(error instanceof Error ? error.message : 'Unknown error occurred', undefined, 'NETWORK_ERROR', error);
        }
    }
    async get(endpoint, headers) {
        return this.request(endpoint, { method: 'GET', headers });
    }
    async post(endpoint, body, headers) {
        return this.request(endpoint, { method: 'POST', body, headers });
    }
    async put(endpoint, body, headers) {
        return this.request(endpoint, { method: 'PUT', body, headers });
    }
    async patch(endpoint, body, headers) {
        return this.request(endpoint, { method: 'PATCH', body, headers });
    }
    async delete(endpoint, headers) {
        return this.request(endpoint, { method: 'DELETE', headers });
    }
}

class VoltageClient {
    constructor(config) {
        if (!config.apiKey && !config.bearerToken) {
            throw new Error('Either apiKey or bearerToken must be provided');
        }
        this.httpClient = new HttpClient(config);
    }
    /**
     * Get all wallets in an organization
     * @param params - Parameters containing organization_id
     * @returns Promise resolving to an array of wallets
     */
    async getWallets(params) {
        const { organization_id } = params;
        if (!organization_id) {
            throw new Error('organization_id is required');
        }
        const response = await this.httpClient.get(`/organizations/${organization_id}/wallets`);
        return response.data;
    }
    /**
     * Get a specific wallet
     * @param params - Parameters containing organization_id and wallet_id
     * @returns Promise resolving to a wallet
     */
    async getWallet(params) {
        const { organization_id, wallet_id } = params;
        if (!organization_id || !wallet_id) {
            throw new Error('organization_id and wallet_id are required');
        }
        const response = await this.httpClient.get(`/organizations/${organization_id}/wallets/${wallet_id}`);
        return response.data;
    }
    /**
     * Create a new wallet
     * @param params - Parameters containing organization_id and wallet data
     * @returns Promise resolving when wallet creation is initiated
     */
    async createWallet(params) {
        const { organization_id, wallet } = params;
        if (!organization_id) {
            throw new Error('organization_id is required');
        }
        if (!wallet) {
            throw new Error('wallet data is required');
        }
        await this.httpClient.post(`/organizations/${organization_id}/wallets`, wallet);
    }
    /**
     * Delete a wallet
     * @param params - Parameters containing organization_id and wallet_id
     * @returns Promise resolving when wallet deletion is complete
     */
    async deleteWallet(params) {
        const { organization_id, wallet_id } = params;
        if (!organization_id || !wallet_id) {
            throw new Error('organization_id and wallet_id are required');
        }
        await this.httpClient.delete(`/organizations/${organization_id}/wallets/${wallet_id}`);
    }
    /**
     * Get low-level HTTP client for advanced usage
     * @returns HttpClient instance
     */
    getHttpClient() {
        return this.httpClient;
    }
}

exports.HttpClient = HttpClient;
exports.VoltageApiError = VoltageApiError;
exports.VoltageClient = VoltageClient;
//# sourceMappingURL=index.js.map
