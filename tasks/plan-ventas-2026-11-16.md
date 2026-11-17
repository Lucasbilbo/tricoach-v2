# Plan de ventas TriCoach AI — nov 2026 a feb 2027 (ejecuta Claude)

Plan vigente. `tasks/plan-ventas.md` queda como histórico del arreglo del embudo de pago. Copia en el Project "Tricoach AI" (`claude/plan-ventas-2026-11-16.md`). El avance se apunta en `tasks/ventas-bitacora.md`.

**Marco decidido por Lucas (16-nov):**
- 0 € de presupuesto (solo orgánico).
- Autonomía total de Claude sobre repo, Netlify y Supabase, con informe semanal.
- Canales: web/SEO, emails a usuarios, redes de la marca, emails a clubes y entrenadores. Foros y Reddit, no.
- Mercado: contenido evergreen, herramientas y redes para todo el español (España + Latinoamérica); guías por carrera y clubes, España primero. Precios sin tocar.

## 1. Punto de partida (producción, 16-nov, solo agregados)

| Métrica | Valor |
|---|---|
| Altas históricas | 51 |
| Altas últimos 30 días / 7 días | 7 / 1 |
| Usuarios con algún plan | 37 |
| Usuarios que han marcado alguna sesión como hecha | 3 |
| Pro | 3 |
| Activos en chat (7 días) | 3 |
| Email de recuperación: enviados / volvieron | 27 / 0 |

