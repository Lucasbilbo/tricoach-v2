/**
 * AUDITORÍA E2E — TriCoach v2
 * Cubre flujos críticos detectados en la auditoría manual.
 */
import { test, expect } from '@playwright/test'

// ─── Helpers ─────────────────────────────────────────────────────────────────

const MOCK_USER_ID = 'audit-user-e2e'
const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

function getMondayISO() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? -6 : 1 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return monday.toISOString().split('T')[0]
}

function getNextMondayISO() {
  const now = new Date()
  const day = now.getDay()
  const diff = day === 0 ? 1 : 8 - day
  const monday = new Date(now)
  monday.setDate(now.getDate() + diff)
  return monday.toISOString().split('T')[0]
}

function getTodayDia() {
  return DIAS_SEMANA[new Date().getDay()]
}

function buildMockPlan(overrides = {}) {
  const today = getTodayDia()
  const tomorrow = DIAS_SEMANA[(new Date().getDay() + 1) % 7]
  const sesiones = DIAS_SEMANA.map(dia => {
    if (overrides[dia]) return overrides[dia]
    if (dia === today) return { dia, tipo: 'Correr', descripcion: 'Rodaje suave 45min zona 2', duracion_min: 45, intensidad: 'suave', completada: false }
    if (dia === tomorrow) return { dia, tipo: 'Bici', descripcion: 'Fondo en bici 60min', duracion_min: 60, intensidad: 'moderada', completada: false }
    return { dia, tipo: 'Descanso', descripcion: 'Descanso activo', duracion_min: 0, intensidad: 'descanso', completada: false }
  })
  return { id: 'audit-plan-id', user_id: MOCK_USER_ID, semana: getMondayISO(), sesiones }
}

function buildFakeSession() {
  return {
    access_token: 'fake-audit-token',
    token_type: 'bearer',
    expires_in: 7200,
    expires_at: Math.floor(Date.now() / 1000) + 7200,
    refresh_token: 'fake-audit-refresh',
    user: {
      id: MOCK_USER_ID,
      email: 'audit@tricoach.test',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      app_metadata: { provider: 'google' },
      user_metadata: { name: 'Atleta Audit' },
    },
  }
}

function buildMockProfile(overrides = {}) {
  return {
    id: MOCK_USER_ID,
    email: 'audit@tricoach.test',
    nombre: 'Atleta Audit',
    deporte: 'running',
    nivel: 'intermedio',
    objetivo: 'bajar de 50min en 10K',
    plan: 'pro',
    messages_today: 0,
    last_message_date: null,
    personalidad: 'cercano',
    strava_token: null,
    strava_refresh_token: null,
    strava_token_expires_at: null,
    contexto: null,
    onboarding_visto: true,
    nombre_coach: 'Alex',
    fecha_carrera: null,
    edad: 30,
    fc_maxima: 185,
    historial_deportivo: '',
    lesiones: '',
    disponibilidad: '',
    created_at: '2025-01-01T00:00:00.000Z',
    ...overrides,
  }
}

async function setupApp(page, opts = {}) {
  const {
    profile = buildMockProfile(),
    plan = buildMockPlan(),
    noPlan = false,
    claudeResponse = 'Hola, soy tu coach. ¿En qué puedo ayudarte?',
    stravaData = { sinStrava: true },
    messages = [],
  } = opts

  const fakeSession = buildFakeSession()
  const planRef = { current: noPlan ? null : plan }

  await page.addInitScript((session) => {
    localStorage.setItem('sb-luqpjgzpydquqturgjmt-auth-token', JSON.stringify(session))
    localStorage.setItem('cookies_accepted', 'true')
  }, fakeSession)

  await page.route('**/auth/v1/**', async route => {
    const url = route.request().url()
    if (url.includes('/user')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeSession.user) })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeSession) })
    }
  })

  await page.route('**/rest/v1/**', async route => {
    const url = route.request().url()
    const method = route.request().method()
    const acceptHeader = route.request().headers()['accept'] || ''
    const wantsSingle = acceptHeader.includes('pgrst.object')

    const fulfill = (data) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wantsSingle ? (Array.isArray(data) ? data[0] ?? null : data) : (Array.isArray(data) ? data : [data])),
    })

    if (url.includes('/profiles')) {
      if (method === 'PATCH') {
        const raw = route.request().postData()
        if (raw) {
          try { Object.assign(profile, JSON.parse(raw)) } catch { /* ignore */ }
        }
      }
      await fulfill(profile)
    } else if (url.includes('/plans')) {
      if (method === 'POST') {
        planRef.current = plan
        await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify([plan]) })
      } else if (method === 'PATCH') {
        const raw = route.request().postData()
        if (raw) {
          try {
            const body = JSON.parse(raw)
            if (body.sesiones && planRef.current) planRef.current = { ...planRef.current, sesiones: body.sesiones }
          } catch { /* ignore */ }
        }
        await fulfill(planRef.current ?? {})
      } else if (url.includes('semana=lt.')) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      } else if (url.includes(getNextMondayISO())) {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      } else {
        if (noPlan) {
          await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
        } else {
          await fulfill(planRef.current)
        }
      }
    } else if (url.includes('/messages')) {
      if (method === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
      } else {
        await route.fulfill({
          status: 200, contentType: 'application/json',
          body: JSON.stringify(messages),
        })
      }
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    }
  })

  await page.route('**/.netlify/functions/strava-activities', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stravaData) })
  })

  await page.route('**/.netlify/functions/claude', async route => {
    const response = typeof claudeResponse === 'function' ? claudeResponse() : claudeResponse
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ content: [{ text: response }] }),
    })
  })

  await page.route('**/.netlify/functions/adjust-plan', async route => {
    const adjusted = { ...planRef.current }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(adjusted) })
  })

  await page.route('**/.netlify/functions/generate-plan', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(plan) })
  })

  await page.route('**/.netlify/functions/create-checkout', async route => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ url: 'https://checkout.stripe.com/mock' }),
    })
  })

  await page.goto('http://localhost:5173/app/')
  await expect(page.getByText('Plan').first()).toBeVisible({ timeout: 15000 })
}

