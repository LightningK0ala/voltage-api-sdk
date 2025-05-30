import { HttpClient } from './http-client';
import type { VoltageApiConfig, Wallet, GetWalletsParams, GetWalletParams, CreateWalletParams, DeleteWalletParams, CreatePaymentRequestParams, GetPaymentParams, ReceivePayment, PollingConfig } from './types';
export declare class VoltageClient {
    private httpClient;
    constructor(config: VoltageApiConfig);
    /**
     * Get all wallets in an organization
     * @param params - Parameters containing organization_id
     * @returns Promise resolving to an array of wallets
     */
    getWallets(params: GetWalletsParams): Promise<Wallet[]>;
    /**
     * Get a specific wallet
     * @param params - Parameters containing organization_id and wallet_id
     * @returns Promise resolving to a wallet
     */
    getWallet(params: GetWalletParams): Promise<Wallet>;
    /**
     * Create a new wallet
     * @param params - Parameters containing organization_id and wallet data
     * @returns Promise resolving when wallet creation is initiated
     */
    createWallet(params: CreateWalletParams): Promise<void>;
    /**
     * Delete a wallet
     * @param params - Parameters containing organization_id and wallet_id
     * @returns Promise resolving when wallet deletion is complete
     */
    deleteWallet(params: DeleteWalletParams): Promise<void>;
    /**
     * Create a new payment request (invoice) and wait for it to be ready
     * This method abstracts the polling logic to wait for the payment to be generated
     * @param params - Parameters containing organization_id, environment_id, and payment data
     * @param pollingConfig - Optional polling configuration
     * @returns Promise resolving to the ready payment with payment_request or address
     */
    createPaymentRequest(params: CreatePaymentRequestParams, pollingConfig?: PollingConfig): Promise<ReceivePayment>;
    /**
     * Get a specific payment
     * @param params - Parameters containing organization_id, environment_id, and payment_id
     * @returns Promise resolving to a payment
     */
    getPayment(params: GetPaymentParams): Promise<ReceivePayment>;
    /**
     * Poll for a payment to be ready (status not 'generating')
     * @param params - Parameters for getting the payment
     * @param config - Polling configuration
     * @returns Promise resolving to the ready payment
     */
    private pollForPayment;
    /**
     * Sleep for the specified number of milliseconds
     * @param ms - Milliseconds to sleep
     */
    private sleep;
    /**
     * Get low-level HTTP client for advanced usage
     * @returns HttpClient instance
     */
    getHttpClient(): HttpClient;
}
//# sourceMappingURL=voltage-client.d.ts.map