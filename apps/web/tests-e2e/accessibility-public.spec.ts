import { test } from '@playwright/test'
import { expectPageToBeAccessible } from './helpers/a11y'

/**
 * Pages publiques (accessibles sans être connecté).
 * La landing (/) a sa propre spec avec le test clavier détaillé :
 * voir accessibility-home.spec.ts.
 */
const PUBLIC_PAGES = [
  '/auth/login',
  '/auth/register',
  '/auth/forgot-password',
]

for (const path of PUBLIC_PAGES) {
  test(`${path} respecte les critères de base d'accessibilité`, async ({ page }) => {
    await page.goto(path)
    await expectPageToBeAccessible(page)
  })
}
