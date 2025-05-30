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

  describe('createPaymentRequest', () => {
    const organizationId = 'd27b642f-817c-4541-9215-3fc321e232af';
    const environmentId = '123e4567-e89b-12d3-a456-426614174000';
    const walletId = '7a68a525-9d11-4c1e-a3dd-1c2bf1378ba2';
    const paymentId = 'payment-123';

    const mockPaymentGenerating = {
      id: paymentId,
      wallet_id: walletId,
      organization_id: organizationId,
      environment_id: environmentId,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      currency: 'btc',
      status: 'generating',
      direction: 'receive',
      type: 'bolt11',
      data: {
        amount_msats: 150000,
        payment_request: null,
        memo: 'Test payment',
      },
    };

    const mockPaymentReady = {
      ...mockPaymentGenerating,
      status: 'receiving',
      data: {
        ...mockPaymentGenerating.data,
        payment_request: 'lnbc1500n1p...',
      },
    };

    beforeEach(() => {
      // Mock the POST request (returns 202)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 202,
        statusText: 'Accepted',
        text: async () => '',
      });
    });

    it('should create payment request and poll until ready', async () => {
      // Mock the GET requests (polling)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => JSON.stringify(mockPaymentGenerating),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => JSON.stringify(mockPaymentReady),
        });

      const payment = await client.createPaymentRequest({
        organization_id: organizationId,
        environment_id: environmentId,
        payment: {
          id: paymentId,
          wallet_id: walletId,
          currency: 'btc',
          amount_msats: 150000,
          payment_kind: 'bolt11',
          description: 'Test payment',
        },
      });

      // Should have made 3 calls: 1 POST + 2 GET
      expect(mockFetch).toHaveBeenCalledTimes(3);

      // Verify POST call
      expect(mockFetch).toHaveBeenNthCalledWith(
        1,
        `${mockConfig.baseUrl}/organizations/${organizationId}/environments/${environmentId}/payments`,
        expect.objectContaining({
          method: 'POST',
        })
      );

      // Verify GET calls (polling)
      expect(mockFetch).toHaveBeenNthCalledWith(
        2,
        `${mockConfig.baseUrl}/organizations/${organizationId}/environments/${environmentId}/payments/${paymentId}`,
        expect.objectContaining({
          method: 'GET',
        })
      );

      expect(payment).toEqual(mockPaymentReady);
    });

    it('should handle payment generation failure', async () => {
      const mockFailedPayment = {
        ...mockPaymentGenerating,
        status: 'failed',
        error: {
          type: 'receive_failed',
          detail: 'Insufficient balance',
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(mockFailedPayment),
      });

      await expect(
        client.createPaymentRequest({
          organization_id: organizationId,
          environment_id: environmentId,
          payment: {
            id: paymentId,
            wallet_id: walletId,
            currency: 'btc',
            payment_kind: 'bolt11',
          },
        })
      ).rejects.toThrow('Payment generation failed: Insufficient balance');
    });

    it('should timeout if polling takes too long', async () => {
      // Mock infinite generating responses
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(mockPaymentGenerating),
      });

      await expect(
        client.createPaymentRequest(
          {
            organization_id: organizationId,
            environment_id: environmentId,
            payment: {
              id: paymentId,
              wallet_id: walletId,
              currency: 'btc',
              payment_kind: 'bolt11',
            },
          },
          {
            maxAttempts: 2,
            intervalMs: 100,
            timeoutMs: 150,
          }
        )
      ).rejects.toThrow('Payment polling failed after 2 attempts');
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(
        client.createPaymentRequest({
          organization_id: '',
          environment_id: environmentId,
          payment: {
            id: paymentId,
            wallet_id: walletId,
            currency: 'btc',
            payment_kind: 'bolt11',
          },
        })
      ).rejects.toThrow('organization_id and environment_id are required');
    });
  });

  describe('getPayment', () => {
    const organizationId = 'd27b642f-817c-4541-9215-3fc321e232af';
    const environmentId = '123e4567-e89b-12d3-a456-426614174000';
    const paymentId = 'payment-123';

    it('should throw error when parameters are missing', async () => {
      await expect(
        client.getPayment({
          organization_id: '',
          environment_id: environmentId,
          payment_id: paymentId,
        })
      ).rejects.toThrow('organization_id, environment_id, and payment_id are required');

      await expect(
        client.getPayment({
          organization_id: organizationId,
          environment_id: '',
          payment_id: paymentId,
        })
      ).rejects.toThrow('organization_id, environment_id, and payment_id are required');

      await expect(
        client.getPayment({
          organization_id: organizationId,
          environment_id: environmentId,
          payment_id: '',
        })
      ).rejects.toThrow('organization_id, environment_id, and payment_id are required');
    });
  });
});
