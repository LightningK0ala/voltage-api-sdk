import { HttpClient } from './http-client';
import { DEFAULT_POLLING_CONFIG } from './types';
import type {
  VoltageApiConfig,
  Wallet,
  GetWalletsParams,
  GetWalletParams,
  CreateWalletParams,
  DeleteWalletParams,
  CreatePaymentRequestParams,
  SendPaymentParams,
  GetPaymentParams,
  GetPaymentsParams,
  GetWalletLedgerParams,
  GetPaymentHistoryParams,
  GetLineOfCreditParams,
  GetLinesOfCreditParams,
  GetWebhooksParams,
  GetWebhookParams,
  CreateWebhookParams,
  UpdateWebhookParams,
  DeleteWebhookParams,
  StartWebhookParams,
  StopWebhookParams,
  GenerateWebhookKeyParams,
  ReceivePayment,
  SendPayment,
  Payment,
  Payments,
  Ledger,
  PaymentHistory,
  LineOfCredit,
  Webhook,
  WebhookSecret,
  PollingConfig,
} from './types';

export class VoltageClient {
  private httpClient: HttpClient;

  constructor(config: VoltageApiConfig) {
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
  async getWallets(params: GetWalletsParams): Promise<Wallet[]> {
    const { organization_id } = params;

    if (!organization_id) {
      throw new Error('organization_id is required');
    }

    const response = await this.httpClient.get<Wallet[]>(
      `/organizations/${organization_id}/wallets`
    );

    return response.data;
  }

  /**
   * Get a specific wallet
   * @param params - Parameters containing organization_id and wallet_id
   * @returns Promise resolving to a wallet
   */
  async getWallet(params: GetWalletParams): Promise<Wallet> {
    const { organization_id, wallet_id } = params;

    if (!organization_id || !wallet_id) {
      throw new Error('organization_id and wallet_id are required');
    }

    const response = await this.httpClient.get<Wallet>(
      `/organizations/${organization_id}/wallets/${wallet_id}`
    );

    return response.data;
  }

  /**
   * Create a new wallet
   * @param params - Parameters containing organization_id and wallet data
   * @returns Promise resolving when wallet creation is initiated
   */
  async createWallet(params: CreateWalletParams): Promise<void> {
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
  async deleteWallet(params: DeleteWalletParams): Promise<void> {
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
  async createPaymentRequest(
    params: CreatePaymentRequestParams,
    pollingConfig?: PollingConfig
  ): Promise<ReceivePayment> {
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
    await this.httpClient.post(
      `/organizations/${organization_id}/environments/${environment_id}/payments`,
      paymentWithId
    );

    // Poll for the payment to be ready
    return this.pollForPayment(
      {
        organization_id,
        environment_id,
        payment_id: paymentWithId.id,
      },
      config
    );
  }

  /**
   * Get a specific payment
   * @param params - Parameters containing organization_id, environment_id, and payment_id
   * @returns Promise resolving to a payment
   */
  async getPayment(params: GetPaymentParams): Promise<Payment> {
    const { organization_id, environment_id, payment_id } = params;

    if (!organization_id || !environment_id || !payment_id) {
      throw new Error('organization_id, environment_id, and payment_id are required');
    }

    const response = await this.httpClient.get<Payment>(
      `/organizations/${organization_id}/environments/${environment_id}/payments/${payment_id}`
    );

    return response.data;
  }

  /**
   * Get all payments for an organization with optional filtering
   * @param params - Parameters containing organization_id, environment_id, and optional filters
   * @returns Promise resolving to paginated payments
   */
  async getPayments(params: GetPaymentsParams): Promise<Payments> {
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
        } else {
          queryParams.append(key, value.toString());
        }
      }
    });

    const queryString = queryParams.toString();
    const url = `/organizations/${organization_id}/environments/${environment_id}/payments${
      queryString ? `?${queryString}` : ''
    }`;

