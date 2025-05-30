import { VoltageClient, VoltageApiError } from '../src/index.js';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

// Example usage of the Voltage API SDK
async function main() {
  // Get configuration from environment variables
  const apiKey = process.env.VOLTAGE_API_KEY;
  const organizationId = process.env.VOLTAGE_ORGANIZATION_ID;
  const baseUrl = process.env.VOLTAGE_BASE_URL || 'https://voltageapi.com/v1';
  const timeout = parseInt(process.env.VOLTAGE_TIMEOUT || '30000');

  // Validate required environment variables
  if (!apiKey) {
    console.error('Error: VOLTAGE_API_KEY environment variable is required');
    console.error('Please copy .env.example to .env and fill in your API key');
    process.exit(1);
  }

  if (!organizationId) {
    console.error('Error: VOLTAGE_ORGANIZATION_ID environment variable is required');
    console.error('Please copy .env.example to .env and fill in your organization ID');
    process.exit(1);
  }

  // Initialize the client with your API key
  const client = new VoltageClient({
    apiKey,
    baseUrl,
    timeout,
  });

  // Alternative: Initialize with bearer token
  // const client = new VoltageClient({
  //   bearerToken: process.env.VOLTAGE_BEARER_TOKEN,
  // });

  try {
    // Get all wallets in an organization
    console.log('Fetching wallets...');
    const wallets = await client.getWallets({
      organization_id: organizationId,
    });

    console.log(`Found ${wallets.length} wallets:`);
    wallets.forEach(wallet => {
      console.log(`- ${wallet.name} (${wallet.id})`);
      console.log(`  Network: ${wallet.network}`);
      console.log(`  Active: ${wallet.active}`);
      console.log(`  Balances: ${wallet.balances.length}`);
      console.log(`  Created: ${wallet.created_at}`);
      console.log('');
    });

    // Get a specific wallet
    if (wallets.length > 0) {
      const firstWallet = wallets[0];
      console.log(`Fetching details for wallet: ${firstWallet.name}`);

      const walletDetails = await client.getWallet({
        organization_id: organizationId,
        wallet_id: firstWallet.id,
      });

      console.log('Wallet details:');
      console.log(JSON.stringify(walletDetails, null, 2));
    }
  } catch (error) {
    if (error instanceof VoltageApiError) {
      console.error('Voltage API Error:', error.message);
      console.error('Status:', error.status);
      console.error('Code:', error.code);
      console.error('Details:', error.details);
    } else {
      console.error('Unexpected error:', error);
    }
  }
}

// Run the example
main().catch(console.error);
