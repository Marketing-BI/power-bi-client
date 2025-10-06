module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  collectCoverage: true,
  coverageDirectory: 'coverage',
  verbose: true,
  testPathIgnorePatterns: [
      '/node_modules'
  ],
  roots: [
    '<rootDir>'
  ]
  ,
  testMatch: [
    "**/__tests__/**/*.+(ts|tsx|js)",
    "**/__tests__/**/*?(*.)+(spec|test).+(ts|tsx|js)",
    "**/?(*.)+(spec|test).+(ts|tsx|js)"
  ],
  transform: {
    "^.+\\.(ts|tsx)$": "ts-jest"
  },
  "globalSetup": "<rootDir>/dotenv/dotenv-test.ts",
  testTimeout: 100000,


};
