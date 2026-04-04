# TriCoach AI — Design System

## Direction
Premium Dark Sport. Negro asfalto con acentos naranja de pista. La app debe sentirse como Whoop o Strava Dark — producto de referencia en fitness, no SaaS genérico.

## Feel
Dense pero respirado. Datos prominentes. CTAs que se ganan su espacio. El hero de cada sesión transmite el deporte con el color correcto.

## Signature Element
El fondo del hero dashboard cambia según el deporte del día:
- Correr → naranja `#FF6B2B` (radial, sutil, 15% opacidad)
- Nadar → azul `#0EA5E9`
- Bici → verde `#10B981`
- Fuerza → púrpura `#8B5CF6`

## Tokens

### Colors
```
--background: oklch(0.13 0.01 60)    /* ~#111008 */
--foreground: oklch(0.96 0.01 90)    /* ~#F5F0E8 */
--card:       oklch(0.17 0.01 60)    /* ~#1A1510 */
--secondary:  oklch(0.22 0.02 60)    /* ~#22180E */
--border:     oklch(0.28 0.02 60)    /* ~#3A2E20 */
--primary:    oklch(0.7 0.18 45)     /* ~#FF6B2B */
--muted-foreground: oklch(0.6 0.02 80) /* ~#8A8070 */
--success:    oklch(0.7 0.14 180)    /* ~#10B981 */

/* Sport colors */
--sport-run:      #FF6B2B
--sport-swim:     #0EA5E9
--sport-bike:     #10B981
--sport-strength: #8B5CF6
--sport-rest:     #374151
```

### Typography
```
H1 screen title:  Playfair Display, 28px, bold (700)
H2 section:       Source Sans 3, 18px, semibold (600)
Hero session:     Playfair Display, 32px, bold (700)
Body:             Source Sans 3, 15px, regular (400)
Caption:          Source Sans 3, 13px, opacity 0.6
Data number:      Playfair Display, 32-72px, bold, var(--primary)
Label chip:       Source Sans 3, 11px, uppercase, tracking 0.08em
```

### Spacing scale (base 4px)
```
4 / 8 / 12 / 16 / 24 / 32 / 48
```

### Border radius
```
Cards:   12px
Buttons: 8px (pill: 99px)
Inputs:  8px
Modal:   16px
Chips:   99px
```

### Depth
Surface color shifts only — no dramatic box-shadows.
Elevation:
- Canvas:   var(--background)
- Card:     var(--card)
- Input/interactive: var(--secondary)
- Overlay:  oklch(0 0 0 / 0.6) backdrop

Exception: Primary CTA button uses glow shadow:
`box-shadow: 0 0 32px rgba(255, 107, 43, 0.3)`

### Motion
- Micro interactions: 0.15s ease
- State transitions (hover, focus): 0.2s ease
- Screen enter: 0.3s ease, opacity 0→1 + translateY 8→0
- Skeleton: 1.5s ease-in-out infinite pulse

## Component Patterns

### Session card (WeeklyPlan)
- `border-left: 3px solid <sport-color>` instead of uniform border
- Today: `border-left-width: 4px` + subtle orange tint background
- Completed: `border-left-color: var(--success)`

### Hero card (Dashboard)
- `background: radial-gradient(ellipse at 80% 10%, <sport-color>22 0%, transparent 55%), var(--card)`
- Sport emoji: 96px with `filter: drop-shadow(0 8px 24px <sport-color>66)`
- Complete CTA: full-width, 56px, glow shadow

### Chat bubbles
- Coach: var(--secondary), border var(--border), rounded `4px 18px 18px 18px`
- User: `rgba(255,107,43,0.12)` bg, `rgba(255,107,43,0.2)` border, rounded `18px 18px 4px 18px`

### Metric card
- Label: 11px uppercase tracking
- Number: 32-36px Playfair bold orange
- Subtext: 11px muted

## Rejects → Replacements
| Default | Replacement |
|---------|-------------|
| `select` para RPE | 10 píldoras numeradas táctiles |
| Barra de progreso semanal | Tracker de 7 puntos con iconos |
| Botón "Enviar" texto | Icono SVG con pill circular |
| Mismo fondo en todos los heroes | Sport-color radial gradient |
| Métricas como barras de progreso | Cards en grid 2col con número grande |
