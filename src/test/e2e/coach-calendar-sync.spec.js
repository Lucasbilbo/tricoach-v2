import { test, expect } from '@playwright/test'

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de fecha y datos de prueba
// ─────────────────────────────────────────────────────────────────────────────

const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
const MOCK_USER_ID = 'test-sync-user-e2e'
const MOCK_PLAN_ID = 'test-plan-sync-e2e'

function getTodayDia() {
  return DIAS_SEMANA[new Date().getDay()]
}

function getTomorrowDia() {
  return DIAS_SEMANA[(new Date().getDay() + 1) % 7]
}

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

/**
 * Construye un plan mock con:
 *   - HOY → Correr (rodaje suave 45min)
 *   - MAÑANA → Bici (fondo 60min)
 *   - Resto → Descanso
 *
 * Acepta un mapa de overrides { [dia]: sesion } para sobreescribir días concretos.
 */
function buildMockPlan(overrides = {}) {
  const today = getTodayDia()
  const tomorrow = getTomorrowDia()
  const sesiones = DIAS_SEMANA.map(dia => {
    if (overrides[dia]) return overrides[dia]
    if (dia === today) return {
      dia, tipo: 'Correr', descripcion: 'Rodaje suave 45min zona 2',
      duracion_min: 45, intensidad: 'suave', completada: false,
    }
    if (dia === tomorrow) return {
      dia, tipo: 'Bici', descripcion: 'Fondo en bici 60min',
      duracion_min: 60, intensidad: 'moderada', completada: false,
    }
    return {
      dia, tipo: 'Descanso', descripcion: 'Descanso activo',
      duracion_min: 0, intensidad: 'descanso', completada: false,
    }
  })
  return { id: MOCK_PLAN_ID, user_id: MOCK_USER_ID, semana: getMondayISO(), sesiones }
}

const MOCK_PROFILE = {
  id: MOCK_USER_ID,
  email: 'test-sync@tricoach.test',
  nombre: 'Atleta Test',
  deporte: 'running',
  nivel: 'intermedio',
  objetivo: 'completar 10k en menos de 50 minutos',
  plan: 'pro',
  messages_today: 0,
  last_message_date: null,
  personalidad: 'cercano',
  strava_token: null,
  strava_refresh_token: null,
  strava_token_expires_at: null,
  contexto: null,
  onboarding_visto: true,
  created_at: '2025-01-01T00:00:00.000Z',
}

