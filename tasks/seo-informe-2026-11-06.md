# Informe SEO y conversión — 6 noviembre 2026

Objetivo de la sesión: más usuarios y suscripciones Pro vía SEO, landings y conversión.
Datos de partida (GA4 y Search Console, 5-nov): 9 clics y 156 impresiones en 90 días, posición media 16,1, solo 4 URLs conocidas por Google (3 indexadas), 0 eventos clave.

**Limitación de la sesión:** desde el entorno de esta tarea `getricoach.com` devolvía 403 (el proxy no permite el dominio), así que la auditoría se hizo sobre el código del repo y no contra producción. Las conclusiones de indexación son deducciones razonables; compruébalas con "Inspección de URL" en Search Console.

## 1. Hallazgos de la auditoría

1. **Causa probable nº 1 de la mala indexación: 3 de las 9 URLs del sitemap no existían.** Las páginas `maraton-valencia`, `maraton-madrid` y `maraton-barcelona` vivían en `public/`, y como Vite publica con `base: '/app/'` y `outDir: dist/app`, se servían en `/app/maraton-*.html`. El sitemap apuntaba a `/maraton-*` sin redirect, o sea, a 404. Además esas páginas enlazaban a `app.getricoach.com` en vez de a `getricoach.com/app`.
2. **Duplicados `/slug` y `/slug.html`.** Los redirects 200 de `netlify.toml` servían el mismo contenido en las dos URLs; probablemente la "Página con redirección" que ves en Search Console viene de ahí o de la variante con/sin barra de la home.
3. **Canonical de la landing sin barra final** (`https://getricoach.com`) mientras el sitemap decía `/`.
4. **Enlazado interno pobre:** cada guía enlazaba solo a 3-4 de las demás; las de maratón no se enlazaban entre sí con anchor text útil ni desde las demás guías.
5. **Sin `robots.txt`, sin `lastmod`, sin imagen Open Graph** (cualquier enlace compartido en redes salía sin imagen), sin `FAQPage` ni `BreadcrumbList`, sin `hreflang`.
6. **Títulos con año** ("Guía completa 2026", "Maratón Valencia 2026"): caducan y la guía de Valencia quedaba obsoleta (la carrera es en diciembre; un plan de 16 semanas ya no cabe).
7. **Enlaces rotos:** la landing y el login enlazan a `/privacidad` y `/terminos`, que solo existen dentro de la app (`/app/privacidad`).
8. **Landing con datos desfasados:** 9,99 €/mes, 79 €/año, "30 mensajes al día", "4 personalidades" (son 5) y una tabla con precios de competidores no verificables. Corregido en la rama (ver sección 3).
9. **La app no estaba marcada como no indexable** (`/app`).
10. **Pantalla de acceso (`Login.jsx`):** un único botón "Iniciar sesión con Google", sin propuesta de valor ni mención de la prueba de 7 días sin tarjeta (ver backlog).
11. **No hay portal de cliente de Stripe** en el código: el usuario no puede cancelar solo. La FAQ lo dice con honestidad (cancelación por email), pero es una fricción de confianza.

## 2. Cambios ya en `main` (build verde, 256/256 tests)

| Commit | Qué |
|---|---|
| `40dddfc` | Guías de maratón movidas a la raíz; `scripts/build-static.js` (copia landing + todas las guías + `static/` a `dist/`); redirects `/slug.html` → `/slug` (301) y `/slug` → `/slug.html` (200); `/privacidad` y `/terminos` → `/app/...`; cabecera `X-Robots-Tag: noindex, follow` en `/app`; `static/robots.txt` (con `Sitemap:`), `static/llms.txt`, clave IndexNow; sitemap con `lastmod`; títulos evergreen; `BreadcrumbList`, `dateModified`, `author`, `hreflang`; canonical de la landing con barra; Organization JSON-LD; bloque de enlaces a todas las guías en el pie; CTA de maratones a `getricoach.com/app` |
| `9a3d0a0` | 3 guías nuevas: `/plan-entrenamiento-10k`, `/plan-primer-maraton` (maratón para principiantes), `/calculadora-ritmo-maraton` (calculadora interactiva Riegel + parciales cada 5 km). Cada una con title/meta únicos, H1, 1.500+ palabras, FAQ con `FAQPage`, CTA a `/app`, JSON-LD, enlaces internos; añadidas a sitemap, `netlify.toml`, `llms.txt` y la landing |
| `7aa3eec` | Guía `/natacion-para-triatlon` (backlog) y enlace contextual desde las guías de triatlón |
| `b70f0c3` | Imagen Open Graph 1200×630 (`static/og-image.png`) y metas `og:image` / `twitter:card` en todas las páginas |

