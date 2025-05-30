import { HttpClient } from './http-client';
import type { VoltageApiConfig, Wallet, GetWalletsParams, GetWalletParams, CreateWalletParams, DeleteWalletParams } from './types';
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
     * Get low-level HTTP client for advanced usage
     * @returns HttpClient instance
     */
    getHttpClient(): HttpClient;
}
//# sourceMappingURL=voltage-client.d.ts.map