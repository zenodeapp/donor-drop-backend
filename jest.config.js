module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/sql/setup.js'],
  testMatch: ['**/*.test.js'],
  verbose: true
}; 