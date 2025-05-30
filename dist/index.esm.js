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

// Default polling configuration
const DEFAULT_POLLING_CONFIG = {
    maxAttempts: 30,
    intervalMs: 1000,
    timeoutMs: 30000,
};

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
     * Create a new payment request (invoice) and wait for it to be ready
     * This method abstracts the polling logic to wait for the payment to be generated
     * @param params - Parameters containing organization_id, environment_id, and payment data
     * @param pollingConfig - Optional polling configuration
     * @returns Promise resolving to the ready payment with payment_request or address
     */
    async createPaymentRequest(params, pollingConfig) {
        const { organization_id, environment_id, payment } = params;
        if (!organization_id || !environment_id) {
            throw new Error('organization_id and environment_id are required');
        }
        if (!payment) {
            throw new Error('payment data is required');
        }
        // Auto-generate payment ID if not provided
        const paymentWithId = {
            ...payment,
            id: payment.id || crypto.randomUUID(),
        };
        const config = { ...DEFAULT_POLLING_CONFIG, ...pollingConfig };
        // Create the payment (returns 202)
        await this.httpClient.post(`/organizations/${organization_id}/environments/${environment_id}/payments`, paymentWithId);
        // Poll for the payment to be ready
        return this.pollForPayment({
            organization_id,
            environment_id,
            payment_id: paymentWithId.id,
        }, config);
    }
    /**
     * Get a specific payment
     * @param params - Parameters containing organization_id, environment_id, and payment_id
     * @returns Promise resolving to a payment
     */
    async getPayment(params) {
        const { organization_id, environment_id, payment_id } = params;
        if (!organization_id || !environment_id || !payment_id) {
            throw new Error('organization_id, environment_id, and payment_id are required');
        }
        const response = await this.httpClient.get(`/organizations/${organization_id}/environments/${environment_id}/payments/${payment_id}`);
        return response.data;
    }
    /**
     * Get all payments for an organization with optional filtering
     * @param params - Parameters containing organization_id, environment_id, and optional filters
     * @returns Promise resolving to paginated payments
     */
    async getPayments(params) {
        const { organization_id, environment_id, ...filters } = params;
        if (!organization_id || !environment_id) {
            throw new Error('organization_id and environment_id are required');
        }
        // Build query parameters
        const queryParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                    // Handle array parameters like statuses
                    value.forEach(item => queryParams.append(key, item.toString()));
                }
                else {
                    queryParams.append(key, value.toString());
                }
            }
        });
        const queryString = queryParams.toString();
        const url = `/organizations/${organization_id}/environments/${environment_id}/payments${queryString ? `?${queryString}` : ''}`;
        const response = await this.httpClient.get(url);
        return response.data;
    }
    /**
     * Poll for a payment to be ready (status not 'generating')
     * @param params - Parameters for getting the payment
     * @param config - Polling configuration
     * @returns Promise resolving to the ready payment
     */
    async pollForPayment(params, config) {
        const startTime = Date.now();
        let attempts = 0;
        while (attempts < config.maxAttempts) {
            // Check timeout
            if (Date.now() - startTime > config.timeoutMs) {
                throw new Error(`Payment polling timed out after ${config.timeoutMs}ms`);
            }
            try {
                const payment = await this.getPayment(params);
                // Ensure it's a receive payment
                if (payment.direction !== 'receive') {
                    throw new Error('Expected receive payment but got send payment');
                }
                const receivePayment = payment;
                // Check if payment is ready (not generating)
                if (receivePayment.status !== 'generating') {
                    // If payment failed, throw error
                    if (receivePayment.status === 'failed') {
                        let errorMessage = 'Payment generation failed';
                        if (receivePayment.error) {
                            if (receivePayment.error.type === 'receive_failed') {
                                errorMessage = `Payment generation failed: ${receivePayment.error.detail}`;
                            }
                            else if (receivePayment.error.type === 'expired') {
                                errorMessage = 'Payment generation failed: Payment expired';
                            }
                        }
                        throw new Error(errorMessage);
                    }
                    return receivePayment;
                }
                // Wait before next attempt
                await this.sleep(config.intervalMs);
                attempts++;
            }
            catch (error) {
                // If it's our timeout error or payment failed error, re-throw
                if (error instanceof Error && error.message.includes('timed out')) {
                    throw error;
                }
                if (error instanceof Error && error.message.includes('Payment generation failed')) {
                    throw error;
                }
                // For other errors (like 404), wait and retry
                await this.sleep(config.intervalMs);
                attempts++;
            }
        }
        throw new Error(`Payment polling failed after ${config.maxAttempts} attempts`);
    }
    /**
     * Sleep for the specified number of milliseconds
     * @param ms - Milliseconds to sleep
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * Send a payment (Lightning, On-chain, or BIP21)
     * This method creates a send payment and waits for it to complete or fail
     * @param params - Parameters containing organization_id, environment_id, and payment data
     * @param pollingConfig - Optional polling configuration
     * @returns Promise resolving to the completed payment
     */
    async sendPayment(params, pollingConfig) {
        const { organization_id, environment_id, payment } = params;
        if (!organization_id || !environment_id) {
            throw new Error('organization_id and environment_id are required');
        }
        if (!payment) {
            throw new Error('payment data is required');
        }
        // Auto-generate payment ID if not provided
        const paymentWithId = {
            ...payment,
            id: payment.id || crypto.randomUUID(),
        };
        const config = { ...DEFAULT_POLLING_CONFIG, ...pollingConfig };
        // Create the payment (returns 202)
        await this.httpClient.post(`/organizations/${organization_id}/environments/${environment_id}/payments`, paymentWithId);
        // Poll for the payment to complete
        return this.pollForSendPayment({
            organization_id,
            environment_id,
            payment_id: paymentWithId.id,
        }, config);
    }
    /**
     * Poll for a send payment to complete (status not 'sending')
     * @param params - Parameters for getting the payment
     * @param config - Polling configuration
     * @returns Promise resolving to the completed payment
     */
    async pollForSendPayment(params, config) {
        const startTime = Date.now();
        let attempts = 0;
        while (attempts < config.maxAttempts) {
            // Check timeout
            if (Date.now() - startTime > config.timeoutMs) {
                throw new Error(`Send payment polling timed out after ${config.timeoutMs}ms`);
            }
            try {
                const payment = await this.getPayment(params);
                // Ensure it's a send payment
                if (payment.direction !== 'send') {
                    throw new Error('Expected send payment but got receive payment');
                }
                const sendPayment = payment;
                // Check if payment is complete (not sending)
                if (sendPayment.status !== 'sending') {
                    // If payment failed, throw error
                    if (sendPayment.status === 'failed') {
                        let errorMessage = 'Send payment failed';
                        if (sendPayment.error) {
                            errorMessage = `Send payment failed: ${sendPayment.error.detail}`;
                        }
                        throw new Error(errorMessage);
                    }
                    return sendPayment;
                }
                // Wait before next attempt
                await this.sleep(config.intervalMs);
                attempts++;
            }
            catch (error) {
                // If it's our timeout error or payment failed error, re-throw
                if (error instanceof Error && error.message.includes('timed out')) {
                    throw error;
                }
                if (error instanceof Error && error.message.includes('Send payment failed')) {
                    throw error;
                }
                // For other errors (like 404), wait and retry
                await this.sleep(config.intervalMs);
                attempts++;
            }
        }
        throw new Error(`Send payment polling failed after ${config.maxAttempts} attempts`);
    }
    /**
     * Get a wallet's transaction history (ledger)
     * @param params - Parameters containing organization_id, wallet_id, and optional filters
     * @returns Promise resolving to paginated ledger events
     */
    async getWalletLedger(params) {
        const { organization_id, wallet_id, ...filters } = params;
        if (!organization_id || !wallet_id) {
            throw new Error('organization_id and wallet_id are required');
        }
        // Build query parameters
        const queryParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                queryParams.append(key, value.toString());
            }
        });
        const queryString = queryParams.toString();
        const url = `/organizations/${organization_id}/wallets/${wallet_id}/ledger${queryString ? `?${queryString}` : ''}`;
        const response = await this.httpClient.get(url);
        return response.data;
    }
    /**
     * Get the history of a payment
     * @param params - Parameters containing organization_id, environment_id, and payment_id
     * @returns Promise resolving to payment history events
     */
    async getPaymentHistory(params) {
        const { organization_id, environment_id, payment_id } = params;
        if (!organization_id || !environment_id || !payment_id) {
            throw new Error('organization_id, environment_id, and payment_id are required');
        }
        const response = await this.httpClient.get(`/organizations/${organization_id}/environments/${environment_id}/payments/${payment_id}/history`);
        return response.data;
    }
    /**
     * Get a line of credit summary
     * @param params - Parameters containing organization_id and line_id
     * @returns Promise resolving to line of credit summary
     */
    async getLineOfCredit(params) {
        const { organization_id, line_id } = params;
        if (!organization_id || !line_id) {
            throw new Error('organization_id and line_id are required');
        }
        const response = await this.httpClient.get(`/organizations/${organization_id}/lines_of_credit/${line_id}/summary`);
        return response.data;
    }
    /**
     * Get all lines of credit summaries for an organization
     * @param params - Parameters containing organization_id
     * @returns Promise resolving to an array of line of credit summaries
     */
    async getLinesOfCredit(params) {
        const { organization_id } = params;
        if (!organization_id) {
            throw new Error('organization_id is required');
        }
        const response = await this.httpClient.get(`/organizations/${organization_id}/lines_of_credit/summaries`);
        return response.data;
    }
    /**
     * Get all webhooks for an organization with optional filtering
     * @param params - Parameters containing organization_id and optional filters
     * @returns Promise resolving to an array of webhooks
     */
    async getWebhooks(params) {
        const { organization_id, ...filters } = params;
        if (!organization_id) {
            throw new Error('organization_id is required');
        }
        // Build query parameters
        const queryParams = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null) {
                if (Array.isArray(value)) {
                    // Handle array parameters like environment_ids and statuses
                    value.forEach(item => queryParams.append(key, item.toString()));
                }
                else {
                    queryParams.append(key, value.toString());
                }
            }
        });
        const queryString = queryParams.toString();
        const url = `/organizations/${organization_id}/webhooks${queryString ? `?${queryString}` : ''}`;
        const response = await this.httpClient.get(url);
        return response.data;
    }
    /**
     * Get a specific webhook
     * @param params - Parameters containing organization_id, environment_id, and webhook_id
     * @returns Promise resolving to a webhook
     */
    async getWebhook(params) {
        const { organization_id, environment_id, webhook_id } = params;
        if (!organization_id || !environment_id || !webhook_id) {
            throw new Error('organization_id, environment_id, and webhook_id are required');
        }
        const response = await this.httpClient.get(`/organizations/${organization_id}/environments/${environment_id}/webhooks/${webhook_id}`);
        return response.data;
    }
    /**
     * Create a new webhook
     * @param params - Parameters containing organization_id, environment_id, and webhook data
     * @returns Promise resolving to webhook secret information
     */
    async createWebhook(params) {
        const { organization_id, environment_id, webhook } = params;
        if (!organization_id || !environment_id) {
            throw new Error('organization_id and environment_id are required');
        }
        if (!webhook) {
            throw new Error('webhook data is required');
        }
        // Auto-generate webhook ID if not provided
        const webhookWithId = {
            ...webhook,
            id: webhook.id || crypto.randomUUID(),
        };
        const response = await this.httpClient.post(`/organizations/${organization_id}/environments/${environment_id}/webhooks`, webhookWithId);
        return response.data;
    }
    /**
     * Update a webhook
     * @param params - Parameters containing organization_id, environment_id, webhook_id, and webhook data
     * @returns Promise resolving when webhook update is complete
     */
    async updateWebhook(params) {
        const { organization_id, environment_id, webhook_id, webhook } = params;
        if (!organization_id || !environment_id || !webhook_id) {
            throw new Error('organization_id, environment_id, and webhook_id are required');
        }
        if (!webhook) {
            throw new Error('webhook data is required');
        }
        await this.httpClient.patch(`/organizations/${organization_id}/environments/${environment_id}/webhooks/${webhook_id}`, webhook);
    }
    /**
     * Delete a webhook
     * @param params - Parameters containing organization_id, environment_id, and webhook_id
     * @returns Promise resolving when webhook deletion is complete
     */
    async deleteWebhook(params) {
        const { organization_id, environment_id, webhook_id } = params;
        if (!organization_id || !environment_id || !webhook_id) {
            throw new Error('organization_id, environment_id, and webhook_id are required');
        }
        await this.httpClient.delete(`/organizations/${organization_id}/environments/${environment_id}/webhooks/${webhook_id}`);
    }
    /**
     * Start a webhook
     * @param params - Parameters containing organization_id, environment_id, and webhook_id
     * @returns Promise resolving when webhook start request is complete
     */
    async startWebhook(params) {
        const { organization_id, environment_id, webhook_id } = params;
        if (!organization_id || !environment_id || !webhook_id) {
            throw new Error('organization_id, environment_id, and webhook_id are required');
        }
        await this.httpClient.post(`/organizations/${organization_id}/environments/${environment_id}/webhooks/${webhook_id}/start`);
    }
    /**
     * Stop a webhook
     * @param params - Parameters containing organization_id, environment_id, and webhook_id
     * @returns Promise resolving when webhook stop request is complete
     */
    async stopWebhook(params) {
        const { organization_id, environment_id, webhook_id } = params;
        if (!organization_id || !environment_id || !webhook_id) {
            throw new Error('organization_id, environment_id, and webhook_id are required');
        }
        await this.httpClient.post(`/organizations/${organization_id}/environments/${environment_id}/webhooks/${webhook_id}/stop`);
    }
    /**
     * Generate a new key for a webhook
     * @param params - Parameters containing organization_id, environment_id, and webhook_id
     * @returns Promise resolving to new webhook secret information
     */
    async generateWebhookKey(params) {
        const { organization_id, environment_id, webhook_id } = params;
        if (!organization_id || !environment_id || !webhook_id) {
            throw new Error('organization_id, environment_id, and webhook_id are required');
        }
        const response = await this.httpClient.post(`/organizations/${organization_id}/environments/${environment_id}/webhooks/${webhook_id}/keys`);
        return response.data;
    }
    /**
     * Get low-level HTTP client for advanced usage
     * @returns HttpClient instance
     */
    getHttpClient() {
        return this.httpClient;
    }
}

export { HttpClient, VoltageApiError, VoltageClient };
//# sourceMappingURL=index.esm.js.map
