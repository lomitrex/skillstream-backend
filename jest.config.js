/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  setupFiles: ['dotenv/config'],
  // 1. ADD THIS LINE: Tells Jest to run our crypto polyfill before tests
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'], 
  roots: ['<rootDir>/tests'],
  testPathIgnorePatterns: [
    '/node_modules/',
    '/uploads/',
    '\\.backup'
  ],
  maxWorkers: 1
};