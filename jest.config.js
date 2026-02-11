module.exports = {
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  verbose: true,
  testPathIgnorePatterns: ['/node_modules'],
  roots: ['<rootDir>'],
  testMatch: [
    '<rootDir>/src/**/__tests__/**/*.+(ts|tsx|js)',
    '<rootDir>/src/**/__tests__/**/*?(*.)+(spec|test).+(ts|tsx|js)',
    '<rootDir>/src/**/?(*.)+(spec|test).+(ts|tsx|js)',
  ],
  transform: {
    '^.+\\.(ts|tsx)$': '@swc/jest',
  },

  globalSetup: '<rootDir>/dotenv/dotenv-test.ts',
  testTimeout: 100000,
};
