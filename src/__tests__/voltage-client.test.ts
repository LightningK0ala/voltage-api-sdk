import { VoltageClient, VoltageApiError } from '../index';
import type { Wallet, VoltageApiConfig } from '../types';

// Mock the global fetch function
const mockFetch = jest.fn();
global.fetch = mockFetch as any;

describe('VoltageClient', () => {
  const mockConfig: VoltageApiConfig = {
    apiKey: 'vltg_test_key',
    baseUrl: 'https://api.test.voltage.com/api/v1',
  };

  let client: VoltageClient;

  beforeEach(() => {
    client = new VoltageClient(mockConfig);
    mockFetch.mockClear();
  });

  describe('constructor', () => {
    it('should throw error when no auth is provided', () => {
      expect(() => new VoltageClient({})).toThrow('Either apiKey or bearerToken must be provided');
    });

    it('should accept apiKey auth', () => {
      expect(() => new VoltageClient({ apiKey: 'test' })).not.toThrow();
    });

    it('should accept bearerToken auth', () => {
      expect(() => new VoltageClient({ bearerToken: 'test' })).not.toThrow();
    });
  });

  describe('getWallets', () => {
    const organizationId = 'd27b642f-817c-4541-9215-3fc321e232af';
    const mockWallets: Wallet[] = [
      {
        id: '7a68a525-9d11-4c1e-a3dd-1c2bf1378ba2',
        active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
        name: 'Test Wallet',
        organization_id: organizationId,
        environment_id: '123e4567-e89b-12d3-a456-426614174000',
        network: 'mutinynet',
        balances: [],
        holds: [],
      },
    ];

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(mockWallets),
      });
    });

    it('should get wallets successfully', async () => {
      const wallets = await client.getWallets({ organization_id: organizationId });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConfig.baseUrl}/organizations/${organizationId}/wallets`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Api-Key': mockConfig.apiKey,
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(wallets).toEqual(mockWallets);
    });

    it('should throw error when organization_id is missing', async () => {
      await expect(client.getWallets({ organization_id: '' })).rejects.toThrow(
        'organization_id is required'
      );
    });

    it('should handle API errors', async () => {
      const errorResponse = {
        message: 'Organization not found',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => JSON.stringify(errorResponse),
      });

      await expect(client.getWallets({ organization_id: organizationId })).rejects.toThrow(
        VoltageApiError
      );
    });

    it('should handle network errors', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.getWallets({ organization_id: organizationId })).rejects.toThrow(
        VoltageApiError
      );
    });
  });

  describe('getWallet', () => {
    const organizationId = 'd27b642f-817c-4541-9215-3fc321e232af';
    const walletId = '7a68a525-9d11-4c1e-a3dd-1c2bf1378ba2';

    it('should throw error when parameters are missing', async () => {
      await expect(client.getWallet({ organization_id: '', wallet_id: walletId })).rejects.toThrow(
        'organization_id and wallet_id are required'
      );

      await expect(
        client.getWallet({ organization_id: organizationId, wallet_id: '' })
      ).rejects.toThrow('organization_id and wallet_id are required');
    });
  });
});