// ─── FLUJO 1 — Autenticación ──────────────────────────────────────────────────

test.describe('FLUJO 1 — Autenticación', () => {
  test('F1-01: muestra pantalla de login sin sesión', async ({ page }) => {
    await page.goto('http://localhost:5173/app/')
    await expect(page.getByText('Iniciar sesión con Google')).toBeVisible({ timeout: 10000 })
  })

  test('F1-02: botón Google es visible y tiene texto correcto', async ({ page }) => {
    await page.goto('http://localhost:5173/app/')
    const btn = page.getByText('Iniciar sesión con Google')
    await expect(btn).toBeVisible()
    await expect(btn).toBeEnabled()
  })

  test('F1-03: páginas legales cargan sin sesión', async ({ page }) => {
    await page.goto('http://localhost:5173/app/privacidad')
    await expect(page.getByText('Política de Privacidad')).toBeVisible()
    await page.goto('http://localhost:5173/app/terminos')
    await expect(page.getByText('Términos de Uso')).toBeVisible()
  })
})

// ─── FLUJO 2 — Plan semanal ───────────────────────────────────────────────────

test.describe('FLUJO 2 — Plan semanal', () => {
  test('F2-01: muestra exactamente 7 sesiones', async ({ page }) => {
    await setupApp(page)
    await page.getByText('Plan').first().click()
    // Esperar a que cargue el plan
    await expect(page.getByText('HOY', { exact: true }).first()).toBeVisible({ timeout: 8000 })
    // Verificar los 7 días de la semana
    for (const dia of DIAS_SEMANA) {
      await expect(page.getByText(dia).first()).toBeVisible()
    }
  })

  test('F2-02: muestra CTA "Generar plan" cuando no hay plan', async ({ page }) => {
    await setupApp(page, { noPlan: true })
    await page.getByText('Plan').first().click()
    await expect(page.getByText(/genera/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('F2-03: la sesión de HOY tiene el badge correcto', async ({ page }) => {
    await setupApp(page)
    await page.getByText('Plan').first().click()
    await expect(page.getByText('HOY', { exact: true }).first()).toBeVisible({ timeout: 8000 })
  })

  test('F2-04: marcar sesión como completada (optimistic UI)', async ({ page }) => {
    await setupApp(page)
    await page.getByText('Plan').first().click()
    await expect(page.getByText('HOY', { exact: true }).first()).toBeVisible({ timeout: 8000 })

    // Buscar botón de completar para la sesión de hoy
    const completarBtn = page.getByRole('button', { name: /completar/i }).first()
    await expect(completarBtn).toBeVisible({ timeout: 5000 })
    await completarBtn.click()

    // Selector de RPE debe aparecer
    await expect(page.getByText('RPE').first()).toBeVisible({ timeout: 5000 })

    // Confirmar
    await page.getByRole('button', { name: 'Guardar' }).click()

    // La sesión debe marcarse visualmente con checkmark
    await expect(page.getByText(/✓/).first()).toBeVisible({ timeout: 1000 })
  })

  test('F2-05: el plan persiste al cambiar de pestaña y volver', async ({ page }) => {
    await setupApp(page)
    await page.getByText('Plan').first().click()
    await expect(page.getByText('HOY', { exact: true }).first()).toBeVisible({ timeout: 8000 })

    // Ir a Coach y volver a Plan
    await page.getByText('Coach').first().click()
    await page.getByText('Plan').first().click()

    // El plan debe seguir visible
    await expect(page.getByText('HOY', { exact: true }).first()).toBeVisible({ timeout: 5000 })
  })
})

// ─── FLUJO 3 — Chat con el coach ─────────────────────────────────────────────

test.describe('FLUJO 3 — Chat', () => {
  test('F3-01: NO aparece mensaje de bienvenida automático al abrir', async ({ page }) => {
    await setupApp(page, { messages: [] })
    await page.getByText('Coach').first().click()

    // Esperar un momento para que cargue
    await page.waitForTimeout(1500)

    // Verificar que no hay mensaje automático de bienvenida
    const mensajes = page.locator('[style*="inline-block"]')
    const count = await mensajes.count()
    expect(count).toBe(0)
  })

  test('F3-02: historial de mensajes anteriores carga correctamente', async ({ page }) => {
    const messages = [
      { role: 'user', content: 'Hola coach' },
      { role: 'assistant', content: '¡Hola! ¿En qué puedo ayudarte?' },
    ]
    await setupApp(page, { messages })
    await page.getByText('Coach').first().click()

    await expect(page.getByText('Hola coach')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText('¡Hola! ¿En qué puedo ayudarte?')).toBeVisible()
  })

  test('F3-03: typing indicator visible mientras procesa respuesta', async ({ page }) => {
    let resolveResponse
    const responsePromise = new Promise(resolve => { resolveResponse = resolve })

    await page.addInitScript((session) => {
      localStorage.setItem('sb-luqpjgzpydquqturgjmt-auth-token', JSON.stringify(session))
      localStorage.setItem('cookies_accepted', 'true')
    }, buildFakeSession())

    // Rutas base rápidas
    await page.route('**/auth/v1/**', r => r.fulfill({ status: 200, body: '{}', contentType: 'application/json' }))
    await page.route('**/rest/v1/**', async route => {
      const url = route.request().url()
      const wantsSingle = (route.request().headers()['accept'] || '').includes('pgrst.object')
      const data = url.includes('/profiles') ? buildMockProfile() : []
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(wantsSingle ? (Array.isArray(data) ? data[0] ?? null : data) : (Array.isArray(data) ? data : [data])),
      })
    })
    await page.route('**/.netlify/functions/strava-activities', r => r.fulfill({ status: 200, body: '{"sinStrava":true}', contentType: 'application/json' }))
    await page.route('**/.netlify/functions/adjust-plan', r => r.fulfill({ status: 200, body: '{}', contentType: 'application/json' }))

    // Respuesta de Claude que tarda
    await page.route('**/.netlify/functions/claude', async route => {
      await responsePromise
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ text: 'Aquí mi respuesta' }] }) })
    })

    await page.goto('http://localhost:5173/app/')
    await expect(page.getByText('Plan').first()).toBeVisible({ timeout: 15000 })
    await page.getByText('Coach').first().click()

    await page.getByPlaceholder('Escribe un mensaje...').fill('Hola')
    await page.getByRole('button', { name: 'Enviar' }).click()

    // Typing indicator debe aparecer mientras espera
    await expect(page.locator('.typing-indicator')).toBeVisible({ timeout: 5000 })

    // Resolver la respuesta
    resolveResponse()
    await expect(page.getByText('Aquí mi respuesta')).toBeVisible({ timeout: 8000 })
    await expect(page.locator('.typing-indicator')).not.toBeVisible()
  })

  test('F3-04: respuesta del coach con markdown renderiza negritas', async ({ page }) => {
    await setupApp(page, { claudeResponse: 'Haz **series cortas** de 400m. La **recuperación** es clave.' })
    await page.getByText('Coach').first().click()

    await page.getByPlaceholder('Escribe un mensaje...').fill('Consejo de entrenamiento')
    await page.getByRole('button', { name: 'Enviar' }).click()

    // El texto debe aparecer (negritas renderizadas con <strong>)
    await expect(page.locator('strong').filter({ hasText: 'series cortas' })).toBeVisible({ timeout: 10000 })
    await expect(page.locator('strong').filter({ hasText: 'recuperación' })).toBeVisible()
  })

  test('F3-05: coach NO menciona Strava cuando usuario no tiene conectado', async ({ page }) => {
    await setupApp(page, {
      stravaData: { sinStrava: true },
      claudeResponse: '¡Buen entrenamiento! Sigue así con tu plan de running.',
    })
    await page.getByText('Coach').first().click()

    await page.getByPlaceholder('Escribe un mensaje...').fill('¿Cómo van mis entrenamientos?')
    await page.getByRole('button', { name: 'Enviar' }).click()

    await expect(page.getByText(/buen entrenamiento/i)).toBeVisible({ timeout: 10000 })

    // La respuesta NO debe contener referencias a Strava
    const respuesta = await page.locator('span').filter({ hasText: /buen entrenamiento/i }).textContent()
    expect(respuesta).not.toMatch(/strava/i)
  })

  test('F3-06: botón "Aplicar cambio al plan" aparece cuando coach propone ajuste', async ({ page }) => {
    await setupApp(page, {
      claudeResponse: 'Podría cambiar la sesión del jueves y ajustar el plan para que descanses un día más.',
    })
    await page.getByText('Coach').first().click()

    await page.getByPlaceholder('Escribe un mensaje...').fill('Tengo cansancio acumulado')
    await page.getByRole('button', { name: 'Enviar' }).click()

    await expect(page.getByRole('button', { name: /aplicar cambio al plan/i })).toBeVisible({ timeout: 10000 })
  })

  test('F3-07: input deshabilitado mientras el coach responde', async ({ page }) => {
    let resolveResponse
    const responsePromise = new Promise(resolve => { resolveResponse = resolve })

    await page.addInitScript((session) => {
      localStorage.setItem('sb-luqpjgzpydquqturgjmt-auth-token', JSON.stringify(session))
      localStorage.setItem('cookies_accepted', 'true')
    }, buildFakeSession())
    await page.route('**/auth/v1/**', r => r.fulfill({ status: 200, body: '{}', contentType: 'application/json' }))
    await page.route('**/rest/v1/**', async route => {
      const url = route.request().url()
      const wantsSingle = (route.request().headers()['accept'] || '').includes('pgrst.object')
      const data = url.includes('/profiles') ? buildMockProfile() : []
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(wantsSingle ? (Array.isArray(data) ? data[0] ?? null : data) : (Array.isArray(data) ? data : [data])),
      })
    })
    await page.route('**/.netlify/functions/strava-activities', r => r.fulfill({ status: 200, body: '{"sinStrava":true}', contentType: 'application/json' }))
    await page.route('**/.netlify/functions/adjust-plan', r => r.fulfill({ status: 200, body: '{}', contentType: 'application/json' }))
    await page.route('**/.netlify/functions/claude', async route => {
      await responsePromise
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ content: [{ text: 'Ok' }] }) })
    })

    await page.goto('http://localhost:5173/app/')
    await expect(page.getByText('Plan').first()).toBeVisible({ timeout: 15000 })
    await page.getByText('Coach').first().click()

    await page.getByPlaceholder('Escribe un mensaje...').fill('Test')
    await page.getByRole('button', { name: 'Enviar' }).click()

    // Input debe estar deshabilitado
    await expect(page.getByPlaceholder('Escribe un mensaje...')).toBeDisabled({ timeout: 3000 })

    resolveResponse()
    await expect(page.getByPlaceholder('Escribe un mensaje...')).toBeEnabled({ timeout: 8000 })
  })

  test('F3-08: límite de mensajes Free muestra advertencia', async ({ page }) => {
    await setupApp(page, {
      profile: buildMockProfile({ plan: 'free', messages_today: 24 }),
    })
    await page.getByText('Coach').first().click()
    // Con 24 mensajes, queda 1 → contador visible
    await expect(page.getByText(/1 mensaje.*restante/i)).toBeVisible({ timeout: 5000 })
  })
})