Nota técnica: el `robots.txt`, el `llms.txt` y la clave IndexNow están en `static/` (no en `public/` como pedía el encargo) porque `public/` se publica bajo `/app/` y esos ficheros tienen que estar en la raíz del dominio. Si añades una guía nueva basta con crear `<slug>.html` en la raíz: el script de build la copia sola; después añádela a `sitemap.xml`, `netlify.toml` (copiar un par de bloques) y `static/llms.txt`.

Palabras por página nueva: 10K ≈ 1.800, primer maratón ≈ 1.500, calculadora ≈ 1.500, natación ≈ 1.600 (incluye FAQ).

## 3. Pendiente de revisar: rama `seo/landing-copy-2026-11-06` (PR #7)

Cambios de copy de conversión de la landing, que no he subido a `main` para que los revises:

- Precios y límites reales verificados en el código: Free 10 mensajes/día, Pro 20 mensajes/día, 14,99 €/mes o 119 €/año, 7 días de prueba Pro sin tarjeta; Strava e Intervals solo con Pro de pago (la FAQ y la tarjeta de precios lo aclaran; la prueba incluye el coach avanzado, pero no Strava).
- CTA principal "Prueba 7 días gratis" y notas de CTA unificadas en todas las guías.
- Comparativa honesta contra "plan genérico" y "coach humano", sin cifras de competidores y reconociendo lo que TriCoach no hace (corregir técnica en persona).
- FAQ ampliada a 12 preguntas (pagos, cancelación, datos, soporte `coach@getricoach.com`) con `FAQPage` JSON-LD; `SoftwareApplication` con las tres ofertas reales.
- `preparar-primer-triatlon`: title/H1/meta orientados a "triatlón para principiantes" (la consulta que ya genera impresiones sin clics).

Revisa especialmente: el texto de cancelación por email (cámbialo si añades portal de Stripe) y que el tono te convence. No hay testimonios, cifras de usuarios ni logos inventados.

## 4. Lo que debes hacer a mano (por orden de impacto)

1. **Search Console:** reenviar `https://getricoach.com/sitemap.xml` y pedir indexación (Inspección de URL) de la home, las 3 guías nuevas, `natacion-para-triatlon` y las 3 de maratón. Comprueba además que la propiedad cubre `https://getricoach.com/` y que `www` y `app.` no están redirigiendo a la home de forma extraña.
2. **Bing Webmaster Tools** (Bing y los asistentes de IA son hoy tu canal): verificar el sitio, enviar el sitemap y enviar las URLs con IndexNow. La clave es `3baca9a4aa25b023b4e6335c85899efd` y el fichero ya está publicado en `https://getricoach.com/3baca9a4aa25b023b4e6335c85899efd.txt`. Envío manual en https://www.bing.com/indexnow.
3. **GA4:** marcar como "eventos clave" `sign_up`, `first_plan_generated`, `begin_checkout` y `upgrade_success` (y `onboarding_complete`). Sin esto sigues viendo 0 conversiones.
4. **Revisar y fusionar el PR #7** (precios y copy reales: ahora mismo la landing en producción sigue diciendo 9,99 €/79 €/30 mensajes, que es incorrecto y puede dar problemas con clientes).
5. Tras el despliegue, comprobar a mano `/robots.txt`, `/sitemap.xml`, `/maraton-valencia` y `/plan-entrenamiento-10k` y que `/plan-media-maraton.html` redirige a `/plan-media-maraton`.
6. Abrir las cuentas de redes y lanzar las campañas de Ads (sección 7).
7. Valorar activar el **Stripe Customer Portal** y enlazarlo desde el perfil.

## 5. Backlog priorizado

