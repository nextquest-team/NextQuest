import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

/**
 * Vérifications d'accessibilité communes à toutes les pages :
 * scan axe-core (WCAG 2.0/2.1 A/AA), <html lang>, <title>, H1 unique.
 */
export async function expectPageToBeAccessible(page: Page) {
  // Certaines pages affichent d'abord un spinner (pas de H1) pendant le
  // chargement des données — on attend l'état stable avant de scanner,
  // sinon axe remonte de faux "page-has-heading-one" liés au timing.
  await page.locator('h1').first().waitFor({ state: 'attached' })

  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])

  const lang = await page.locator('html').getAttribute('lang')
  expect(lang).toBeTruthy()

  await expect(page).toHaveTitle(/.+/)

  const h1 = page.locator('h1')
  await expect(h1).toHaveCount(1)
  await expect(h1).not.toBeEmpty()
}
