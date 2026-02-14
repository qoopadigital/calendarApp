# 📅 Mi Calendario App

Aplicación móvil de productividad personal construida con Expo y Supabase. Combina un calendario interactivo, lista de tareas y dashboard de bienestar en una sola interfaz.

## 🚀 Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Framework** | [Expo](https://expo.dev) (React Native) + Expo Router |
| **Backend** | [Supabase](https://supabase.com) (PostgreSQL) |
| **Lenguaje** | TypeScript |
| **Calendario** | `react-native-calendars` |
| **Gráficos** | `react-native-svg` (ring charts) |
| **Sliders** | `@react-native-community/slider` |

## ✨ Funcionalidades

### 📅 Calendario de Eventos
- Vista mensual interactiva con puntos indicadores en días con eventos.
- Selección automática del día actual al abrir la app.
- CRUD completo: crear, editar y eliminar eventos.
- Soporte para **horarios**: switch "Todo el día" o rango `HH:MM – HH:MM`.
- Validación de formato y rango horario.
- Eventos ordenados por hora en la lista diaria.

### ☑ To-Do List
- Lista de tareas pendientes por día (filtradas por `completado = false`).
- Crear y editar tareas con modal dedicado.
- Marcar como completada tocando el círculo verde (desaparece de la lista).
- Título truncado a 1 línea con `ellipsizeMode="tail"`.

### 💪 Wellness Dashboard
- Tres tarjetas con **gráficos circulares de progreso** (SVG ring charts):
  - 💧 **Agua** — Meta: 6 L, slider paso 0.5
  - 👣 **Pasos** — Meta: 10,000, slider hasta 20,000
  - 🛌 **Sueño** — Meta: 8 h, slider hasta 24 h
- Toca una tarjeta para ajustar el valor con un **Slider**.
- Bloqueo del scroll mientras se arrastra el slider (sin conflictos de gestos).
- Upsert automático en Supabase (crea o actualiza el registro del día).

## 📁 Estructura del Proyecto

```
├── app/
│   └── (tabs)/
│       └── index.tsx          # Pantalla principal (Calendario + Eventos + To-Do + Wellness)
├── components/
│   └── WellnessCard.tsx       # Tarjeta con ring chart SVG
├── hooks/
│   ├── useEvents.ts           # CRUD de eventos
│   ├── useTodos.ts            # CRUD de tareas
│   └── useWellness.ts         # Fetch/upsert de bienestar diario
├── lib/
│   └── supabase.ts            # Cliente Supabase + tipos (Evento, Todo, DailyWellness)
└── .env                       # EXPO_PUBLIC_SUPABASE_URL, EXPO_PUBLIC_SUPABASE_ANON_KEY
```

## 🗄️ Base de Datos (Supabase)

### Tabla `eventos`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid (PK) | Auto-generado |
| `titulo` | text | Requerido |
| `descripcion` | text | Opcional |
| `fecha` | date | YYYY-MM-DD |
| `user_id` | uuid | Nullable |
| `es_todo_el_dia` | boolean | Default `true` |
| `hora_inicio` | time | HH:MM, nullable |
| `hora_fin` | time | HH:MM, nullable |

### Tabla `todos`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid (PK) | Auto-generado |
| `titulo` | text | Requerido |
| `fecha` | date | YYYY-MM-DD |
| `user_id` | uuid | Nullable |
| `completado` | boolean | Default `false` |

### Tabla `daily_wellness`
| Columna | Tipo | Notas |
|---|---|---|
| `id` | uuid (PK) | Auto-generado |
| `fecha` | date | YYYY-MM-DD |
| `user_id` | uuid | Nullable |
| `agua_litros` | float | 0 – 6 |
| `pasos` | int | 0 – 20,000 |
| `horas_sueno` | float | 0 – 24 |

## 🛠️ Configuración

1. **Instala las dependencias:**
   ```bash
   npm install
   ```

2. **Configura las variables de entorno** — crea `.env` en la raíz:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   ```

3. **Crea las tablas** en Supabase (SQL Editor) con las columnas descritas arriba.

4. **Inicia la app:**
   ```bash
   npx expo start
   ```

## 🎨 Diseño

- Tema minimalista con colores claros (`#F8F9FA` fondo, `#FFFFFF` superficie).
- Acento azul `#4A90D9` para eventos, verde `#10B981` para tareas.
- Wellness: azul 💧, amarillo 👣, morado 🛌.
- Tarjetas con bordes redondeados, sombras suaves y bordes laterales de color.
- Modales con `KeyboardAvoidingView` y validaciones inline.