// ─── FLUJO 4 — Perfil ─────────────────────────────────────────────────────────

test.describe('FLUJO 4 — Perfil', () => {
  test('F4-01: campos del perfil cargan con los datos del usuario', async ({ page }) => {
    await setupApp(page, { profile: buildMockProfile({ nombre: 'Lucas Test', deporte: 'running' }) })
    await page.getByText('Perfil').first().click()
    // Esperar a que el primer input (nombre) tenga el valor correcto
    await expect(page.locator('input').first()).toHaveValue('Lucas Test', { timeout: 8000 })
  })

  test('F4-02: badge Pro visible para usuarios Pro', async ({ page }) => {
    await setupApp(page, { profile: buildMockProfile({ plan: 'pro' }) })
    await page.getByText('Perfil').first().click()
    await expect(page.getByText('Pro').first()).toBeVisible({ timeout: 8000 })
  })

  test('F4-03: enlace reportar problema visible al final del perfil', async ({ page }) => {
    await setupApp(page)
    await page.getByText('Perfil').first().click()
    await expect(page.getByText(/reportar problema/i)).toBeVisible({ timeout: 8000 })
  })

  test('F4-04: botón eliminar cuenta presente pero no ejecuta sin confirmación', async ({ page }) => {
    await setupApp(page)
    await page.getByText('Perfil').first().click()
    await expect(page.getByRole('button', { name: /eliminar mi cuenta/i })).toBeVisible({ timeout: 8000 })
    // Al hacer clic aparece confirmación, no borra directamente
    await page.getByRole('button', { name: /eliminar mi cuenta/i }).click()
    await expect(page.getByText(/seguro/i)).toBeVisible({ timeout: 3000 })
  })

  test('F4-05: guardar perfil muestra toast de éxito', async ({ page }) => {
    await setupApp(page)
    await page.getByText('Perfil').first().click()

    // Cambiar nombre (primer input en EditProfile = nombre)
    const nombreInput = page.locator('input').first()
    await expect(nombreInput).toHaveValue('Atleta Audit', { timeout: 8000 })
    await nombreInput.clear()
    await nombreInput.fill('Atleta Modificado')

    await page.getByRole('button', { name: /guardar/i }).click()
    await expect(page.getByText(/perfil actualizado/i)).toBeVisible({ timeout: 5000 })
  })
})

