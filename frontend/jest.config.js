/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '\.(css|less|scss|sass)$': 'identity-obj-proxy',
  },
  testMatch: ['**/__tests__/**/*.test.tsx', '**/__tests__/**/*.test.ts'],
  transform: {
    '^.+\.tsx?$': [
      'ts-jest',
      {
        // Use the test-specific tsconfig so tests get Node types
        // without polluting the frontend app's type environment
        tsconfig: './tsconfig.jest.json',
      },
    ],
  },
};
