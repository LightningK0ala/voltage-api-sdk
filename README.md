# Voltage API SDK

Official TypeScript/JavaScript SDK for the [Voltage Payments API](https://voltageapi.com). This SDK provides a type-safe and developer-friendly way to interact with the Voltage API from both browser and Node.js environments.

## Features

- 🌐 **Universal**: Works in both browser and Node.js environments
- 📝 **TypeScript**: Full TypeScript support with comprehensive type definitions
- 🔒 **Authentication**: Supports both API key and Bearer token authentication
- 🛡️ **Error Handling**: Robust error handling with custom error types
- ⚡ **Modern**: Built with modern JavaScript/TypeScript features
- 🧪 **Well Tested**: Comprehensive test suite
- 📦 **Tree Shakable**: ES modules with tree shaking support
- 🔐 **Secure**: Environment variable support for sensitive credentials

## Module Compatibility

This SDK supports both **CommonJS** and **ES Modules** out of the box, making it compatible with all modern JavaScript environments:

### ES Modules (ESM)

```javascript
import { VoltageClient } from 'voltage-api-sdk';
```

### CommonJS (CJS)

```javascript
const { VoltageClient } = require('voltage-api-sdk');
```

### Compatibility Matrix

| Environment         | Import Style | Status       |
| ------------------- | ------------ | ------------ |
| Node.js (ESM)       | `import`     | ✅ Supported |
| Node.js (CommonJS)  | `require`    | ✅ Supported |
| Browser (ESM)       | `import`     | ✅ Supported |
| TypeScript          | `import`     | ✅ Supported |
| Webpack             | Both         | ✅ Supported |
| Rollup              | Both         | ✅ Supported |
| Vite                | Both         | ✅ Supported |
| n8n Community Nodes | Both         | ✅ Supported |

The package uses explicit file extensions (`.cjs` for CommonJS, `.esm.js` for ES modules) to ensure maximum compatibility across all environments.

## Installation

### From npm (Recommended for production)

```bash
npm install voltage-api-sdk
```

### From GitHub (Great for development)

```bash
# Install directly from GitHub
npm install git+https://github.com/voltage-api/sdk.git

# Or install a specific branch/tag
npm install git+https://github.com/voltage-api/sdk.git#main
npm install git+https://github.com/voltage-api/sdk.git#v1.0.0
```

**Why use GitHub installation?**

- ✅ Get the latest features immediately
- ✅ No need to wait for npm publishing
- ✅ Perfect for development and testing
- ✅ Works with private repositories

**Example usage in your project's package.json:**

```json
{
  "dependencies": {
    "voltage-api-sdk": "^0.1.2"
  }
}
```

Then install with:

```bash
npm install
# or
yarn install
```

## Quick Start

### 1. Installation

Choose one of the installation methods above, then continue with the setup.

### 2. Environment Setup

For security, use environment variables to store your API credentials:

```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your actual credentials
```

Your `.env` file should contain:

```env
# Your Voltage API key (starts with vltg_)
VOLTAGE_API_KEY=vltg_your_actual_api_key_here

# Your organization ID (UUID format)
VOLTAGE_ORGANIZATION_ID=your-organization-id-here

# Optional: Custom base URL (defaults to https://voltageapi.com/v1)
VOLTAGE_BASE_URL=https://voltageapi.com/v1

# Optional: Request timeout in milliseconds (defaults to 30000)
VOLTAGE_TIMEOUT=30000
```

### 3. Basic Usage

```typescript
import { VoltageClient } from 'voltage-api-sdk';

// Initialize the client with environment variables
const client = new VoltageClient({
  apiKey: process.env.VOLTAGE_API_KEY,
  baseUrl: process.env.VOLTAGE_BASE_URL || 'https://voltageapi.com/v1',
  timeout: parseInt(process.env.VOLTAGE_TIMEOUT || '30000'),
});

// Get all wallets in an organization
const wallets = await client.getWallets({
  organization_id: process.env.VOLTAGE_ORGANIZATION_ID,
});

console.log('Wallets:', wallets);
```

### 4. Run Example

```bash
# Make sure you've set up your .env file first
npm run example
```

## Authentication

The SDK supports two authentication methods:

### API Key Authentication

**Direct usage:**

```typescript
const client = new VoltageClient({
  apiKey: 'vltg_your_api_key_here',
});
```

**Using environment variables (recommended):**

```typescript
const client = new VoltageClient({
  apiKey: process.env.VOLTAGE_API_KEY,
});
```

### Bearer Token Authentication

**Direct usage:**

```typescript
const client = new VoltageClient({
  bearerToken: 'your_jwt_token_here',
});
```

**Using environment variables (recommended):**

```typescript
const client = new VoltageClient({
  bearerToken: process.env.VOLTAGE_BEARER_TOKEN,
});
```

## Configuration Options

```typescript
interface VoltageApiConfig {
  baseUrl?: string; // API base URL, defaults to 'https://voltageapi.com/v1'
  apiKey?: string; // API key for authentication
  bearerToken?: string; // Bearer token for authentication
  timeout?: number; // Request timeout in milliseconds, defaults to 30000
}
```

## Available Methods

### Wallets

#### `getWallets(params)`

Get all wallets in an organization.

```typescript
const wallets = await client.getWallets({
  organization_id: 'your-organization-id',
});
```

#### `getWallet(params)`

Get a specific wallet by ID.

```typescript
const wallet = await client.getWallet({
  organization_id: 'your-organization-id',
  wallet_id: 'your-wallet-id',
});
```

#### `createWallet(params)`

Create a new wallet.

```typescript
await client.createWallet({
  organization_id: 'your-organization-id',
  wallet: {
    id: 'new-wallet-id',
    environment_id: 'your-environment-id',
    line_of_credit_id: 'your-line-of-credit-id',
    name: 'My New Wallet',
    network: 'mutinynet',
    limit: 100000000,
    metadata: {
      description: 'A test wallet',
    },
  },
});
```

#### `deleteWallet(params)`

Delete a wallet.

```typescript
await client.deleteWallet({
  organization_id: 'your-organization-id',
  wallet_id: 'wallet-to-delete',
});
```

### Payment Requests

#### `createPaymentRequest(params, pollingConfig?)`

Create a new payment request (invoice) and wait for it to be ready. Payment IDs are automatically generated if not provided. This method automatically handles the polling logic to wait for the payment to be generated.

**Lightning Payment Request:**

```typescript
const lightningPayment = await client.createPaymentRequest({
  organization_id: 'your-organization-id',
  environment_id: 'your-environment-id',
  payment: {
    // id is optional - will be auto-generated if not provided
    wallet_id: 'your-wallet-id',
    currency: 'btc',
    amount_msats: 150000, // 150 sats = 150,000 millisats
    payment_kind: 'bolt11',
    description: 'Payment for coffee',
  },
});

console.log('Payment request:', lightningPayment.data.payment_request);
```

**On-chain Payment Request:**

```typescript
const onchainPayment = await client.createPaymentRequest({
  organization_id: 'your-organization-id',
  environment_id: 'your-environment-id',
  payment: {
    // id: "custom-payment-id", // Optional - auto-generated if not provided
    wallet_id: 'your-wallet-id',
    currency: 'btc',
    amount_msats: 1500000, // 1500 sats
    payment_kind: 'onchain',
    description: 'On-chain payment for services',
  },
});

console.log('Bitcoin address:', onchainPayment.data.address);
```

**BIP21 Payment Request (Lightning + On-chain):**

```typescript
const bip21Payment = await client.createPaymentRequest({
  organization_id: 'your-organization-id',
  environment_id: 'your-environment-id',
  payment: {
    // id: "custom-payment-id", // Optional - auto-generated if not provided
    wallet_id: 'your-wallet-id',
    currency: 'btc',
    amount_msats: 250000, // 250 sats
    payment_kind: 'bip21',
    description: 'Flexible payment (Lightning or On-chain)',
  },
});

console.log('Lightning request:', bip21Payment.data.payment_request);
console.log('Bitcoin address:', bip21Payment.data.address);
```

**Any Amount Invoice:**

```typescript
const anyAmountPayment = await client.createPaymentRequest({
  organization_id: 'your-organization-id',
  environment_id: 'your-environment-id',
  payment: {
    // id: "custom-payment-id", // Optional - auto-generated if not provided
    wallet_id: 'your-wallet-id',
    currency: 'btc',
    amount_msats: null, // "any amount" invoice
    payment_kind: 'bolt11',
    description: 'Any amount Lightning payment',
  },
});
```

**Custom Polling Configuration:**

```typescript
const payment = await client.createPaymentRequest(
  {
    organization_id: 'your-organization-id',
    environment_id: 'your-environment-id',
    payment: {
      // id: "custom-payment-id", // Optional - auto-generated if not provided
      wallet_id: 'your-wallet-id',
      currency: 'btc',
      amount_msats: 150000,
      payment_kind: 'bolt11',
      description: 'Payment with custom polling',
    },
  },
  {
    maxAttempts: 20, // Maximum polling attempts (default: 30)
    intervalMs: 500, // Poll every 500ms (default: 1000ms)
    timeoutMs: 10000, // Timeout after 10 seconds (default: 30000ms)
  }
);
```

#### `getPayment(params)`

Get an existing payment by ID.

```typescript
const payment = await client.getPayment({
  organization_id: 'your-organization-id',
  environment_id: 'your-environment-id',
  payment_id: 'your-payment-id',
});

console.log('Payment status:', payment.status);
```

## Error Handling

The SDK includes a custom `VoltageApiError` class that provides detailed error information:

```typescript
import { VoltageApiError } from 'voltage-api-sdk';

try {
  const wallets = await client.getWallets({ organization_id: 'invalid-id' });
} catch (error) {
  if (error instanceof VoltageApiError) {
    console.error('API Error:', error.message);
    console.error('Status Code:', error.status);
    console.error('Error Code:', error.code);
    console.error('Details:', error.details);
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Environment Compatibility

### Node.js

The SDK works with Node.js 16+ and automatically uses the built-in `fetch` API in Node.js 18+. For Node.js 16-17, it will fallback to the `cross-fetch` polyfill.

### Browser

The SDK works in all modern browsers that support the `fetch` API. For older browsers, you may need to include a `fetch` polyfill.

## TypeScript Support

The SDK is written in TypeScript and includes comprehensive type definitions. All API responses and request parameters are fully typed:

```typescript
import type { Wallet, VoltageApiConfig, VoltageApiError } from 'voltage-api-sdk';

// Full type safety
const config: VoltageApiConfig = {
  apiKey: 'your-key',
  timeout: 10000,
};

const client = new VoltageClient(config);
const wallets: Wallet[] = await client.getWallets({ organization_id: 'id' });
```

## Development

### Setup

```bash
# Install dependencies
npm install

# Copy environment template and configure your credentials
cp .env.example .env
# Edit .env with your actual API credentials
```

**Development Dependencies Added:**

- `dotenv` - For loading environment variables
- `tsx` - For running TypeScript files directly

**Note on dist folder:**
The `dist` folder is committed to enable direct GitHub installations. The `prepare` script automatically rebuilds the project when needed.

### Building

```bash
npm run build
```

### Testing

```bash
npm test
```

### Running Examples

```bash
npm run example
```

### Linting and Formatting

```bash
npm run lint
npm run format
```

## Examples

See the [examples](./examples) directory for more usage examples:

- [Basic Usage](./examples/basic-usage.ts) - Complete example with environment variables
- [Payment Requests](./examples/payment-requests.ts) - Complete examples for creating payment requests

## Security Best Practices

- ✅ **Use environment variables** for API keys and sensitive data
- ✅ **Never commit `.env`** files to version control
- ✅ **Use `.env.example`** to document required environment variables
- ✅ **Validate environment variables** before using them

## API Reference

For complete API documentation, refer to the [Voltage Payments API documentation](https://voltageapi.com/docs).

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for your changes
5. Run the test suite
6. Submit a pull request

## License

MIT License. See [LICENSE](./LICENSE) for details.

## Support

For support, please visit the [Voltage documentation](https://voltageapi.com/docs) or contact support through the official channels.
