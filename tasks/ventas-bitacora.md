# Bitácora de ventas — TriCoach AI

Registro de lo que se hace en cada sesión del plan `tasks/plan-ventas-2026-11-16.md`. Lo más reciente, arriba. Cada entrada: fecha, qué se hizo (con PR), qué quedó a medias y qué toca después. Solo agregados, sin datos personales.

## 2026-11-27 (viernes; sesión del jueves) — captura de email y 4 páginas nuevas
**Hecho**
- #32: motor B (captura de email). Migración `015` (`suscriptores_plan`, tabla nueva con RLS sin políticas; ya aplicada, no toca datos existentes), functions `suscribir-plan` (público, campo trampa, doble confirmación) y `suscripcion` (confirmar y baja con enlaces firmados), formulario en `plan-entrenamiento-10k` y `preparar-primer-triatlon`, evento GA4 `suscripcion_solicitada`. Tests y sección en `CLAUDE.md`. Ningún cron actual escribe a esta lista.
- #33: 3 guías evergreen (`correr-con-calor`, `escala-rpe-entrenamiento`, `cadencia-al-correr`, ~1.800 palabras, FAQ y JSON-LD) y herramienta `calculadora-hidratos-carrera` (probada en navegador). Redirects, sitemap, `llms.txt` y landing al día.
- 436 tests y build en verde. Sin PRs abiertos al empezar.

**A medias**
- Motor B: falta la secuencia de emails a `confirmado` (usa `secuencia_n`). Al crearla: contar destinatarios, filtrar `estado=eq.confirmado`, enlace de baja `urlAccion('baja', id)`. Hasta entonces quien confirma solo recibe la página de gracias. Además, el formulario está solo en 2 guías: extender al resto cuando la secuencia exista.
- Referidos, envío a clubes y motor C (activación): sin empezar.
- Valencia y Madrid sin fecha verificada; IndexNow sin hacer.

**Siguiente (martes 1-dic)**
- Secuencia de 4 emails en 10 días para `confirmado` (cron con `guardScheduled`) y formulario en más guías.
- Referidos; empezar el envío a clubes (lista revisada en el repo, máx. 15/semana).
- 3 guías + 1 herramienta (ideas: primer 5K en 6 semanas con enfoque de principiante no repetir, dormir y rendimiento, entrenar con lluvia/frío; herramienta: conversor de ritmo y velocidad).

## 2026-11-26 (jueves) — guías, predictor de tiempos y /precios
**Hecho**
- #30: 3 guías evergreen (`maraton-sevilla` con fecha 21-feb-2027 releída en la web oficial y título sin año, `prevenir-lesiones-corredor`, `transiciones-triatlon`; ~2.000 palabras, FAQ y JSON-LD) y herramienta `calculadora-predictor-tiempos-carrera` (Riegel, en el navegador, evento `herramienta_usada`, probada con Playwright). Redirects, sitemap, `llms.txt` y landing al día.
- #31: página `/precios` indexable (Free vs Pro, mensual vs anual, prueba de 7 días, cancelación, FAQ y JSON-LD con ofertas); precios sin tocar; Intervals.icu indicado solo con Pro de pago.
- 425 tests y build en verde. Sin PRs abiertos al empezar.
- Embudo (agregados, desde 26-oct): 3 semanas con 1 alta cada una y 3 la semana del 26-oct; solo 1 de ellas ha marcado una sesión. Con este volumen no hay base estadística para el motor C: el cuello de botella sigue siendo el tráfico.

**A medias**
- Motor B (captura de email + secuencia): no empezado. Necesita tabla nueva en Supabase (migración con copia previa), función `suscribir-plan` con doble confirmación y baja, y contar destinatarios sumando crons.
- Motor C: sin cambios; revisar el recorrido cuando haya más altas o con una prueba manual de extremo a extremo.
- Valencia y Madrid sin fecha verificada; IndexNow sin hacer.
- Despliegue de Netlify: comprobado con la herramienta, deploy actual de `tricoach-v2` en estado `ready`.

**Siguiente (martes 1-dic)**
- Motor B: migración `015` (tabla de suscriptores con token de confirmación y baja), función `suscribir-plan`, formulario en 2 guías y primer email de la secuencia; copia de seguridad antes.
- Referidos (semana 3 del plan).
- 3 guías + 1 herramienta (ideas: primer 10K en 8 semanas con enfoque de principiante, correr con calor, ritmo de recuperación; herramienta: calculadora de calorías/hidratos en carrera).

## 2026-11-24 (martes) — auto-plans, guías y cuenta atrás
**Hecho**
- #29: `auto-plans` genera plan a las Pro de pago y, a las cuentas solo en prueba, únicamente si pasan `cuentasActivas()` (si no se puede leer la actividad, solo Pro de pago); el log añade `dormidas_omitidas`. Decidido y documentado en `CLAUDE.md`.
- #29: 3 guías evergreen (`taper-puesta-a-punto-carrera`, `estrategia-ritmo-carrera`, `calentamiento-antes-de-correr`, 1.500+ palabras, FAQ y JSON-LD) y herramienta `calculadora-cuenta-atras-carrera` (probada en navegador, evento `herramienta_usada`). Redirects, sitemap, `llms.txt` y landing al día; 420 tests y build en verde.
- Sin PRs abiertos al empezar.

