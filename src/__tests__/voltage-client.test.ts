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

  describe('getWalletLedger', () => {
    const organizationId = 'd27b642f-817c-4541-9215-3fc321e232af';
    const walletId = '7a68a525-9d11-4c1e-a3dd-1c2bf1378ba2';

    const mockLedger = {
      items: [
        {
          type: 'credited',
          credit_id: 'credit-123',
          payment_id: 'payment-123',
          amount_msats: 150000,
          currency: 'btc',
          effective_time: '2024-01-01T00:00:00Z',
        },
        {
          type: 'held',
          hold_id: 'hold-456',
          payment_id: 'payment-456',
          amount_msats: 100000,
          currency: 'btc',
          effective_time: '2024-01-02T00:00:00Z',
        },
      ],
      offset: 0,
      limit: 100,
      total: 2,
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(mockLedger),
      });
    });

    it('should get wallet ledger successfully without filters', async () => {
      // Reset mock to ensure clean state
      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(mockLedger),
      });

      const ledger = await client.getWalletLedger({
        organization_id: organizationId,
        wallet_id: walletId,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConfig.baseUrl}/organizations/${organizationId}/wallets/${walletId}/ledger`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Api-Key': mockConfig.apiKey,
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(ledger).toEqual(mockLedger);
    });

    it('should get wallet ledger with pagination filters', async () => {
      await client.getWalletLedger({
        organization_id: organizationId,
        wallet_id: walletId,
        offset: 10,
        limit: 50,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConfig.baseUrl}/organizations/${organizationId}/wallets/${walletId}/ledger?offset=10&limit=50`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should get wallet ledger with all filters', async () => {
      await client.getWalletLedger({
        organization_id: organizationId,
        wallet_id: walletId,
        offset: 0,
        limit: 25,
        payment_id: 'payment-123',
        start_date: '2024-01-01T00:00:00Z',
        end_date: '2024-01-31T23:59:59Z',
        sort_key: 'effective_time',
        sort_order: 'DESC',
      });

      const expectedUrl = `${mockConfig.baseUrl}/organizations/${organizationId}/wallets/${walletId}/ledger?offset=0&limit=25&payment_id=payment-123&start_date=2024-01-01T00%3A00%3A00Z&end_date=2024-01-31T23%3A59%3A59Z&sort_key=effective_time&sort_order=DESC`;

      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(
        client.getWalletLedger({
          organization_id: '',
          wallet_id: walletId,
        })
      ).rejects.toThrow('organization_id and wallet_id are required');

      await expect(
        client.getWalletLedger({
          organization_id: organizationId,
          wallet_id: '',
        })
      ).rejects.toThrow('organization_id and wallet_id are required');
    });

    it('should handle empty ledger results', async () => {
      const emptyLedger = {
        items: [],
        offset: 0,
        limit: 100,
        total: 0,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(emptyLedger),
      });

      const ledger = await client.getWalletLedger({
        organization_id: organizationId,
        wallet_id: walletId,
      });

      expect(ledger).toEqual(emptyLedger);
    });

    it('should handle API errors', async () => {
      const errorResponse = {
        message: 'Wallet not found',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => JSON.stringify(errorResponse),
      });

      await expect(
        client.getWalletLedger({
          organization_id: organizationId,
          wallet_id: walletId,
        })
      ).rejects.toThrow();
    });
  });

  describe('getPayments', () => {
    const organizationId = 'd27b642f-817c-4541-9215-3fc321e232af';
    const environmentId = '123e4567-e89b-12d3-a456-426614174000';
    const walletId = '7a68a525-9d11-4c1e-a3dd-1c2bf1378ba2';

    const mockPayments = {
      items: [
        {
          id: 'payment-1',
          wallet_id: walletId,
          organization_id: organizationId,
          environment_id: environmentId,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          currency: 'btc',
          status: 'completed',
          direction: 'send',
          type: 'bolt11',
          data: {
            amount_msats: 150000,
            max_fee_msats: 1000,
            payment_request: 'lnbc1500n1p...',
            fee_msats: 500,
          },
        },
        {
          id: 'payment-2',
          wallet_id: walletId,
          organization_id: organizationId,
          environment_id: environmentId,
          created_at: '2024-01-02T00:00:00Z',
          updated_at: '2024-01-02T00:00:00Z',
          currency: 'btc',
          status: 'receiving',
          direction: 'receive',
          type: 'bolt11',
          data: {
            amount_msats: 200000,
            payment_request: 'lnbc2000n1p...',
          },
        },
      ],
      offset: 0,
      limit: 100,
      total: 2,
    };

    beforeEach(() => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(mockPayments),
      });
    });

    it('should get payments successfully without filters', async () => {
      // Reset mock to ensure clean state
      mockFetch.mockReset();
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(mockPayments),
      });

      const payments = await client.getPayments({
        organization_id: organizationId,
        environment_id: environmentId,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConfig.baseUrl}/organizations/${organizationId}/environments/${environmentId}/payments`,
        expect.objectContaining({
          method: 'GET',
          headers: expect.objectContaining({
            'X-Api-Key': mockConfig.apiKey,
            'Content-Type': 'application/json',
          }),
        })
      );

      expect(payments).toEqual(mockPayments);
    });

    it('should get payments with pagination filters', async () => {
      await client.getPayments({
        organization_id: organizationId,
        environment_id: environmentId,
        offset: 10,
        limit: 50,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConfig.baseUrl}/organizations/${organizationId}/environments/${environmentId}/payments?offset=10&limit=50`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should get payments with status filters', async () => {
      await client.getPayments({
        organization_id: organizationId,
        environment_id: environmentId,
        statuses: ['completed', 'sending'],
      });

      expect(mockFetch).toHaveBeenCalledWith(
        `${mockConfig.baseUrl}/organizations/${organizationId}/environments/${environmentId}/payments?statuses=completed&statuses=sending`,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should get payments with all filters', async () => {
      await client.getPayments({
        organization_id: organizationId,
        environment_id: environmentId,
        offset: 0,
        limit: 25,
        wallet_id: walletId,
        statuses: ['completed'],
        sort_key: 'created_at',
        sort_order: 'DESC',
        kind: 'bolt11',
        direction: 'send',
        start_date: '2024-01-01T00:00:00Z',
        end_date: '2024-01-31T23:59:59Z',
      });

      const expectedUrl = `${mockConfig.baseUrl}/organizations/${organizationId}/environments/${environmentId}/payments?offset=0&limit=25&wallet_id=${walletId}&statuses=completed&sort_key=created_at&sort_order=DESC&kind=bolt11&direction=send&start_date=2024-01-01T00%3A00%3A00Z&end_date=2024-01-31T23%3A59%3A59Z`;

      expect(mockFetch).toHaveBeenCalledWith(
        expectedUrl,
        expect.objectContaining({
          method: 'GET',
        })
      );
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(
        client.getPayments({
          organization_id: '',
          environment_id: environmentId,
        })
      ).rejects.toThrow('organization_id and environment_id are required');

      await expect(
        client.getPayments({
          organization_id: organizationId,
          environment_id: '',
        })
      ).rejects.toThrow('organization_id and environment_id are required');
    });

    it('should handle empty results', async () => {
      const emptyPayments = {
        items: [],
        offset: 0,
        limit: 100,
        total: 0,
      };

      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => JSON.stringify(emptyPayments),
      });

      const payments = await client.getPayments({
        organization_id: organizationId,
        environment_id: environmentId,
      });

      expect(payments).toEqual(emptyPayments);
    });

    it('should handle API errors', async () => {
      const errorResponse = {
        message: 'Environment not found',
      };

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        text: async () => JSON.stringify(errorResponse),
      });

      await expect(
        client.getPayments({
          organization_id: organizationId,
          environment_id: environmentId,
        })
      ).rejects.toThrow();
    });
  });

  describe('sendPayment', () => {
    const organizationId = 'd27b642f-817c-4541-9215-3fc321e232af';
    const environmentId = '123e4567-e89b-12d3-a456-426614174000';
    const walletId = '7a68a525-9d11-4c1e-a3dd-1c2bf1378ba2';
    const paymentId = 'send-payment-123';

    const mockSendPaymentSending = {
      id: paymentId,
      wallet_id: walletId,
      organization_id: organizationId,
      environment_id: environmentId,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
      currency: 'btc',
      status: 'sending',
      direction: 'send',
      type: 'bolt11',
      data: {
        amount_msats: 150000,
        max_fee_msats: 1000,
        payment_request: 'lnbc1500n1p...',
        memo: 'Test send payment',
      },
    };

    const mockSendPaymentCompleted = {
      ...mockSendPaymentSending,
      status: 'completed',
      data: {
        ...mockSendPaymentSending.data,
        fee_msats: 500,
      },
    };

    it('should send bolt11 payment and poll until completed', async () => {
      // Reset mock to ensure clean state
      mockFetch.mockReset();

      // Mock the POST request (returns 202)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 202,
          statusText: 'Accepted',
          text: async () => '',
        })
        // Mock the GET requests (polling)
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => JSON.stringify(mockSendPaymentSending),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => JSON.stringify(mockSendPaymentCompleted),
        });

      const payment = await client.sendPayment({
        organization_id: organizationId,
        environment_id: environmentId,
        payment: {
          id: paymentId,
          wallet_id: walletId,
          currency: 'btc',
          type: 'bolt11',
          data: {
            payment_request: 'lnbc1500n1p...',
            amount_msats: 150000,
            max_fee_msats: 1000,
          },
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

      expect(payment).toEqual(mockSendPaymentCompleted);
    });

    it('should send onchain payment and poll until completed', async () => {
      const mockOnchainSending = {
        ...mockSendPaymentSending,
        type: 'onchain',
        data: {
          address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
          amount_sats: 150,
          max_fee_sats: 10,
          outflows: [],
        },
      };

      const mockOnchainCompleted = {
        ...mockOnchainSending,
        status: 'completed',
        data: {
          ...mockOnchainSending.data,
          fee_sats: 5,
          outflows: [
            {
              required_confirmations_num: 1,
              tx_id: 'a22ec88f7a84a705466c9cd8d37024155ffa7930300fcee4fed9e5cc4e25904e',
              amount_sats: 150,
            },
          ],
        },
      };

      // Mock the POST request and GET requests (polling)
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 202,
          statusText: 'Accepted',
          text: async () => '',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => JSON.stringify(mockOnchainSending),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => JSON.stringify(mockOnchainCompleted),
        });

      const payment = await client.sendPayment({
        organization_id: organizationId,
        environment_id: environmentId,
        payment: {
          id: paymentId,
          wallet_id: walletId,
          currency: 'btc',
          type: 'onchain',
          data: {
            address: 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
            amount_sats: 150,
            max_fee_sats: 10,
          },
        },
      });

      expect(payment).toEqual(mockOnchainCompleted);
    });

    it('should handle send payment failure', async () => {
      const mockFailedPayment = {
        ...mockSendPaymentSending,
        status: 'failed',
        error: {
          type: 'send_failed',
          detail: 'Insufficient balance',
        },
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 202,
          statusText: 'Accepted',
          text: async () => '',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => JSON.stringify(mockFailedPayment),
        });

      await expect(
        client.sendPayment({
          organization_id: organizationId,
          environment_id: environmentId,
          payment: {
            id: paymentId,
            wallet_id: walletId,
            currency: 'btc',
            type: 'bolt11',
            data: {
              payment_request: 'lnbc1500n1p...',
              amount_msats: 150000,
              max_fee_msats: 1000,
            },
          },
        })
      ).rejects.toThrow('Send payment failed: Insufficient balance');
    });

    it('should timeout if send payment polling takes too long', async () => {
      // Mock the POST request first, then infinite sending responses
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 202,
          statusText: 'Accepted',
          text: async () => '',
        })
        .mockResolvedValue({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => JSON.stringify(mockSendPaymentSending),
        });

      await expect(
        client.sendPayment(
          {
            organization_id: organizationId,
            environment_id: environmentId,
            payment: {
              id: paymentId,
              wallet_id: walletId,
              currency: 'btc',
              type: 'bolt11',
              data: {
                payment_request: 'lnbc1500n1p...',
                amount_msats: 150000,
                max_fee_msats: 1000,
              },
            },
          },
          {
            maxAttempts: 2,
            intervalMs: 100,
            timeoutMs: 150,
          }
        )
      ).rejects.toThrow('Send payment polling failed after 2 attempts');
    });

    it('should throw error when required parameters are missing', async () => {
      await expect(
        client.sendPayment({
          organization_id: '',
          environment_id: environmentId,
          payment: {
            id: paymentId,
            wallet_id: walletId,
            currency: 'btc',
            type: 'bolt11',
            data: {
              payment_request: 'lnbc1500n1p...',
              amount_msats: 150000,
              max_fee_msats: 1000,
            },
          },
        })
      ).rejects.toThrow('organization_id and environment_id are required');

      await expect(
        client.sendPayment({
          organization_id: organizationId,
          environment_id: environmentId,
          payment: null as any,
        })
      ).rejects.toThrow('payment data is required');
    });

    it('should auto-generate payment ID if not provided', async () => {
      // Mock crypto.randomUUID for consistent testing
      const mockUUID = 'auto-generated-uuid-123';
      global.crypto = {
        randomUUID: jest.fn().mockReturnValue(mockUUID),
      } as any;

      const mockPaymentWithAutoId = {
        ...mockSendPaymentCompleted,
        id: mockUUID,
      };

      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 202,
          statusText: 'Accepted',
          text: async () => '',
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          statusText: 'OK',
          text: async () => JSON.stringify(mockPaymentWithAutoId),
        });

      const payment = await client.sendPayment({
        organization_id: organizationId,
        environment_id: environmentId,
        payment: {
          wallet_id: walletId,
          currency: 'btc',
          type: 'bolt11',
          data: {
            payment_request: 'lnbc1500n1p...',
            amount_msats: 150000,
            max_fee_msats: 1000,
          },
        },
      });

      expect(payment.id).toBe(mockUUID);
    });
  });
});
