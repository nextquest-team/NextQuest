import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests-e2e',
  fullyParallel: true,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3001',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  // `nuxt dev` plante parfois (bug HMR connu, voir nuxt.config.ts) sous charge
  // de test répétée. En cas d'instabilité, préférer lancer un build de prod
  // (`pnpm run build && node .output/server/index.mjs`) sur le port 3001 avant
  // `pnpm run test:e2e` : `reuseExistingServer` détectera ce serveur déjà lancé.
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3001',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
