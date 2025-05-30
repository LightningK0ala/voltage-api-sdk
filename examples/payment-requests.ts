/**
 * Example: Creating Payment Requests (Invoices)
 *
 * This example demonstrates how to create different types of payment requests
 * using the Voltage API SDK. The SDK automatically handles the polling logic
 * to wait for the payment request to be ready.
 */

import { VoltageClient } from '../src';

async function createPaymentRequestExamples() {
  // Initialize the client with your API credentials
  const client = new VoltageClient({
    apiKey: 'your-api-key', // or use bearerToken for user authentication
    baseUrl: 'https://voltageapi.com/api/v1', // Optional: defaults to production
  });

  const organizationId = 'your-organization-id';
  const environmentId = 'your-environment-id';
  const walletId = 'your-wallet-id';

  try {
    // Example 1: Create a Lightning (Bolt11) Payment Request
    console.log('Creating Lightning payment request...');
    const lightningPayment = await client.createPaymentRequest({
      organization_id: organizationId,
      environment_id: environmentId,
      payment: {
        id: crypto.randomUUID(), // Generate a unique payment ID
        wallet_id: walletId,
        currency: 'btc',
        amount_msats: 150000, // 150 sats = 150,000 millisats
        payment_kind: 'bolt11',
        description: 'Payment for coffee',
      },
    });

    console.log('Lightning payment ready:', {
      paymentId: lightningPayment.id,
      paymentRequest:
        lightningPayment.type === 'bolt11' ? lightningPayment.data.payment_request : undefined,
      status: lightningPayment.status,
    });

    // Example 2: Create an On-chain Payment Request
    console.log('Creating on-chain payment request...');
    const onchainPayment = await client.createPaymentRequest({
      organization_id: organizationId,
      environment_id: environmentId,
      payment: {
        id: crypto.randomUUID(),
        wallet_id: walletId,
        currency: 'btc',
        amount_msats: 1500000, // 1500 sats
        payment_kind: 'onchain',
        description: 'On-chain payment for services',
      },
    });

    console.log('On-chain payment ready:', {
      paymentId: onchainPayment.id,
      address: onchainPayment.type === 'onchain' ? onchainPayment.data.address : undefined,
      status: onchainPayment.status,
    });

    // Example 3: Create a BIP21 Payment Request (both Lightning and On-chain)
    console.log('Creating BIP21 payment request...');
    const bip21Payment = await client.createPaymentRequest({
      organization_id: organizationId,
      environment_id: environmentId,
      payment: {
        id: crypto.randomUUID(),
        wallet_id: walletId,
        currency: 'btc',
        amount_msats: 250000, // 250 sats
        payment_kind: 'bip21',
        description: 'Flexible payment (Lightning or On-chain)',
      },
    });

    console.log('BIP21 payment ready:', {
      paymentId: bip21Payment.id,
      paymentRequest: bip21Payment.type === 'bip21' ? bip21Payment.data.payment_request : undefined,
      address: bip21Payment.type === 'bip21' ? bip21Payment.data.address : undefined,
      status: bip21Payment.status,
    });

    // Example 4: Create payment request with custom polling configuration
    console.log('Creating payment request with custom polling...');
    const customPollingPayment = await client.createPaymentRequest(
      {
        organization_id: organizationId,
        environment_id: environmentId,
        payment: {
          id: crypto.randomUUID(),
          wallet_id: walletId,
          currency: 'btc',
          amount_msats: null, // "any amount" invoice
          payment_kind: 'bolt11',
          description: 'Any amount Lightning payment',
        },
      },
      {
        maxAttempts: 20, // Maximum polling attempts
        intervalMs: 500, // Poll every 500ms
        timeoutMs: 10000, // Timeout after 10 seconds
      }
    );

    console.log('Custom polling payment ready:', {
      paymentId: customPollingPayment.id,
      paymentRequest:
        customPollingPayment.type === 'bolt11'
          ? customPollingPayment.data.payment_request
          : undefined,
      status: customPollingPayment.status,
    });

    // Example 5: Get an existing payment directly (without polling)
    console.log('Getting existing payment...');
    const existingPayment = await client.getPayment({
      organization_id: organizationId,
      environment_id: environmentId,
      payment_id: lightningPayment.id,
    });

    console.log('Existing payment:', {
      paymentId: existingPayment.id,
      status: existingPayment.status,
      updatedAt: existingPayment.updated_at,
    });
  } catch (error) {
    console.error('Error creating payment request:', error);

    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message.includes('timed out')) {
        console.error('Payment generation took too long');
      } else if (error.message.includes('Payment generation failed')) {
        console.error('Payment generation failed on the server');
      } else {
        console.error('Unexpected error:', error.message);
      }
    }
  }
}

// Run the examples
if (require.main === module) {
  createPaymentRequestExamples().catch(console.error);
}

export { createPaymentRequestExamples };
