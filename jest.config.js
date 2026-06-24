/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Load environment variables BEFORE any test files are imported
  setupFiles: ['dotenv/config'],
  roots: ['<rootDir>/tests'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/uploads/',
    '\\.backup'
  ],
  maxWorkers: 1
};