# Bitácora de ventas — TriCoach AI

Registro de lo que se hace en cada sesión del plan `tasks/plan-ventas-2026-11-16.md`. Lo más reciente, arriba. Cada entrada: fecha, qué se hizo (con PR), qué quedó a medias y qué toca después. Solo agregados, sin datos personales.

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
