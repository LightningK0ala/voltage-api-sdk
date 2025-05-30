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
  GetPaymentParams,
  ReceivePayment,
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

    const config = { ...DEFAULT_POLLING_CONFIG, ...pollingConfig };

    // Create the payment (returns 202)
    await this.httpClient.post(
      `/organizations/${organization_id}/environments/${environment_id}/payments`,
      payment
    );

    // Poll for the payment to be ready
    return this.pollForPayment(
      {
        organization_id,
        environment_id,
        payment_id: payment.id,
      },
      config
    );
  }

  /**
   * Get a specific payment
   * @param params - Parameters containing organization_id, environment_id, and payment_id
   * @returns Promise resolving to a payment
   */
  async getPayment(params: GetPaymentParams): Promise<ReceivePayment> {
    const { organization_id, environment_id, payment_id } = params;

    if (!organization_id || !environment_id || !payment_id) {
      throw new Error('organization_id, environment_id, and payment_id are required');
    }

    const response = await this.httpClient.get<ReceivePayment>(
      `/organizations/${organization_id}/environments/${environment_id}/payments/${payment_id}`
    );

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

        // Check if payment is ready (not generating)
        if (payment.status !== 'generating') {
          // If payment failed, throw error
          if (payment.status === 'failed') {
            let errorMessage = 'Payment generation failed';
            if (payment.error) {
              if (payment.error.type === 'receive_failed') {
                errorMessage = `Payment generation failed: ${payment.error.detail}`;
              } else if (payment.error.type === 'expired') {
                errorMessage = 'Payment generation failed: Payment expired';
              }
            }
            throw new Error(errorMessage);
          }

          return payment;
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
   * Get low-level HTTP client for advanced usage
   * @returns HttpClient instance
   */
  getHttpClient(): HttpClient {
    return this.httpClient;
  }
}
