import { test as base, type Page } from '@playwright/test'

/**
 * Faux utilisateur + mock des routes d'auth utilisées par plugins/auth.client.ts
 * (POST /api/auth/refresh) et useAuth().fetchProfile() (GET /api/users/me).
 *
 * Objectif : tester l'accessibilité des pages protégées sans dépendre d'un
 * backend réel (apps/api) ni de données seedées — les composants gèrent déjà
 * gracieusement les échecs des autres appels API (voir composables/*.ts),
 * donc seul le franchissement du middleware d'auth doit être mocké.
 */
const FAKE_USER = {
  id: 'e2e-fake-user-id',
  email: 'e2e@nextquest.dev',
  username: 'e2e-tester',
  displayName: 'E2E Tester',
  avatarUrl: null,
  bio: null,
  locale: 'fr',
  visibility: 'private',
  emailVerified: true,
  onboardingCompleted: true,
  createdAt: new Date().toISOString(),
}

async function mockAuth(page: Page) {
  await page.route('**/api/auth/refresh', (route) =>
    route.fulfill({
      json: { user: FAKE_USER, accessToken: 'e2e-fake-token' },
    }),
  )
  await page.route('**/api/users/me', (route) =>
    route.fulfill({ json: FAKE_USER }),
  )
}

export const test = base.extend<{ authenticatedPage: Page }>({
  authenticatedPage: async ({ page }, use) => {
    await mockAuth(page)
    await use(page)
  },
})

export { expect } from '@playwright/test'
