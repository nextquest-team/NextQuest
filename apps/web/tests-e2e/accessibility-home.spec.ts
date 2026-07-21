import { expect, test } from '@playwright/test'
import { expectPageToBeAccessible } from './helpers/a11y'

/**
 * Tests e2e d'accessibilité sur la page d'accueil (landing non connectée).
 * Complète l'audit manuel Silktide par un scan automatisé (axe-core) et
 * une vérification réelle de la navigation clavier.
 */

test.describe('Accessibilité — page d\'accueil', () => {
  test('respecte les critères de base (axe, lang, title, H1)', async ({ page }) => {
    await page.goto('/')
    await expectPageToBeAccessible(page)
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
