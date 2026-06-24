// jest.setup.js
// Injects the native Node.js Web Crypto API into the Jest sandbox global scope
const { webcrypto } = require('crypto');

if (typeof globalThis.crypto === 'undefined') {
  globalThis.crypto = webcrypto;
}