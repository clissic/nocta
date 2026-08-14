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
9. [Convenciones](#convenciones)

---

## Producto y roles

| Rol | Qué puede hacer |
|-----|-----------------|
| **user** | Registro → código email → onboarding (≥ `MIN_PHOTOS` fotos), publicar presencia, Discover, match, chat, follows |
| **admin** | Stats, CRUD locales, promos, listado usuarios, reports |

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
| Admin | `admin@nocta.app` | `Admin1234!` |
| Sofía | `sofia@nocta.app` | `Demo1234!` |
| Mateo | `mateo@nocta.app` | `Demo1234!` |
| Valentina | `valentina@nocta.app` | `Demo1234!` |

Los tres users demo quedan publicados en **Niceto Club** (útiles para probar Discover / match).

Al arrancar la API se resincronizan estas cuentas contra la base: quedan con `emailVerified: true`
y con el password de esta tabla, aunque el seed completo se omita porque la base ya tiene usuarios.

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

> Actualizar esta sección al agregar rutas, modelos, env o cambiar seed/paginación/OAuth.

### Stack API

- Express + Mongoose + Zod + JWT + `jose` + Nodemailer + Multer
- Path: `apps/api`
- Health: `GET /health` → `{ ok, service, db }`
- Estáticos: `GET /uploads/*` (fotos en `apps/api/uploads/`)
- Gates: `requireVerified` / `requireProfileComplete`; `optionalAuth` en perfiles públicos

### Estructura (`apps/api/src`)

```text
config.ts · db.ts · index.ts · seed.ts · seedData.ts
mail/       mailer · templates
middleware/ auth · gates · optionalAuth
models/     User · Follow · Block · Report · Venue · Promotion · Presence · Swipe · Match · Message
oauth/      providers.ts · upsert.ts
routes/     auth · oauth · profile · users · me · venues · presence · discover · matches · admin
uploads/    multer · validate · paths · middleware
utils/      ids · presence · serialize · follows · tokens · matchActions · geocode
```

### Variables de entorno

Ver `apps/api/.env.example`.

| Variable | Uso |
|----------|-----|
| `PORT` | Default `4000` |
| `MONGODB_URI` | URI Atlas (preferido) o `memory` solo demo |
| `MONGODB_DB` | Nombre de base (default `nocta`) |
| `MONGODB_USERNAME` / `MONGODB_PASSWORD` | Credenciales opcionales |
| `MONGODB_RETRIES` | Reintentos al arranque (default `5`) |
| `SEED_ON_EMPTY` | Seed en Atlas si no hay users |
| `JWT_SECRET` | Firma JWT |
| `CLIENT_ORIGIN` / `API_PUBLIC_URL` | CORS + links |
| `SMTP_*` / `MAIL_FROM` / `MAIL_DEV_LOG` | Nodemailer (Gmail App Password) |
| OAuth `GOOGLE_*` / `APPLE_*` / `MICROSOFT_*` | Social login |

### Auth (email + código 6 dígitos)

Flujo: **register → código por mail (15 min) → verify → onboarding**.

| Método | Ruta | Notas |
|--------|------|--------|
| `POST` | `/api/auth/register` | `emailVerified:false` + código; JWT con flag |
| `POST` | `/api/auth/login` | Sin verificar → `403 EMAIL_NOT_VERIFIED` |
| `POST` | `/api/auth/verify-email` | `{ email, code }` o `{ code }` + Bearer |
| `POST` | `/api/auth/resend-verification` | Nuevo código; rate-limit 60s |
| `POST` | `/api/auth/forgot-password` / `reset-password` | Reset por link |

Shared: `EMAIL_VERIFICATION_CODE_LENGTH=6`, `EMAIL_VERIFICATION_TTL_MINUTES=15`, `PASSWORD_HINT`.

Profile PUT/fotos, discover, presence y matches requieren `emailVerified`.

### Profile y fotos

`MIN_PHOTOS=1`, `MAX_PHOTOS=9`, `MIN_AGE=16`; `photos[0]`=avatar. Upload multipart `photo`/`photos` vía `src/uploads/`.

| Método | Ruta |
|--------|------|
| `GET`/`PUT` | `/api/profile` |
| `POST` | `/api/profile/photos` |
| `PATCH` | `/api/profile/photos/reorder` |
| `DELETE` | `/api/profile/photos/:index` |
| `POST` | `/api/profile/password` |

### Follows

| Método | Ruta |
|--------|------|
| `GET` | `/api/users/:id` · `.../followers` · `.../following` |
| `POST`/`DELETE` | `/api/users/:id/follow` |
| `GET` | `/api/me/following` · `/api/me/followers` |
| `POST`/`DELETE` | `/api/venues/:id/follow` |
| `GET` | `/api/venues/:id/followers` |

### Auth social (OAuth) — implementado

Flujo authorization code:

1. `GET /api/auth/oauth/:provider` → redirect al IdP (`google` \| `apple` \| `microsoft`)
2. Callback `GET` (Google/Microsoft) o `POST` (Apple) en `/api/auth/oauth/:provider/callback`
3. Exchange del `code` → perfil → **`upsertOAuthUser`** (`emailVerified: true`)
4. Emite JWT y redirige a `{CLIENT_ORIGIN}/auth/callback?token=...`
5. Error → `{CLIENT_ORIGIN}/login?error=...`

Modelo: `passwordHash` opcional; `oauthAccounts[]` `{ provider, providerUserId }`; `authProvider`.

Código: `src/oauth/providers.ts`, `src/oauth/upsert.ts`, `src/routes/oauth.ts`.

### Profile

Ver sección **Profile y fotos** arriba.
| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/profile` | Usuario autenticado |
| `PUT` | `/api/profile` | Onboarding/edición; acepta `photos: []` durante el alta y completa el perfil al alcanzar `MIN_PHOTOS`; edad ≥ `MIN_AGE` |

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

> Actualizar esta sección al agregar pantallas, assets, flujos UI o cambiar cómo se consume la API.

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
- Pulso `venue-live`, overlay de match y sheets respetan `prefers-reduced-motion`  
- Iconos solo en botones / menús / tabs (nunca en títulos)

Reglas Cursor: `.cursor/rules/nocta.mdc`.

### Rutas UI

| Ruta | Pantalla |
|------|----------|
| `/login` · `/register` | Auth; registro con nombre, confirmación y reglas de contraseña en vivo |
| `/verify-email` | Código de 6 dígitos, pegado OTP y reenvío con cooldown |
| `/auth/callback` | Recibe `?token=` post-OAuth |
| `/onboarding` | Alta/edición en 5 pasos: datos → identidad → búsqueda/gustos → trabajo/bio → upload fotos |
| `/` | Locales: cards visuales 1/2/3 cols, texto sobre degradado, badge/pulso solo en el local con presencia activa |
| `/venues/:id` | Detalle: mobile imagen → info → mapa; tablet/desktop foto + mapa oscuro a la izquierda e info a la derecha |
| `/discover` | Swipe del local activo + overlay de celebración al match (ir al chat / seguir) |
| `/matches` | Lista densa 3 líneas en mobile; grilla 2/3 cols en tablet/desktop; menú eliminar/denunciar/bloquear |
| `/matches/:id` | Chat con avatar en header, hora en burbujas y separadores Hoy/Ayer/fecha |
| `/profile` | Hero + galería a la izquierda / info a la derecha desde tablet; mobile apilado con nombre sobre la foto |
| `/admin` | Panel admin |

### Consumo API

- Cliente: `src/lib/api.ts` (Bearer JWT en `localStorage`; JSON y `FormData`)
- Proxy Vite: `/api` y `/uploads` → `http://localhost:4000`
- Locales: query `page`, `limit`, `type`, `q` + IntersectionObserver para más páginas
- Matches: `DELETE /api/matches/:id`, `POST .../report` (`REPORT_REASONS`), `POST .../block`; lista usa `lastMessage.createdAt`

---

## Shared (`@nocta/shared`)

Tipos y catálogos usados por API y Web:

- `LOOKING_FOR`, `INTERESTS`, `WORK_STATUS`, `GENDERS`, `VENUE_TYPES`, `OAUTH_PROVIDERS`, `REPORT_REASONS` (+ labels donde aplica)  
- `VENUES_PAGE_SIZE` (9), `MIN_PHOTOS`, `MAX_PHOTOS`, `MIN_AGE`, `PRESENCE_PRESETS`
- `PASSWORD_RULES`, `PASSWORD_HINT`, constantes de verificación y upload
- Tipos: `AuthUser`, `Venue`, `PaginationMeta`, `PaginatedVenuesResponse`, `OAuthProvider`, `DiscoverCard`, `MatchSummary`, `ChatMessage`, `ReportReason`, etc.

Tras cambiar shared: `npm run build:shared` (o `postinstall`).

---

## Convenciones

1. **Un solo README** (este). Al cambiar API, pantallas, env, seed o contratos, actualizar [Backend](#backend) y/o [Frontend](#frontend) (y Setup / Shared / Producto si es transversal).  
2. Contratos de API: si cambia un response/query, actualizar la tabla de endpoints **y** adaptar las pantallas que lo consumen en el mismo flujo.  
3. No commitear secretos reales en `.env`; solo `.env.example`.  
4. No inventar rol `owner` ni paneles de dueño hasta que el producto lo pida.  
5. Mantener español en copy de producto y en este README.
