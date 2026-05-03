// @ts-check
const path = require('path');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: path.join(__dirname, 'e2e'),
  fullyParallel: false,
  workers: 1,
  timeout: 60000,
  expect: { timeout: 15000 },
  use: {
    baseURL: 'http://127.0.0.1:8765',
    headless: true,
    viewport: { width: 1280, height: 800 },
  },
  webServer: {
    command: 'npx --yes http-server . -p 8765 -c-1',
    cwd: __dirname,
    url: 'http://127.0.0.1:8765/index.html',
    reuseExistingServer: true,
    timeout: 120000,
  },
});