**A medias**
- Motor B (captura de email + secuencia): necesita tabla nueva en Supabase (migración con copia previa), función de alta con doble confirmación y baja; no empezado.
- Motor C (revisión del recorrido de activación) y `/precios`: no empezados.
- Valencia y Madrid siguen sin fecha verificada; IndexNow sin hacer.
- No se ha comprobado el despliegue de Netlify desde esta sesión.

**Siguiente (jueves 26)**
- Motor B: diseño y migración de la lista de captura (con copia), función `suscribir-plan` y baja; contar destinatarios antes de la secuencia.
- Motor C: revisar alta → plan → Hoy → marcar sesión y quitar un paso.
- `/precios`; 3 guías + 1 herramienta (ideas: primer 10K en 8 semanas, ritmo de series, predictor de tiempos; Sevilla/Barcelona con fecha de `tasks/carreras-espana.md`).

## 2026-11-19 (jueves) — guías, calculadora y calendario
**Hecho**
- #28: 3 guías evergreen (`entrenamiento-brick-triatlon`, `entrenamiento-series-running`, `semana-de-descarga-entrenamiento`, todas 1.500+ palabras con FAQ y JSON-LD) y herramienta `calculadora-ritmo-natacion-css` (400 m + 200 m, en el navegador, evento `herramienta_usada`, probada en navegador). Redirects, sitemap, `llms.txt` y landing al día; 407 tests y build en verde.
- `tasks/carreras-espana.md`: Sevilla (21-feb-2027) y Barcelona (14-mar-2027) verificadas en su web oficial.
- Sin PRs abiertos al empezar.

**A medias**
- Valencia y Madrid sin fecha verificada (ver `tasks/carreras-espana.md`).
- La tarea del 20-nov (borrar `recuperacion-altas`) sigue programada aparte.
- Aún no hay IndexNow.

**Siguiente (martes 24 / semana 2)**
- Captura de email en guías + secuencia (motor B) y primer arreglo de activación (motor C).
- `/precios`; 3 guías + 1 herramienta (ideas: ritmo de series, cuenta atrás hasta tu carrera; guías de Sevilla y Barcelona con fecha verificada, primer 10K en 8 semanas).
- Decidir `auto-plans` + `cuentasActivas` antes del lunes 23.

## 2026-11-17 (martes) — guías y calculadora
**Hecho**
- #27: 3 guías evergreen (`entrenamiento-fuerza-corredores`, `nutricion-carrera-larga`, `volver-a-entrenar-tras-parar`) y herramienta `calculadora-zonas-pulso` (porcentaje de FC máx. o Karvonen, en el navegador, sin guardar datos). Redirects, sitemap, `llms.txt` y landing al día; 403 tests y build en verde; calculadora probada en navegador.
- Sin PRs abiertos al empezar.

**A medias**
- Calendario de carreras españolas verificado (`tasks/carreras-espana.md`): la búsqueda web solo devolvió listados de terceros, sin fechas de la web oficial. No se apunta ninguna fecha sin verificar; reintentar leyendo las webs oficiales (Valencia, Sevilla, Barcelona, Madrid).
- Borrar `recuperacion-altas` el 20-nov (tarea programada aparte).

**Siguiente (jueves 19)**
- 3 guías evergreen más + 1 herramienta (ideas: ritmo de series, ritmo de natación CSS, cuenta atrás hasta tu carrera; guías: primer Hyrox en pareja/individual no repetir, brick, descarga).
- Calendario de carreras con fechas oficiales.
- Aún no hay IndexNow ni captura de email (semana 2).

## 2026-11-16 (lunes) — arranque
**Hecho**
- Plan de ventas acordado con Lucas y guardado (repo y Project).
- Fusionado #25: los emails de la prueba Pro solo van a cuentas con actividad reciente (corría mañana 17-nov con 27 cuentas dormidas).
- #26: eventos GA4 `session_completed` y `first_session_completed`; contacto de Privacidad → `coach@getricoach.com`; sección del plan en `CLAUDE.md`.
- Tareas programadas: informe semanal (lunes), ejecución del plan (martes y jueves), borrado de `recuperacion-altas` (20-nov).

**Datos del día**
- 51 altas, 7 en 30 días, 1 en 7 días. 3 Pro. 3 activos en chat (7 días).
- Solo 3 usuarios han marcado alguna sesión como hecha. Recuperación: 27 enviados, 0 volvieron.

**Siguiente (martes 17)**
- 3 guías evergreen (vocabulario neutro) + calculadora de zonas de pulso en página propia.
- Empezar el calendario de carreras españolas verificado (`tasks/carreras-espana.md`).

**Pendiente de decidir (se decide en la semana 2)**
- `auto-plans` genera plan a cuentas en prueba que no han vuelto (una generación con el modelo caro por cuenta). Las 27 recuperadas salen de la prueba el 20-nov, así que el lunes 23 ya no entran; aplicar `cuentasActivas` también ahí.