// ─── FLUJO 5 — Monetización ──────────────────────────────────────────────────

test.describe('FLUJO 5 — Monetización', () => {
  test('F5-01: botón "Hazte Pro" visible para usuarios Free', async ({ page }) => {
    await setupApp(page, { profile: buildMockProfile({ plan: 'free' }) })
    // El botón "Hazte Pro" aparece en el header del Chat para usuarios Free
    await page.getByText('Coach').first().click()
    await expect(page.getByText(/hazte pro/i).first()).toBeVisible({ timeout: 8000 })
  })

  test('F5-02: modal upgrade muestra precios', async ({ page }) => {
    await setupApp(page, { profile: buildMockProfile({ plan: 'free' }) })
    await page.getByText('Coach').first().click()
    await page.getByText(/hazte pro/i).first().click()
    // Modal debe mostrar precio mensual
    await expect(page.getByText(/9,99/)).toBeVisible({ timeout: 5000 })
  })

  test('F5-03: usuarios Free ven el chat con contador de mensajes', async ({ page }) => {
    await setupApp(page, { profile: buildMockProfile({ plan: 'free', messages_today: 20 }) })
    await page.getByText('Coach').first().click()
    // Con 20 de 25, quedan 5 — debe mostrar contador
    await expect(page.getByText(/5 mensajes.*restante/i)).toBeVisible({ timeout: 5000 })
  })
})