Lectura:
- **Problema 1, tráfico:** 1 alta por semana. Sin volumen no hay ventas ni datos para optimizar.
- **Problema 2, uso:** solo 3 personas han marcado alguna vez una sesión. Casi nadie llega a usar el plan. Traer tráfico a un producto que no se usa no vende, así que la activación va en paralelo al tráfico, no después.
- El email de recuperación no recuperó a nadie: los 24 planes nuevos los generó el cron del lunes. Las cuentas dormidas se dan por perdidas; no se les escribe más (PR #24 y #25).
- El embudo de pago, los emails y los crons funcionan.

## 2. Objetivos (metas de trabajo, no previsiones)

| | Hoy | Fin dic | Fin ene | Fin feb |
|---|---|---|---|---|
| Altas/mes | 7 | 25 | 60 | 100 |
| Altas que marcan una sesión en su primera semana | casi 0 | 25 % | 35 % | 40 % |
| Pro de pago | 3 | 5 | 9 | 15 |

Sin presupuesto, el SEO tarda 6-10 semanas en notarse. Enero es el pico en España (propósitos de año nuevo y carreras de primavera); todo lo de noviembre y diciembre se construye para llegar indexado.

**Criterio de corte:** si a 31-ene hay menos de 30 altas/mes, o menos del 20 % de las altas marca una sesión, el plan no está funcionando y se propone a Lucas presupuesto pequeño de búsqueda o replantear el producto.

## 3. Los seis motores

### A. SEO: guías y herramientas (motor principal)
- **Evergreen para todo el español:** planes por distancia y nivel, guías de técnica, fuerza, nutrición en carrera, vuelta tras parón. Vocabulario neutro.
- **Herramientas gratuitas sin registro:** zonas de pulso (página propia), predictor de tiempos, ritmos de series, ritmo de natación (CSS), cuenta atrás "semanas hasta tu carrera".
- **Guías por carrera:** España primero (maratones, medias, triatlones, Hyrox). México como segundo país en enero si los datos muestran altas de allí. Fechas verificadas en la web oficial; títulos sin año.
- **Cadencia:** 3 guías + 1 herramienta por semana. Cada publicación: redirects, sitemap, `llms.txt`, IndexNow, enlace desde la landing, tests en verde.
- **`/precios`** indexable y reescritura evergreen de las tres guías de maratón.

### B. Captura de email antes del registro
"Recibe este plan en tu email" en guías y herramientas (doble confirmación, baja en un clic). Secuencia de 4 emails en 10 días que termina en la prueba Pro.

### C. Activación (que el alta use el plan)
- Eventos `session_completed` y `first_session_completed` (hecho el 16-nov).
- Entender por qué no se marcan sesiones: revisar el recorrido alta → plan → "Hoy" → marcar, y quitar pasos.
- Primer plan visible nada más acabar el onboarding.
- Recordatorio del día de la sesión y secuencia de prueba, solo a cuentas activas.
- Oferta anual de enero (119 €/año) en app y emails.

### D. Redes de la marca (Instagram y TikTok)
3 piezas por semana generadas a partir de las guías y de una cuenta de demostración, programadas en lote. Sirven igual para España y Latinoamérica. **Parado hasta que existan las cuentas con sesión iniciada en el navegador de la app de Claude.**

### E. Clubes y entrenadores (España)
- Lista de clubes de triatlón y running a partir de fuentes públicas.
- 15 emails personalizados por semana desde `coach@getricoach.com` con un mes de Pro para sus socios mediante código. Un solo seguimiento; baja inmediata si la piden.
- Requiere construir antes el envío (función programada que lee una lista revisada del repo) y los códigos de Pro.

### F. Referidos y testimonios
- Referidos: "invita a un compañero y los dos tenéis un mes de Pro".
- Testimonios: email automático a quien complete 2 semanas de sesiones, con permiso de publicación. Ninguno inventado.

## 4. Calendario

**Semana 1 (16-22 nov) — base**
- [x] PRs pendientes fusionados (#20-#25).
- [x] Contacto legal real en Privacidad.
- [x] Eventos de sesión completada.
- [x] Tareas programadas creadas.
- [x] 3 guías evergreen + calculadora de zonas en página propia (#27, 17-nov).
- [ ] Calendario de carreras españolas verificado.
- [ ] 20-nov: borrar `recuperacion-altas`.

**Semana 2 (23-29 nov)**
- Captura de email en guías + secuencia (motor B).
- Revisión del recorrido de activación y primer arreglo (motor C).
- 3 guías + 1 herramienta. `/precios`.

**Semana 3 (30 nov-6 dic)**
- Referidos en producción.
- Envío a clubes construido, lista y primeros 15 emails.
- 3 guías + 1 herramienta.

**Semana 4 (7-13 dic)**
- Email automático de testimonios.
- Primer plan directo tras onboarding.
- Revisión mensual: qué recibe impresiones, qué se repite, qué se corta.

**14 dic-3 ene — preparar enero**
- Guías "empezar en enero": primer 5K, 10K, triatlón, Hyrox, vuelta tras parón.
- Email a la lista y a Free: oferta anual.
- Landing con testimonios reales si los hay.

**Enero — pico.** Ritmo máximo de contenido; segunda ronda a clubes; con más de 50 altas/mes, pruebas de conversión. Decidir México según datos.

**Febrero — decidir.** Revisión contra objetivos y criterio de corte.

## 5. Automatización

| Tarea programada | Cuándo | Qué hace |
|---|---|---|
| Informe semanal de ventas | Lunes 08:47 (Madrid) | Embudo de la semana, qué se publicó, qué cambió en producción, qué toca. El primer lunes de mes, revisión mensual. Es lo único que Lucas tiene que leer. |
| Ejecución del plan | Martes y jueves 07:41 (Madrid) | Lee este plan y la bitácora, hace lo siguiente del calendario (guías, herramientas, motores B-F), publica y apunta en la bitácora. |
| Borrar `recuperacion-altas` | 20-nov, una vez | Quita la función, su bloque en `netlify.toml` y sus tests. |

## 6. Reglas

- Tests y build en verde antes de cada despliegue; un commit por cambio; `CLAUDE.md` al día.
- Nada de cifras de usuarios, testimonios ni afirmaciones de producto inventadas.
- Informes solo con agregados, sin datos personales.
- Todo email con baja en un clic y solo a cuentas activas; antes de crear uno, contar a quién llega sumando todos los crons.
- Sin gasto. Sin tocar precios sin avisar en el informe de esa semana.
- Vigilar el coste de IA por alta (las pruebas Pro usan el modelo caro).
- Copia de seguridad antes de cualquier cambio de datos en producción.

## 7. Lo que Claude no puede hacer solo (una vez, no recurrente)

1. **Redes:** cuentas de Instagram y TikTok de TriCoach con sesión iniciada en el navegador de la app de Claude. Sin ellas, el motor D no arranca.
2. **Buzón `coach@getricoach.com`:** acceso para leer respuestas de clubes. Sin él, las respuestas le llegan a Lucas.
3. **Search Console y GA4:** sesión iniciada en ese navegador. Sin ella, la revisión mensual se hace solo con datos de Supabase y no se sabe de qué país vienen las altas.
4. **Revisión legal con un gestor** (los 10 puntos del PR #12 y vender sin empresa): no es automatizable.
