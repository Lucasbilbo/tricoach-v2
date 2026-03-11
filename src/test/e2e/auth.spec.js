import { test, expect } from '@playwright/test'

test.describe('Flujo de autenticación', () => {
  test('muestra el botón de login cuando no hay sesión', async ({ page }) => {
    await page.goto('http://localhost:8888')
    await expect(page.getByText('Iniciar sesión con Google')).toBeVisible()
  })

  test('muestra el título de la app', async ({ page }) => {
    await page.goto('http://localhost:8888')
    await expect(page.getByText('TriCoach')).toBeVisible()
  })

  test('página de privacidad carga correctamente', async ({ page }) => {
    await page.goto('http://localhost:8888/privacidad')
    await expect(page.getByText('Política de Privacidad')).toBeVisible()
  })

  test('página de términos carga correctamente', async ({ page }) => {
    await page.goto('http://localhost:8888/terminos')
    await expect(page.getByText('Términos de Uso')).toBeVisible()
  })
})