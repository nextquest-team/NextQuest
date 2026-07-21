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
  // Le serveur dev tourne dans Docker et ne publie son port qu'en IPv4.
  // `localhost` résout en IPv6 (::1) en premier sur macOS : le check de
  // disponibilité de Playwright échouait donc systématiquement (ECONNREFUSED
  // ::1:3001), le prenait pour absent et relançait un second `nuxt dev` en
  // doublon sur l'hôte — deux serveurs concurrents sur le même port, d'où le
  // crash HMR ("handleUpgrade() was called more than once"). En forçant le
  // check sur 127.0.0.1, `reuseExistingServer` détecte correctement le
  // conteneur déjà lancé et ne spawn plus de second serveur.
  webServer: {
    command: 'pnpm run dev',
    url: 'http://127.0.0.1:3001',
    reuseExistingServer: true,
    timeout: 60_000,
  },
})