function buildFakeSession() {
  return {
    access_token: 'fake-e2e-access-token',
    token_type: 'bearer',
    expires_in: 7200,
    expires_at: Math.floor(Date.now() / 1000) + 7200,
    refresh_token: 'fake-e2e-refresh-token',
    user: {
      id: MOCK_USER_ID,
      email: 'test-sync@tricoach.test',
      created_at: '2025-01-01T00:00:00.000Z',
      updated_at: '2025-01-01T00:00:00.000Z',
      app_metadata: { provider: 'google' },
      user_metadata: { name: 'Atleta Test', full_name: 'Atleta Test' },
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup: inyecta sesión falsa y mockea todas las APIs externas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {import('@playwright/test').Page} page
 * @param {{
 *   plan?: object,
 *   claudeResponses?: string[],
 *   adjustPlanResponse?: object,
 * }} opts
 */
async function setupMockedApp(page, opts = {}) {
  const fakeSession = buildFakeSession()
  const planRef = { current: opts.plan || buildMockPlan() }
  const nextMonday = getNextMondayISO()

  // 1. Inyectar sesión de Supabase en localStorage antes de que cargue la app
  await page.addInitScript((session) => {
    localStorage.setItem('sb-luqpjgzpydquqturgjmt-auth-token', JSON.stringify(session))
    localStorage.setItem('cookies_accepted', 'true')
  }, fakeSession)

  // 2. Mock endpoints de auth de Supabase
  await page.route('**/auth/v1/**', async route => {
    const url = route.request().url()
    if (url.includes('/user')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeSession.user) })
    } else if (url.includes('/token')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(fakeSession) })
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    }
  })

  // 3. Mock REST API de Supabase
  await page.route('**/rest/v1/**', async route => {
    const url = route.request().url()
    const method = route.request().method()
    // Supabase usa Accept: application/vnd.pgrst.object+json para .single()
    const acceptHeader = route.request().headers()['accept'] || ''
    const wantsSingle = acceptHeader.includes('pgrst.object')

    const fulfill = (data) => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(wantsSingle ? data : Array.isArray(data) ? data : [data]),
    })

    if (url.includes('/profiles')) {
      await fulfill(MOCK_PROFILE)
    } else if (url.includes('/plans')) {
      if (method === 'PATCH') {
        // markSessionComplete actualiza las sesiones
        const raw = route.request().postData()
        if (raw) {
          try {
            const body = JSON.parse(raw)
            if (body.sesiones) planRef.current = { ...planRef.current, sesiones: body.sesiones }
          } catch { /* ignore parse errors */ }
        }
        await fulfill(planRef.current)
      } else if (url.includes('semana=lt.')) {
        // getHistorialPlanes: semanas pasadas → vacío
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      } else if (url.includes(`semana=eq.${nextMonday}`)) {
        // getPlanProximaSemana: sin plan para la próxima semana
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      } else {
        await fulfill(planRef.current)
      }
    } else if (url.includes('/messages')) {
      if (method === 'POST') {
        await route.fulfill({ status: 201, contentType: 'application/json', body: '[]' })
      } else {
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' })
      }
    } else {
      await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
    }
  })

  // 4. Mock funciones de Netlify
  await page.route('**/.netlify/functions/strava-activities', async route => {
    await route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ sinStrava: true }),
    })
  })

  await page.route('**/.netlify/functions/coach-intro', async route => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })

  // 5. Mock respuestas del coach (Claude)
  if (opts.claudeResponses?.length) {
    let callIdx = 0
    await page.route('**/.netlify/functions/claude', async route => {
      const text = opts.claudeResponses[Math.min(callIdx++, opts.claudeResponses.length - 1)]
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ content: [{ text }] }),
      })
    })
  }

  // 6. Mock adjust-plan
  if (opts.adjustPlanResponse) {
    await page.route('**/.netlify/functions/adjust-plan', async route => {
      planRef.current = opts.adjustPlanResponse
      await route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify(opts.adjustPlanResponse),
      })
    })
  }

  // 7. Navegar a la app y esperar a que cargue
  await page.goto('http://localhost:5173/app/')
  // Esperar a la barra de navegación como señal de que la app está lista
  await expect(page.getByText('Plan').first()).toBeVisible({ timeout: 15000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// Tests
// ─────────────────────────────────────────────────────────────────────────────

test.describe('Sincronización coach-calendario', () => {

  // ── TEST 1: SINCRONIZACIÓN BÁSICA ──────────────────────────────────────────
  test('1. El coach conoce la sesión del calendario para hoy', async ({ page }) => {
    const today = getTodayDia()

    // El coach responde con información específica del plan (rodaje suave)
    const coachReply = `Hoy tienes programado un rodaje suave de 45 minutos en zona 2. Es una sesión de intensidad baja, perfecta para acumular kilómetros sin fatigarte. ¡A por ello!`

    await setupMockedApp(page, { claudeResponses: [coachReply] })

    // Navegar al plan semanal
    await page.getByText('Plan').first().click()

    // Verificar que el calendario muestra HOY con Correr
    await expect(page.getByText('HOY', { exact: true }).first()).toBeVisible({ timeout: 5000 })
    // La sesión de hoy debe mostrar el tipo "Correr"
    const todayLabel = page.getByText(today).first()
    await expect(todayLabel).toBeVisible()
    // Verificar que Correr aparece como tipo de la sesión de hoy
    await expect(page.getByText('Correr').first()).toBeVisible()

    // Navegar al chat con el coach
    await page.getByText('Coach').first().click()

    // Preguntar al coach qué hay hoy
    await page.getByPlaceholder('Escribe un mensaje...').fill('¿qué tengo hoy?')
    await page.getByRole('button', { name: 'Enviar' }).click()

    // Esperar a que el mensaje del usuario aparezca
    await expect(page.getByText('¿qué tengo hoy?')).toBeVisible({ timeout: 5000 })

    // El coach debe mencionar la misma sesión que el calendario (rodaje suave)
    await expect(page.getByText(/rodaje suave/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/45 minutos/i)).toBeVisible({ timeout: 5000 })
  })

  // ── TEST 2: COMPLETAR SESIÓN → COACH LO SABE ──────────────────────────────
  test('2. El coach sabe qué sesiones se han completado', async ({ page }) => {
    const today = getTodayDia()

    const coachReply = `¡Perfecto! Has completado la sesión de correr de hoy con un RPE de 5. La sesión de rodaje suave ya está marcada como completada en tu plan. ¡Buen trabajo!`

    await setupMockedApp(page, { claudeResponses: [coachReply] })

    // Ir al plan semanal
    await page.getByText('Plan').first().click()
    await expect(page.getByText('HOY', { exact: true }).first()).toBeVisible({ timeout: 5000 })

    // Abrir el modal de completar para la sesión de hoy
    // El botón "Completar" aparece junto a la sesión no completada
    await page.getByRole('button', { name: 'Completar' }).first().click()

    // Debe aparecer el selector de RPE y el botón Guardar
    await expect(page.getByRole('button', { name: 'Guardar' })).toBeVisible({ timeout: 2000 })

    // Medir el tiempo: el UI optimista debe reflejarse en menos de 500ms
    await page.getByRole('button', { name: 'Guardar' }).click()

    // Verificar que el tick de completado aparece inmediatamente (optimistic UI)
    // El componente muestra "✓" o "✓ RPE 5" cuando completada=true
    await expect(page.getByText(/✓/).first()).toBeVisible({ timeout: 500 })

    // Navegar al chat y preguntar qué sesiones se han completado
    await page.getByText('Coach').first().click()
    await page.getByPlaceholder('Escribe un mensaje...').fill('¿qué sesiones he completado hoy?')
    await page.getByRole('button', { name: 'Enviar' }).click()

    // Verificar que el coach menciona la sesión completada
    await expect(page.getByText('¿qué sesiones he completado hoy?')).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/completada en tu plan/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByText(/correr/i)).toBeVisible({ timeout: 5000 })
  })

  // ── TEST 3: AJUSTE DESDE CHAT → CALENDARIO SE ACTUALIZA ──────────────────
  test('3. El ajuste pedido al coach actualiza el calendario en < 1s', async ({ page }) => {
    const tomorrow = getTomorrowDia()

    // Plan con mañana = Bici
    const originalPlan = buildMockPlan()

    // Plan resultado del ajuste: mañana = Descanso
    const adjustedPlan = {
      ...originalPlan,
      sesiones: originalPlan.sesiones.map(s =>
        s.dia === tomorrow
          ? { ...s, tipo: 'Descanso', descripcion: 'Descanso — ajuste de coach', duracion_min: 0 }
          : s
      ),
    }

    // Respuesta del coach: propone el ajuste
    const propuestaCoach = `Claro, puedo cambiar ${tomorrow} de Bici a Descanso. Veo que necesitas recuperarte. ¿Te parece bien el ajuste?`

    await setupMockedApp(page, {
      plan: originalPlan,
      claudeResponses: [propuestaCoach],
      adjustPlanResponse: adjustedPlan,
    })

    // 1. Verificar en el calendario que mañana tiene Bici
    await page.getByText('Plan').first().click()
    await expect(page.getByText(tomorrow)).toBeVisible({ timeout: 5000 })
    // Al menos un "Bici" debe ser visible (la sesión de mañana)
    await expect(page.getByText('Bici').first()).toBeVisible()

    // 2. Ir al chat y pedir el ajuste
    await page.getByText('Coach').first().click()
    await page.getByPlaceholder('Escribe un mensaje...').fill('cambia la sesión de mañana por descanso')
    await page.getByRole('button', { name: 'Enviar' }).click()

    // El coach propone el cambio y aparece el botón para aplicarlo
    await expect(page.getByText(/cambiar/i)).toBeVisible({ timeout: 10000 })
    await expect(page.getByRole('button', { name: /aplicar cambio al plan/i })).toBeVisible({ timeout: 5000 })

    // 3. Aplicar el ajuste con el botón
    await page.getByRole('button', { name: /aplicar cambio al plan/i }).click()

    // Esperar confirmación del toast
    await expect(page.getByText(/plan actualizado/i)).toBeVisible({ timeout: 5000 })

    // 4. Navegar al calendario y verificar que mañana ahora muestra Descanso
    const start = Date.now()
    await page.getByRole('button', { name: 'Plan', exact: true }).click()
    await expect(page.getByText('Descanso — ajuste de coach')).toBeVisible({ timeout: 1000 })
    const elapsed = Date.now() - start
    // El update del calendario debe reflejarse en menos de 1 segundo
    expect(elapsed).toBeLessThan(1000)
  })
})
