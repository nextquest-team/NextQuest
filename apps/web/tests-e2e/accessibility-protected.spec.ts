import { test } from './fixtures/auth'
import { expectPageToBeAccessible } from './helpers/a11y'

/**
 * Pages protégées (nécessitent une session). L'auth réelle passe par un
 * backend + DB (apps/api) — hors scope pour un test d'accessibilité front.
 * On mocke donc uniquement /api/auth/refresh et /api/users/me (voir
 * fixtures/auth.ts) pour franchir le middleware ; les autres appels API
 * échouent silencieusement et les pages retombent sur leurs états "vide"
 * ou "introuvable", déjà gérés par les composants (try/catch défensifs).
 * Ces états vides doivent, eux aussi, rester accessibles.
 */
const PROTECTED_PAGES = [
  '/dashboard',
  '/game-list',
  '/profil',
  '/actualites',
  '/next-quest',
  '/timeline',
  '/add-game',
  '/games/e2e-fake-game-id',
  '/games/catalog/e2e-fake-game-id',
]

for (const path of PROTECTED_PAGES) {
  test(`${path} respecte les critères de base d'accessibilité`, async ({ authenticatedPage }) => {
    await authenticatedPage.goto(path)
    await expectPageToBeAccessible(authenticatedPage)
  })
}
