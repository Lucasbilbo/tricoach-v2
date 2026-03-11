export default {
  testDir: './src/test/e2e',
  testMatch: '**/*.spec.js',
  use: {
    baseURL: 'http://localhost:8888',
  },
  webServer: {
    command: 'netlify dev',
    url: 'http://localhost:8888',
    reuseExistingServer: true,
  }
}