# Nocta

App de citas acotada a salidas nocturnas: el perfil permanece oculto hasta publicarse en un boliche, bar, pub, cervecería, fiesta privada, concierto o festival. Solo ves (y matcheás) con quienes también se publicaron en ese local.

> **Documento vivo.** Hay un solo `README.md` en la raíz. El agente de **frontend** y el de **backend** deben actualizar la sección que les corresponde cuando cambien APIs, pantallas, env, seed o convenciones. No crear READMEs duplicados en `apps/*` salvo que se pida explícitamente.

---

## Índice

1. [Producto y roles](#producto-y-roles)
2. [Monorepo](#monorepo)
3. [Setup](#setup)
4. [Credenciales demo](#credenciales-demo)
5. [Scripts](#scripts)
6. [Backend](#backend) ← mantener el agente API
7. [Frontend](#frontend) ← mantener el agente Web
8. [Shared](#shared-noctashared)
9. [Convenciones entre agentes](#convenciones-entre-agentes)

---

## Producto y roles

| Rol | Qué puede hacer |
|-----|-----------------|
| **user** | Registro / login, onboarding (≥4 fotos), publicar presencia, Discover (swipe), match, chat |
| **admin** | Stats, CRUD locales, promos, listado usuarios (sin panel owner todavía) |

Flujo usuario:

1. Auth (email/password u OAuth Google/Apple/Microsoft) → onboarding  
2. Locales (búsqueda + filtro por tipo + paginación) → publicar presencia  
3. Discover del local → like/pass → match → chat  

Regla de negocio: **una sola presencia activa** a la vez; el deck es por `venueId`.

---

## Monorepo

```text
nocta/
├── apps/
│   ├── api/          # Express + MongoDB + JWT + OAuth
│   └── web/          # React + Vite + Bootstrap 5
├── packages/
│   └── shared/       # Tipos, enums, constantes compartidas
├── .cursor/rules/    # Reglas Cursor del proyecto
└── README.md         # Este archivo (único)
```

Stack: **MERN** (Mongo, Express, React, Node) + TypeScript + workspaces npm.

---

## Setup

Requisitos: **Node 20+**.

```bash
npm install
cp apps/api/.env.example apps/api/.env
```

Dos terminales:

```bash
npm run dev:api   # http://localhost:4000
npm run dev:web   # http://localhost:5173
```

Por defecto `MONGODB_URI=memory` (Mongo embebido; al arrancar la API corre seed demo).

Mongo real / Atlas:

```env
MONGODB_URI=mongodb+srv://USER:PASS@cluster.../nocta
```

Luego: `npm run seed`.

---

## Credenciales demo

| Cuenta | Email | Password |
|--------|-------|----------|
| Admin | `admin@nocta.app` | `admin123456` |
| Sofía | `sofia@nocta.app` | `demo1234` |
| Mateo | `mateo@nocta.app` | `demo1234` |
| Valentina | `valentina@nocta.app` | `demo1234` |

Los tres users demo quedan publicados en **Niceto Club** (útiles para probar Discover / match).

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm install` | Instala workspaces + build de `@nocta/shared` |
| `npm run dev:api` | API en watch (`tsx`) |
| `npm run dev:web` | Vite (proxy `/api` → `:4000`) |
| `npm run seed` | Seed admin + venues + demos |
| `npm run build` | Build shared → api → web |
| `npm run build:shared` | Solo `packages/shared` |

---

## Backend

> **Dueño:** agente backend. Actualizar esta sección al agregar rutas, modelos, env o cambiar seed/paginación/OAuth.

### Stack API

- Express + Mongoose + Zod + JWT (`jsonwebtoken`) + `jose` (OAuth JWKS / Apple client secret)
- Path: `apps/api`
- Health: `GET /health` → `{ ok, service: "nocta-api" }`
- CORS: `CLIENT_ORIGIN`; body JSON + `urlencoded` (callback Apple `form_post`)
- Auth middleware: `requireAuth` / `requireAdmin` (`src/middleware/auth.ts`)
- Utilidades: `serialize*`, `expireStalePresences`, `isObjectId` / `paramId` / `sortedUserPair`

### Estructura (`apps/api/src`)

```text
config.ts · db.ts · index.ts · seed.ts · seedData.ts
middleware/auth.ts
models/     User · Venue · Promotion · Presence · Swipe · Match · Message
oauth/      providers.ts · upsert.ts
routes/     auth · oauth · profile · venues · presence · discover · matches · admin
utils/      ids · presence · serialize
```

### Variables de entorno

Ver `apps/api/.env.example`.

| Variable | Uso |
|----------|-----|
| `PORT` | Default `4000` |
| `MONGODB_URI` | `memory` (Mongo embebido + auto-seed) o URI local/Atlas |
| `JWT_SECRET` | Firma de tokens (exp. 7d) |
| `CLIENT_ORIGIN` | CORS y redirects FE (`http://localhost:5173`) |
| `API_PUBLIC_URL` | Base pública API para `redirect_uri` OAuth |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Admin del seed |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | OAuth Google |
| `APPLE_CLIENT_ID` / `APPLE_TEAM_ID` / `APPLE_KEY_ID` / `APPLE_PRIVATE_KEY` | OAuth Apple (PEM con `\n`) |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` / `MICROSOFT_TENANT` | OAuth Microsoft (`tenant` default `common`) |

Sin credenciales OAuth, `GET /api/auth/oauth/:provider` responde **503** `{ code: "OAUTH_NOT_CONFIGURED" }`.

Redirect URIs a registrar en cada consola:

`{API_PUBLIC_URL}/api/auth/oauth/{google|apple|microsoft}/callback`

### Auth (email / password)

| Método | Ruta | Notas |
|--------|------|--------|
| `POST` | `/api/auth/register` | Crea user local; JWT |
| `POST` | `/api/auth/login` | Si la cuenta es solo-OAuth (sin `passwordHash`) → 401 con mensaje social |
| `GET` | `/api/auth/me` | Requiere Bearer |

### Auth social (OAuth) — implementado

Flujo authorization code:

1. `GET /api/auth/oauth/:provider` → redirect al IdP (`google` \| `apple` \| `microsoft`)
2. Callback `GET` (Google/Microsoft) o `POST` (Apple) en `/api/auth/oauth/:provider/callback`
3. Exchange del `code` → perfil (`email`, `providerUserId`) → **`upsertOAuthUser`** (crea/vincula en Mongo)
4. Emite JWT y redirige a `{CLIENT_ORIGIN}/auth/callback?token=...`
5. Error → `{CLIENT_ORIGIN}/login?error=...` (incluye fallos de persistencia si Atlas/Mongo no está OK)

Modelo: `passwordHash` opcional; `oauthAccounts[]` `{ provider, providerUserId }`; `authProvider`.

Código: `src/oauth/providers.ts`, `src/oauth/upsert.ts`, `src/routes/oauth.ts`.

### Profile

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/profile` | Usuario autenticado |
| `PUT` | `/api/profile` | Onboarding; Zod + `@nocta/shared`; ≥ `MIN_PHOTOS`; edad ≥ `MIN_AGE` |

### Venues y promociones

| Método | Ruta | Auth | Notas |
|--------|------|------|--------|
| `GET` | `/api/venues` | — | **Paginado** `page`, `limit` (default/máx `VENUES_PAGE_SIZE` = 9), `type`, `q` |
| `GET` | `/api/venues/:id` | — | Venue activo + promos vigentes |
| `GET` | `/api/venues/admin/all` | admin | Incluye inactivos |
| `POST` | `/api/venues` | admin | Alta |
| `PATCH` | `/api/venues/:id` | admin | Edición / toggle `active` |
| `DELETE` | `/api/venues/:id` | admin | Soft-delete (`active: false`) |
| `POST` | `/api/venues/:id/promotions` | admin | Alta promo |
| `GET` | `/api/venues/:id/promotions` | admin | Listado promos del venue |

Respuesta listado público:

```json
{
  "venues": [ /* Venue */ ],
  "pagination": {
    "page": 1,
    "limit": 9,
    "total": 15,
    "totalPages": 2,
    "hasMore": true
  }
}
```

### Presence

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/presence/me` | Presencia activa (o `null`); expira vencidas del user |
| `POST` | `/api/presence` | `{ venueId, hours }` — `hours: null` = permanente; revoca otras activas |
| `DELETE` | `/api/presence/me` | Revoca presencia activa |

Presets de UI: `PRESENCE_PRESETS` en shared (24h / 48h / 1 semana / permanente).

### Discover / swipe / match

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/discover/feed` | Deck del `venueId` de la presencia activa; sin presencia → `400` `NO_PRESENCE` |
| `POST` | `/api/discover/swipe` | `{ toUserId, direction: "like"\|"pass" }` → `{ ok, match }` |

Lógica del feed:

- Expira presencias vencidas del venue antes de armar el deck
- Candidatos = `Presence.active` mismo venue − yo − ya swipeados
- Filtro blando de género / `interestedIn` si están definidos
- Limit interno de candidatos ~40

Match: like mutuo en el mismo `venueId`; par de users ordenado + índice unique.

### Matches / chat

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/matches` | Summaries (otro user, venue, lastMessage) |
| `GET` | `/api/matches/:id/messages` | Thread (solo participantes) |
| `POST` | `/api/matches/:id/messages` | `{ body }` máx 2000 |

### Admin

Todas bajo `requireAuth` + `requireAdmin`.

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/admin/stats` | users, venues activos, presencias activas, matches |
| `GET` | `/api/admin/users` | Hasta 100 users (rol `user`) |
| `PATCH` | `/api/admin/promotions/:id` | Editar promo |
| `DELETE` | `/api/admin/promotions/:id` | Soft-delete promo (`active: false`) |

### Modelos Mongo

| Modelo | Campos clave |
|--------|----------------|
| **User** | email, passwordHash?, role, profile, profileComplete, oauthAccounts, authProvider |
| **Venue** | name, type (`VENUE_TYPES`), address, city, description, photos, active |
| **Promotion** | venueId, title, description, validUntil?, active |
| **Presence** | userId, venueId, startsAt, endsAt\|null, status (`active`\|`expired`\|`revoked`) |
| **Swipe** | fromUserId, toUserId, venueId, direction — unique `(from,to,venue)` |
| **Match** | users[2] ordenados, venueId — unique `(users, venueId)` |
| **Message** | matchId, senderId, body |

### Seed

`apps/api/src/seedData.ts` (también `npm run seed`):

- Admin + ~15 venues (boliche, bar, pub, cervecería, fiesta, concierto, festival) + promo “Promo Nocta”
- Users demo Sofía / Mateo / Valentina con perfil completo y presencia 48h en **Niceto Club**
- Auto-ejecución al boot si `MONGODB_URI=memory`

### Estado MVP backend (checklist)

- [x] Auth email/password + JWT  
- [x] OAuth Google / Apple / Microsoft (lógica completa; requiere env + Mongo para persistir)  
- [x] Perfil / onboarding  
- [x] Venues CRUD admin + listado público paginado (9) + búsqueda/filtro  
- [x] Promociones  
- [x] Presencia (24h / custom / permanente; una activa)  
- [x] Discover + swipe + match  
- [x] Chat por match  
- [x] Panel admin (stats, users, promos)  
- [ ] Pagos / entradas  
- [ ] Rol owner / panel dueño  
- [ ] Chat realtime (Socket.io) — hoy REST  

---

## Frontend

> **Dueño:** agente frontend. Actualizar esta sección al agregar pantallas, assets, flujos UI o cambiar cómo se consume la API.

### Stack Web

- React 19 + Vite + TypeScript  
- Bootstrap 5 + Bootstrap Icons  
- Path: `apps/web`  
- Estilos tema: `src/theme.css`  
- Imágenes estáticas: `public/images/` (favicon: `public/images/favicon.png`)

### UX / responsive

- Mobile-first; layouts reales en **mobile / tablet / desktop**  
- Mobile: tab bar inferior, UI tipo dating app (base para app nativa)  
- Tablet/desktop: top nav; grids de locales; Discover centrado  
- Pocas cajas anidadas; animaciones fade sobrias (`fade-in` / `fade-in-up`)  
- Iconos solo en botones / menús / tabs (nunca en títulos)

Reglas Cursor: `.cursor/rules/nocta.mdc`.

### Rutas UI

| Ruta | Pantalla |
|------|----------|
| `/login` · `/register` | Auth (botones OAuth → API; callback `/auth/callback`) |
| `/auth/callback` | Recibe `?token=` post-OAuth |
| `/onboarding` | Alta/edición perfil (`?edit=1`) |
| `/` | Locales (búsqueda + filtro tipo + infinite scroll) |
| `/venues/:id` | Detalle + publicar presencia |
| `/discover` | Swipe del local activo |
| `/matches` · `/matches/:id` | Lista y chat |
| `/profile` | Perfil |
| `/admin` | Panel admin |

### Consumo API

- Cliente: `src/lib/api.ts` (Bearer JWT en `localStorage`)  
- Proxy Vite: `/api` → `http://localhost:4000`  
- Locales: query `page`, `limit`, `type`, `q` + IntersectionObserver para más páginas

---

## Shared (`@nocta/shared`)

Tipos y catálogos usados por API y Web:

- `LOOKING_FOR`, `INTERESTS`, `WORK_STATUS`, `GENDERS`, `VENUE_TYPES`, `OAUTH_PROVIDERS` (+ labels)  
- `VENUES_PAGE_SIZE` (9), `MIN_PHOTOS`, `MIN_AGE`, `PRESENCE_PRESETS`  
- Tipos: `AuthUser`, `Venue`, `PaginationMeta`, `PaginatedVenuesResponse`, `OAuthProvider`, `DiscoverCard`, `MatchSummary`, etc.

Tras cambiar shared: `npm run build:shared` (o `postinstall`).

---

## Convenciones entre agentes

1. **Un solo README** (este). Frontend edita [Frontend](#frontend); backend edita [Backend](#backend); ambos pueden tocar Setup / Shared / Producto si el cambio es transversal.  
2. Contratos de API: si el backend cambia un response/query, actualizar la tabla de endpoints **y** avisar en Frontend qué pantalla debe adaptarse.  
3. No commitear secretos reales en `.env`; solo `.env.example`.  
4. No inventar rol `owner` ni paneles de dueño hasta que el producto lo pida.  
5. Mantener español en copy de producto y en este README.
