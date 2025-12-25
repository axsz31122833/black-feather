import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5173',
    headless: true
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
  ]
})

