import { HttpClient } from './http-client';
import type {
  VoltageApiConfig,
  Wallet,
  GetWalletsParams,
  GetWalletParams,
  CreateWalletParams,
  DeleteWalletParams,
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
   * Get low-level HTTP client for advanced usage
   * @returns HttpClient instance
   */
  getHttpClient(): HttpClient {
    return this.httpClient;
  }
}