    const response = await this.httpClient.get<Payments>(url);
    return response.data;
  }

  /**
   * Poll for a payment to be ready (status not 'generating')
   * @param params - Parameters for getting the payment
   * @param config - Polling configuration
   * @returns Promise resolving to the ready payment
   */
  private async pollForPayment(
    params: GetPaymentParams,
    config: Required<PollingConfig>
  ): Promise<ReceivePayment> {
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

        const receivePayment = payment as ReceivePayment;

        // Check if payment is ready (not generating)
        if (receivePayment.status !== 'generating') {
          // If payment failed, throw error
          if (receivePayment.status === 'failed') {
            let errorMessage = 'Payment generation failed';
            if (receivePayment.error) {
              if (receivePayment.error.type === 'receive_failed') {
                errorMessage = `Payment generation failed: ${receivePayment.error.detail}`;
              } else if (receivePayment.error.type === 'expired') {
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
      } catch (error) {
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
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Send a payment (Lightning, On-chain, or BIP21)
   * This method creates a send payment and waits for it to complete or fail
   * @param params - Parameters containing organization_id, environment_id, and payment data
   * @param pollingConfig - Optional polling configuration
   * @returns Promise resolving to the completed payment
   */
  async sendPayment(
    params: SendPaymentParams,
    pollingConfig?: PollingConfig
  ): Promise<SendPayment> {
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
    await this.httpClient.post(
      `/organizations/${organization_id}/environments/${environment_id}/payments`,
      paymentWithId
    );

    // Poll for the payment to complete
    return this.pollForSendPayment(
      {
        organization_id,
        environment_id,
        payment_id: paymentWithId.id,
      },
      config
    );
  }

  /**
   * Poll for a send payment to complete (status not 'sending')
   * @param params - Parameters for getting the payment
   * @param config - Polling configuration
   * @returns Promise resolving to the completed payment
   */
  private async pollForSendPayment(
    params: GetPaymentParams,
    config: Required<PollingConfig>
  ): Promise<SendPayment> {
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

        const sendPayment = payment as SendPayment;

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
      } catch (error) {
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
  async getWalletLedger(params: GetWalletLedgerParams): Promise<Ledger> {
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
    const url = `/organizations/${organization_id}/wallets/${wallet_id}/ledger${
      queryString ? `?${queryString}` : ''
    }`;

    const response = await this.httpClient.get<Ledger>(url);
    return response.data;
  }

  /**
   * Get the history of a payment
   * @param params - Parameters containing organization_id, environment_id, and payment_id
   * @returns Promise resolving to payment history events
   */
  async getPaymentHistory(params: GetPaymentHistoryParams): Promise<PaymentHistory> {
    const { organization_id, environment_id, payment_id } = params;

    if (!organization_id || !environment_id || !payment_id) {
      throw new Error('organization_id, environment_id, and payment_id are required');
    }

    const response = await this.httpClient.get<PaymentHistory>(
      `/organizations/${organization_id}/environments/${environment_id}/payments/${payment_id}/history`
    );

    return response.data;
  }

  /**
   * Get a line of credit summary
   * @param params - Parameters containing organization_id and line_id
   * @returns Promise resolving to line of credit summary
   */
  async getLineOfCredit(params: GetLineOfCreditParams): Promise<LineOfCredit> {
    const { organization_id, line_id } = params;

    if (!organization_id || !line_id) {
      throw new Error('organization_id and line_id are required');
    }

    const response = await this.httpClient.get<LineOfCredit>(
      `/organizations/${organization_id}/lines_of_credit/${line_id}/summary`
    );

    return response.data;
  }

  /**
   * Get all lines of credit summaries for an organization
   * @param params - Parameters containing organization_id
   * @returns Promise resolving to an array of line of credit summaries
   */
  async getLinesOfCredit(params: GetLinesOfCreditParams): Promise<LineOfCredit[]> {
    const { organization_id } = params;

    if (!organization_id) {
      throw new Error('organization_id is required');
    }

    const response = await this.httpClient.get<LineOfCredit[]>(
      `/organizations/${organization_id}/lines_of_credit/summaries`
    );

    return response.data;
  }

  /**
   * Get all webhooks for an organization with optional filtering
   * @param params - Parameters containing organization_id and optional filters
   * @returns Promise resolving to an array of webhooks
   */
  async getWebhooks(params: GetWebhooksParams): Promise<Webhook[]> {
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
        } else {
          queryParams.append(key, value.toString());
        }
      }
    });

    const queryString = queryParams.toString();
    const url = `/organizations/${organization_id}/webhooks${queryString ? `?${queryString}` : ''}`;

    const response = await this.httpClient.get<Webhook[]>(url);
    return response.data;
  }

  /**
   * Get a specific webhook
   * @param params - Parameters containing organization_id, environment_id, and webhook_id
   * @returns Promise resolving to a webhook
   */
  async getWebhook(params: GetWebhookParams): Promise<Webhook> {
    const { organization_id, environment_id, webhook_id } = params;

    if (!organization_id || !environment_id || !webhook_id) {
      throw new Error('organization_id, environment_id, and webhook_id are required');
    }

    const response = await this.httpClient.get<Webhook>(
      `/organizations/${organization_id}/environments/${environment_id}/webhooks/${webhook_id}`
    );

    return response.data;
  }

  /**
   * Create a new webhook
   * @param params - Parameters containing organization_id, environment_id, and webhook data
   * @returns Promise resolving to webhook secret information
   */
  async createWebhook(params: CreateWebhookParams): Promise<WebhookSecret> {
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

    const response = await this.httpClient.post<WebhookSecret>(
      `/organizations/${organization_id}/environments/${environment_id}/webhooks`,
      webhookWithId
    );

    return response.data;
  }

  /**
   * Update a webhook
   * @param params - Parameters containing organization_id, environment_id, webhook_id, and webhook data
   * @returns Promise resolving when webhook update is complete
   */
  async updateWebhook(params: UpdateWebhookParams): Promise<void> {
    const { organization_id, environment_id, webhook_id, webhook } = params;

    if (!organization_id || !environment_id || !webhook_id) {
      throw new Error('organization_id, environment_id, and webhook_id are required');
    }

    if (!webhook) {
      throw new Error('webhook data is required');
    }

    await this.httpClient.patch(
      `/organizations/${organization_id}/environments/${environment_id}/webhooks/${webhook_id}`,
      webhook
    );
  }

  /**
   * Delete a webhook
   * @param params - Parameters containing organization_id, environment_id, and webhook_id
   * @returns Promise resolving when webhook deletion is complete
   */
  async deleteWebhook(params: DeleteWebhookParams): Promise<void> {
    const { organization_id, environment_id, webhook_id } = params;

    if (!organization_id || !environment_id || !webhook_id) {
      throw new Error('organization_id, environment_id, and webhook_id are required');
    }

    await this.httpClient.delete(
      `/organizations/${organization_id}/environments/${environment_id}/webhooks/${webhook_id}`
    );
  }

  /**
   * Start a webhook
   * @param params - Parameters containing organization_id, environment_id, and webhook_id
   * @returns Promise resolving when webhook start request is complete
   */
  async startWebhook(params: StartWebhookParams): Promise<void> {
    const { organization_id, environment_id, webhook_id } = params;

    if (!organization_id || !environment_id || !webhook_id) {
      throw new Error('organization_id, environment_id, and webhook_id are required');
    }

    await this.httpClient.post(
      `/organizations/${organization_id}/environments/${environment_id}/webhooks/${webhook_id}/start`
    );
  }

  /**
   * Stop a webhook
   * @param params - Parameters containing organization_id, environment_id, and webhook_id
   * @returns Promise resolving when webhook stop request is complete
   */
  async stopWebhook(params: StopWebhookParams): Promise<void> {
    const { organization_id, environment_id, webhook_id } = params;

    if (!organization_id || !environment_id || !webhook_id) {
      throw new Error('organization_id, environment_id, and webhook_id are required');
    }

    await this.httpClient.post(
      `/organizations/${organization_id}/environments/${environment_id}/webhooks/${webhook_id}/stop`
    );
  }

  /**
   * Generate a new key for a webhook
   * @param params - Parameters containing organization_id, environment_id, and webhook_id
   * @returns Promise resolving to new webhook secret information
   */
  async generateWebhookKey(params: GenerateWebhookKeyParams): Promise<WebhookSecret> {
    const { organization_id, environment_id, webhook_id } = params;

    if (!organization_id || !environment_id || !webhook_id) {
      throw new Error('organization_id, environment_id, and webhook_id are required');
    }

    const response = await this.httpClient.post<WebhookSecret>(
      `/organizations/${organization_id}/environments/${environment_id}/webhooks/${webhook_id}/keys`
    );

    return response.data;
  }

  /**
   * Get low-level HTTP client for advanced usage
   * @returns HttpClient instance
   */
  getHttpClient(): HttpClient {
    return this.httpClient;
  }
}
