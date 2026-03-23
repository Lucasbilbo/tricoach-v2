import { test, expect } from '@playwright/test'

const BASE = 'http://localhost:5173'

test.describe('Flujo de autenticación', () => {
  test('muestra el botón de login cuando no hay sesión', async ({ page }) => {
    await page.goto(`${BASE}/app/`)
    await expect(page.getByText('Iniciar sesión con Google')).toBeVisible({ timeout: 10000 })
  })

  test('muestra el título de la app', async ({ page }) => {
    await page.goto(`${BASE}/app/`)
    await expect(page.getByText('TriCoach')).toBeVisible({ timeout: 10000 })
  })

  test('página de privacidad carga correctamente', async ({ page }) => {
    await page.goto(`${BASE}/app/privacidad`)
    await expect(page.getByText('Política de Privacidad')).toBeVisible({ timeout: 10000 })
  })

  test('página de términos carga correctamente', async ({ page }) => {
    await page.goto(`${BASE}/app/terminos`)
    await expect(page.getByText('Términos de Uso')).toBeVisible({ timeout: 10000 })
  })
})
