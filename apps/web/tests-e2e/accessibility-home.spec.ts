import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

/**
 * Tests e2e d'accessibilité sur la page d'accueil (landing non connectée).
 * Complète l'audit manuel Silktide par un scan automatisé (axe-core) et
 * une vérification réelle de la navigation clavier.
 */

test.describe('Accessibilité — page d\'accueil', () => {
  test('ne remonte aucune violation WCAG 2.0/2.1 A et AA (axe-core)', async ({ page }) => {
    await page.goto('/')

    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    expect(results.violations, JSON.stringify(results.violations, null, 2)).toEqual([])
  })

  test('a un <html lang> et un <title> renseignés', async ({ page }) => {
    await page.goto('/')

    const lang = await page.locator('html').getAttribute('lang')
    expect(lang).toBeTruthy()

    await expect(page).toHaveTitle(/.+/)
  })

  test('expose un H1 unique et non vide', async ({ page }) => {
    await page.goto('/')

    const h1 = page.locator('h1')
    await expect(h1).toHaveCount(1)
    await expect(h1).not.toBeEmpty()
  })

  test('permet d\'atteindre Connexion et Inscription au clavier (Tab), avec focus visible', async ({ page }) => {
    await page.goto('/')

    const login = page.getByRole('button', { name: /connexion|login/i })
    const forgot = page.getByRole('link', { name: /mot de passe oublié|forgot password/i })
    const register = page.getByRole('button', { name: /inscription|sign up/i })

    // Tabuler jusqu'au bouton de connexion, quel que soit l'ordre des éléments
    // focusables déjà présents avant lui (ex: skip-links éventuels).
    await page.keyboard.press('Tab')
    let guard = 0
    while (!(await login.evaluate((el) => el === document.activeElement)) && guard < 10) {
      await page.keyboard.press('Tab')
      guard += 1
    }
    await expect(login).toBeFocused()

    // Outline de focus visible (défini globalement via :focus-visible dans main.css)
    const outline = await login.evaluate((el) => getComputedStyle(el).outlineStyle)
    expect(outline).not.toBe('none')

    await page.keyboard.press('Tab')
    await expect(forgot).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(register).toBeFocused()
  })
})