1. Fusionar PR #7 y medir (alta).
2. **Pantalla de acceso/onboarding (solo lectura, sin tocar lógica):** en `Login.jsx` añadir bajo el botón de Google una línea "7 días de prueba Pro · sin tarjeta" y tres bullets de valor; hoy el visitante que llega desde un anuncio ve solo un botón de Google. Es el cambio de mayor impacto esperado en conversión. Registrar `begin_checkout` ya existe; medir el paso `/app` → `sign_up`.
3. Más guías de intención alta: "plan de entrenamiento Hyrox por estaciones", "recuperación entre entrenos", "plan de 5K para principiantes", "plan de bici para triatlón", "zonas de frecuencia cardíaca" (ya hay calculadora en la guía de zona 2; valorar página propia).
4. Reescribir las páginas de maratón con contenido más profundo y fechas verificadas con la web oficial de cada carrera (la de Valencia habla de diciembre de 2026 y un plan de 16 semanas, ya no aplicable este año; convertirla en guía evergreen "plan para la próxima edición").
5. Imágenes y fuentes: las páginas cargan Google Fonts con `display=swap`; pueden reducirse a los pesos que se usan y precargar la fuente de titulares para mejorar LCP.
6. Portal de cliente de Stripe y página `/precios` propia (una URL indexable para consultas "precio").
7. Enlaces entrantes: 3-5 directorios de apps de running/triatlón, foros (Foro Triatlón, Strava Clubs en español) y una nota para prensa local.
8. Consolidar los tres `app.getricoach.com` heredados (CLAUDE.md menciona ese subdominio para el callback de Strava; comprobar que el redirect a `getricoach.com/app` no está creando una cadena).

## 6. Material listo para usar: 10 posts

Todos con datos reales (planes, precios, límites). Sin cifras de usuarios ni testimonios.

1. **Instagram (carrusel) — "Tu primer 10K en 8 semanas".** Portada: "De 30 min corriendo a 10 km en 8 semanas". Diapositivas: 1) quién puede empezar, 2) 3-4 días por semana, 3) 80 % rodaje suave, 4) una sesión de calidad, 5) tirada larga progresiva, 6) semana 4 y 8 de descarga, 7) "Plan completo gratis → enlace en bio". Pie: "El plan completo en getricoach.com/plan-entrenamiento-10k. Guárdalo para tu próximo bloque."
2. **TikTok (20 s) — error nº 1 del corredor novato.** Gancho: "Estás corriendo tus rodajes demasiado rápido". Guion: pon el test de la conversación; si no puedes hablar con frases completas, ve más despacio; el 70-80 % de tu volumen debería ser cómodo. Cierre: "Guía de zona 2 en getricoach.com".
3. **LinkedIn — fundador.** "He puesto un entrenador de IA en español para corredores y triatletas. Lo que he aprendido construyéndolo: el plan es lo fácil, lo difícil es adaptarlo cuando la semana real no sale como estaba escrita." Cierra con una pregunta a la comunidad y el enlace a la landing. (Texto a editar por ti: es tu voz.)
4. **Instagram Reel — calculadora de maratón.** Pantalla grabada de la calculadora: metes 50:00 en 10K → predicción 3:50. Texto en pantalla: "¿Cuánto tardarías en un maratón?" Pie: "Pruébala gratis, sin registro: getricoach.com/calculadora-ritmo-maraton".
5. **Instagram (carrusel) — triatlón para principiantes.** "Sprint u olímpico: ¿cuál elegir para tu primer triatlón?". Distancias (750 m / 1.500 m de natación), tiempo de preparación y errores de principiante. CTA a la guía `preparar-primer-triatlon`.
6. **TikTok — test CSS de natación.** "Cómo saber a qué ritmo nadar en 2 minutos de explicación: 400 m, descanso, 200 m, (T400 − T200)/2". Cierra con la guía de natación para triatlón.
7. **Instagram historia (serie de 4) — "Una semana con tu coach IA".** Capturas reales de la app (usa tu propia cuenta): sesión del día, chat, ajuste de plan. Sticker de pregunta "¿Qué le preguntarías a tu entrenador?". Último slide: "7 días de prueba Pro sin tarjeta".
8. **LinkedIn — comparativa honesta.** "¿Coach humano o IA? Lo que cada uno hace mejor": el humano te ve nadar y corrige técnica; la IA responde a las 23:00 y ajusta cada semana. Termina con tu postura y el enlace.
9. **Instagram (carrusel) — errores del primer maratón.** 6 errores (rodajes rápidos, tirada de 40 km, sin fuerza, estrenar zapatillas, no probar avituallamiento, tapering excesivo). CTA a `plan-primer-maraton`.
10. **TikTok / Reel — "Semana de diagnóstico".** Explica que el primer plan es una semana de diagnóstico para medir tu nivel (es lo que hace la app) y que el coach lo ajusta según lo que cuentes. Cierra con "Pruébalo 7 días gratis".