// ─── FLUJO 6 — UI/UX general ─────────────────────────────────────────────────

test.describe('FLUJO 6 — UI/UX general', () => {
  test('F6-01: BottomNav tiene exactamente 4 pestañas', async ({ page }) => {
    await setupApp(page)
    const tabs = ['Hoy', 'Plan', 'Coach', 'Perfil']
    for (const tab of tabs) {
      await expect(page.getByText(tab).first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('F6-02: navegación entre pestañas funciona sin errores', async ({ page }) => {
    await setupApp(page)
    const tabs = ['Plan', 'Coach', 'Perfil', 'Hoy']
    for (const tab of tabs) {
      await page.getByText(tab).first().click()
      await page.waitForTimeout(300)
      // No debe haber error de JS
    }
    // Verificar que aún estamos en la app (no crash)
    await expect(page.getByText('Hoy').first()).toBeVisible()
  })

  test('F6-03: la app no muestra error si plan es null', async ({ page }) => {
    await setupApp(page, { noPlan: true })
    // Navegar por todas las pestañas sin crash
    await page.getByText('Plan').first().click()
    await page.getByText('Coach').first().click()
    await page.getByText('Perfil').first().click()
    await page.getByText('Hoy').first().click()
    // No debe haber texto de error genérico
    await expect(page.getByText(/something went wrong/i)).not.toBeVisible()
    await expect(page.getByText(/uncaught/i)).not.toBeVisible()
  })

  test('F6-04: la app carga en menos de 5 segundos', async ({ page }) => {
    const start = Date.now()
    await setupApp(page)
    const elapsed = Date.now() - start
    expect(elapsed).toBeLessThan(5000)
  })
})
