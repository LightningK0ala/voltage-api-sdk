// Simulate importing the package by name (like after npm install)
// This uses the package.json exports field
import { VoltageClient } from 'voltage-api-sdk';

console.log('✅ Package ES module import successful!');
console.log('VoltageClient type:', typeof VoltageClient);
console.log('VoltageClient name:', VoltageClient.name);

// Test instantiation
try {
  const client = new VoltageClient({
    apiKey: 'test-key',
    baseUrl: 'https://api.voltage.cloud',
    timeout: 5000,
  });
  console.log('✅ VoltageClient instantiation successful!');
  console.log('Client constructor name:', client.constructor.name);
} catch (error) {
  console.log('❌ VoltageClient instantiation failed:', error.message);
}