Consejo de calendario: 3 publicaciones por semana durante 4 semanas, un post de cada pilar (educativo, producto, comparativa), y medir clics con parámetros UTM (`?utm_source=instagram&utm_medium=social&utm_campaign=10k`).

## 7. Tres campañas listas para lanzar (no se ha gastado nada)

Los presupuestos son una propuesta para probar, no una previsión de resultados. Empieza con poco, mide altas (`sign_up`) y solo escala lo que convierta. Destino de todos los anuncios: la landing o la guía correspondiente con UTM.

### Campaña A — Google Ads Búsqueda: intención alta de plan de entrenamiento
- **Público:** España (y México si luego quieres abrir mercado), español, móvil y escritorio.
- **Palabras clave (concordancia de frase/exacta):** "plan de entrenamiento 10k", "plan entrenamiento maratón principiantes", "plan primer maratón", "plan entrenamiento media maratón", "plan de entrenamiento triatlón", "triatlón para principiantes", "entrenador personal running online".
- **Negativas:** gratis pdf, ejercicios en casa, trabajo, empleo, curso, universitario.
- **Textos del anuncio (responsive):**
  - Titulares: "Plan de entrenamiento con IA" · "Tu plan se ajusta cada semana" · "Prueba 7 días sin tarjeta" · "Coach IA 100 % en español" · "Para 10K, maratón y triatlón".
  - Descripciones: "Tu entrenador personal con IA: plan semanal a tu nivel, chat para dudas y ajustes según cómo entrenas. Empieza gratis." / "Running, triatlón y Hyrox. Plan gratis para siempre, Pro desde 14,99 €/mes. Cancela cuando quieras."
- **Presupuesto sugerido:** 8-10 €/día durante 2-3 semanas (≈ 150-200 €) para validar clics y coste por alta.
- **Medición:** conversión = `sign_up` de GA4 importada a Google Ads (necesita marcar el evento como clave).

### Campaña B — Meta Ads (Instagram/Facebook): corredores que preparan su primera carrera
- **Público:** 25-50 años, España; intereses: running, maratón, carrera popular, Strava, Garmin, triatlón, Decathlon running. Excluir clientes (lista de usuarios si la subes).
- **Formato:** reel de 15-20 s (la calculadora de maratón o "los 3 errores del novato") y carrusel del plan de 10K.
- **Textos:** primario: "¿Preparas tu primer 10K o tu primer maratón? Tu coach IA te hace el plan y lo ajusta cada semana. 7 días de prueba Pro sin tarjeta." Titular: "Tu plan de entrenamiento con IA". Botón: "Más información". Destino: landing con UTM.
- **Presupuesto sugerido:** 5-8 €/día durante 2 semanas (≈ 70-110 €), un conjunto de anuncios, dos creatividades.

### Campaña C — Retargeting y búsqueda de marca (barata y de alta intención)
- **Público:** visitantes de la web y de las guías en los últimos 30 días que no se han registrado (Meta y Google Display/YouTube), más búsqueda de marca: "tricoach", "tricoach ai", "getricoach".
- **Textos:** "Tu plan de entrenamiento te está esperando: 7 días de prueba Pro sin tarjeta." / "Pregúntale hoy a tu coach IA: plan gratis para siempre."
- **Presupuesto sugerido:** 2-3 €/día de retargeting y 1-2 €/día de marca (≈ 90 €/mes). La búsqueda de marca evita que otro anunciante se coloque sobre ti en "tricoach".
- Necesita el banner de cookies con consentimiento para audiencias de remarketing; el Consent Mode actual ya deniega por defecto.

## 8. Resumen

Se ha corregido lo que más probablemente frenaba la indexación (guías de maratón inexistentes para Google, duplicados y canonical), se han añadido señales para Google, Bing y asistentes de IA (robots, sitemap con fecha, llms.txt, IndexNow, schema), se han publicado cuatro guías nuevas de intención alta y queda en el PR #7 la corrección de precios y el copy de conversión de la landing para tu revisión.
