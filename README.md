# Nocta

App de citas acotada a salidas nocturnas: el perfil permanece oculto hasta publicarse en un boliche, bar, pub, cervecería, fiesta privada, concierto o festival. Solo ves (y matcheás) con quienes también se publicaron en ese espacio.

> **Documento vivo.** Hay un solo `README.md` en la raíz. Al cambiar APIs, pantallas, env, seed o convenciones, actualizar las secciones Backend y/o Frontend (y Setup / Shared / Producto si es transversal). No crear READMEs duplicados en `apps/*` salvo pedido explícito.

---

## Índice

1. [Producto y roles](#producto-y-roles)
2. [Monorepo](#monorepo)
3. [Setup](#setup)
4. [Credenciales demo](#credenciales-demo)
5. [Scripts](#scripts)
6. [Backend](#backend)
7. [Frontend](#frontend)
8. [Shared](#shared-noctashared)
9. [Convenciones](#convenciones)

---

## Producto y roles

| Rol | Qué puede hacer |
|-----|-----------------|
| **user** | Registro → código email → onboarding (≥ `MIN_PHOTOS` fotos), Espacios, Likes recibidos, publicar presencia, Discover, match, chat, follows, solicitar integración de espacio, gestionar noticias/promos de espacios donde sea `ownerId` |
| **admin** | Panel por secciones: resumen, solicitudes, espacios, contenido (promos/noticias), usuarios y denuncias. Al entrar a `/` se redirige a `/admin/overview` |

**Organizador de espacio:** no es un rol. Es `Venue.ownerId → User`. Un usuario puede ser organizador de varios espacios; aparecen en su perfil.

Flujo usuario:

1. Auth (email/password u OAuth Google; Apple y Microsoft UI deshabilitadas “próximamente”) → onboarding
2. Espacios (búsqueda + filtro por tipo + paginación) → publicar presencia
3. Discover del espacio → like/pass → match → chat
4. Likes: Premium revela fotos y abre ese perfil en Discover; sin Premium las fotos quedan bloqueadas y se ofrecen paquetes

Nav principal (mobile + tablet/desktop): **Espacios → Likes → Discover → Matches → Perfil**.

Regla de negocio: **una sola presencia activa** a la vez; el deck es por `venueId`.

Ciudad piloto: **Montevideo**. El catálogo de seed tiene 98 Espacios reales (bar / pub / boliche / cervecería / concierto) con dirección y coordenadas; ninguno nace con organizador (`ownerId` vacío hasta que Admin asigne o se apruebe el formulario de perfil).

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

Al boot (además del seed en memory / `SEED_ON_EMPTY`): `syncPilotVenues()`, `ensureDemoAccounts()` y `normalizeLookingForSingleChoice()`.

---

## Credenciales demo

| Cuenta | Email | Password | Notas |
|--------|-------|----------|--------|
| Admin | `admin@nocta.app` | `Admin1234!` | Configurable con `ADMIN_EMAIL` / `ADMIN_PASSWORD` |
| Sofía | `sofia@nocta.app` | `Demo1234!` | Premium en seed |
| Mateo | `mateo@nocta.app` | `Demo1234!` | Incluye compra demo de “Promo Nocta” en Jackson Bar |
| Valentina | `valentina@nocta.app` | `Demo1234!` | |

Los tres users demo quedan publicados en **Jackson Bar** (útiles para probar Discover / match). También hay follows demo hacia Malafama y Volvé Mi Negra.

Al arrancar la API se resincronizan estas cuentas contra la base: `emailVerified: true`, password de esta tabla (aunque el seed completo se omita), presencia 48h renovada en Jackson Bar, y limpieza de swipes/matches que las involucren para que vuelvan al Discover. En el feed, **solo** Sofía / Mateo / Valentina (`sofia|mateo|valentina@nocta.app`) saltan el filtro mutuo de género para poder probar.

En login hay atajos visuales para cargar estas cuentas (demo).

---

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm install` | Instala workspaces + build de `@nocta/shared` |
| `npm run dev:api` | API en watch (`tsx`) |
| `npm run dev:web` | Vite (proxy `/api` y `/uploads` → `:4000`) |
| `npm run seed` | Seed admin + venues + demos (`seedDemoData`) |
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
- Gates: `requireVerified` / `requireProfileComplete`; `optionalAuth` en perfiles públicos y detalle de Espacio

### Estructura (`apps/api/src`)

```text
config.ts · db.ts · index.ts · seed.ts · seedData.ts · pilotVenues.ts
mail/       mailer · templates
middleware/ auth · gates · optionalAuth
models/     User · Follow · FollowRequest · Block · Report · Venue · VenueNews · VenueRequest · Promotion · PromoPurchase · Presence · Swipe · Match · Message · VenueReview · UserPost · ActivityEvent
oauth/      providers.ts · upsert.ts
routes/     auth · oauth · profile · users · me · venues · muro · presence · discover · matches · admin
uploads/    multer · validate · paths · middleware
utils/      ids · presence · serialize · follows · tokens · matchActions · geocode · venueAccess · likeAllowance · activity · venueRatings · promoValidity
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
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Cuenta admin del seed (defaults de la tabla demo) |
| `SMTP_*` / `MAIL_FROM` / `MAIL_NOTIFY_TO` / `MAIL_DEV_LOG` | Nodemailer; `MAIL_NOTIFY_TO` recibe solicitudes de Espacios (fallback `SMTP_USER`) |
| OAuth `GOOGLE_*` / `APPLE_*` / `MICROSOFT_*` / `MICROSOFT_TENANT` | Social login (`MICROSOFT_TENANT` default `common`) |

### Auth (email + código 6 dígitos)

Flujo: **register → código por mail (15 min) → verify → onboarding**.
Los mails de verificación y recuperación usan plantilla responsive dark de Nocta (acento lima, código segmentado).

| Método | Ruta | Notas |
|--------|------|--------|
| `POST` | `/api/auth/register` | `emailVerified:false` + código; JWT con flag |
| `POST` | `/api/auth/login` | Sin verificar → `403 EMAIL_NOT_VERIFIED` |
| `GET` | `/api/auth/me` | Usuario del Bearer (sesión) |
| `POST` | `/api/auth/verify-email` | `{ email, code }` o `{ code }` + Bearer |
| `POST` | `/api/auth/resend-verification` | Nuevo código; rate-limit 60s |
| `POST` | `/api/auth/forgot-password` / `reset-password` | Reset por link (API lista; **sin pantalla dedicada en el web aún**) |

Shared: `EMAIL_VERIFICATION_CODE_LENGTH=6`, `EMAIL_VERIFICATION_TTL_MINUTES=15`, `PASSWORD_HINT`.

Discover, presence, matches y varias mutaciones de venues/muro exigen `emailVerified` / perfil completo según gate. **Profile** (`/api/profile*`) hoy usa `requireAuth` (sin `requireVerified` en esas rutas).

### Profile y fotos

`MIN_PHOTOS=1`, `MAX_PHOTOS=10`, `MIN_AGE=16`, `MAX_AGE=99`; `photos[0]`=avatar. Upload multipart `photo`/`photos` vía `src/uploads/`.

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/profile` | Usuario autenticado |
| `PUT` | `/api/profile` | Onboarding/edición: `livesIn: { country, city }`, orientación, idiomas, zodíaco, educación, mascotas, bebidas, fitness, redes, trabajo (`jobTitle`/`company`/`studiedAt`); `lookingFor` **exactamente 1** opción; `photos: []` durante el alta; edad ≥ `MIN_AGE` |
| `POST` | `/api/profile/photos` | Alta fotos |
| `PATCH` | `/api/profile/photos/reorder` | Reordenar |
| `DELETE` | `/api/profile/photos/:index` | Borrar por índice |
| `POST` | `/api/profile/password` | Cambio de password |

La zona horaria de vigencia de promos se deriva del país del perfil (Uruguay = GMT-3 / `America/Montevideo`).

### Follows / me

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/users/:id` · `.../followers` · `.../following` | Público; `isFollowing` / `isFollowRequested` si hay viewer |
| `POST` | `/api/users/:id/follow` | Solicitud (pendiente) o follow inmediato si `autoAcceptFollowRequests` |
| `DELETE` | `/api/users/:id/follow` | Cancela solicitud o deja de seguir |
| `GET` | `/api/me/follow-requests` | Solicitudes entrantes pendientes |
| `GET` | `/api/me/follow-requests/:id/profile` | Vista mínima del solicitante |
| `POST` | `/api/me/follow-requests/:id/accept` · `.../reject` | Aceptar / rechazar |
| `GET` | `/api/me/following` · `/api/me/followers` | Follows aceptados |
| `DELETE` | `/api/me/followers/:id` | Elimina a una persona de mis seguidores |
| `GET` | `/api/me/venues/owned` | Espacios donde soy `ownerId` |
| `GET` | `/api/me/promo-purchases` · `/api/me/promo-purchases/:id` | Promos compradas (QR). **No hay** endpoint de compra/canje en el MVP; las compras demo se crean en seed |
| `GET` | `/api/me/reviews` | Mis reseñas (`page`, `limit` default `MY_REVIEWS_PAGE_SIZE` = 5, `q`) |
| `PATCH` | `/api/me/settings` | `autoAcceptFollowRequests`, `showActivityToFollowers` (parcial; default `true`; legado `hideActivityFromFollowers` se interpreta al leer) |
| `POST`/`DELETE` | `/api/venues/:id/follow` | Follow de Espacios (instantáneo) |
| `GET` | `/api/venues/:id/followers` | Seguidores del Espacio |
| `GET` | `/api/users/:id/venues` | Espacios públicos del organizador |

### Auth social (OAuth)

1. `GET /api/auth/oauth/:provider` → redirect al IdP (`google` \| `apple` \| `microsoft`)
2. Callback `GET` (Google/Microsoft) o `POST` (Apple) en `/api/auth/oauth/:provider/callback`
3. Exchange del `code` → **`upsertOAuthUser`** (`emailVerified: true`)
4. JWT → `{CLIENT_ORIGIN}/auth/callback?token=...`
5. Error → `{CLIENT_ORIGIN}/login?error=...`

En login, Apple y Microsoft están deshabilitados en UI (toast “próximamente”); las rutas backend siguen existiendo.

Modelo: `passwordHash` opcional; `oauthAccounts[]` `{ provider, providerUserId }`; `authProvider`.

### Venues, solicitudes, noticias, reseñas y promociones

| Método | Ruta | Auth | Notas |
|--------|------|------|--------|
| `GET` | `/api/venues` | — | Paginado `page`, `limit` (default/máx `VENUES_PAGE_SIZE` = 9), `type`, `q` |
| `GET` | `/api/venues/:id` | — / optionalAuth | Activo + últimas 3 promos vigentes + 3 noticias + `ratingAvg`/`ratingCount`/`myReview?`/`isFollowing?`/`owner?` |
| `GET` | `/api/venues/admin/all` | admin | Incluye inactivos; `owner` cuando hay `ownerId` |
| `POST` | `/api/venues` | admin | Alta con `ownerId` (rol `user`) obligatorio |
| `PATCH` | `/api/venues/:id` | admin | Edición / `active` / reasignar `ownerId` |
| `DELETE` | `/api/venues/:id` | admin | Soft-delete (`active: false`) |
| `POST` | `/api/venues/requests` | user | multipart; email interno + foto + link de revisión |
| `GET` | `/api/venues/requests/mine` | user | Mis solicitudes |
| `GET` | `/api/venues/geocode/reverse` | user | `?lat=&lng=` → Nominatim |
| `POST` | `/api/venues/:id/promotions` | admin o organizador | `title`, `description`, `priceUyu`, `validFrom`/`validUntil` (`YYYY-MM-DD` en zona del perfil) |
| `GET` | `/api/venues/:id/promotions` | admin o organizador | Listado (incluye inactivas) |
| `PATCH`/`DELETE` | `/api/venues/:id/promotions/:promoId` | admin o organizador | Editar / soft-delete |
| `GET` | `/api/venues/:id/news` | — / manage | Activas; organizador/admin ven todas |
| `POST` | `/api/venues/:id/news` | admin o organizador | multipart `photo` obligatorio (1 imagen) |
| `PATCH`/`DELETE` | `/api/venues/:id/news/:newsId` | admin o organizador | Editar / soft-delete |
| `GET` | `/api/venues/:id/reviews` | — | Paginadas (`REVIEWS_PAGE_SIZE`) + agregados |
| `POST` | `/api/venues/:id/reviews` | user (perfil completo) | Upsert 1 reseña por user×Espacio (`rating` 1–5, `body?`, fotos 0–3) |
| `PATCH` | `/api/venues/:id/reviews/:reviewId` | autor | Editar |
| `DELETE` | `/api/venues/:id/reviews/:reviewId` | autor o admin | Soft-delete + desactiva activity ligada |
| `GET` | `/api/muro/feed` | user | **Legacy / sin UI:** news/promos/activity (API aún montada) |
| `POST` | `/api/muro/posts` | user (perfil completo) | **Legacy / sin UI:** publicaciones `UserPost` |

Respuesta listado público de Espacios:

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

Presets UI: `PRESENCE_PRESETS` — 24h / 48h / 1 semana / permanente.

### Discover / swipe / match

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/discover/feed` | Deck del `venueId` activo + `likeAllowance`; sin presencia → `400` `NO_PRESENCE`. Cards con `isFollowing` / `isFollowRequested`. Acepta `?userId=` para priorizar esa persona si quien consulta es Premium |
| `GET` | `/api/discover/likes` | Likes **recibidos** pendientes. Excluye bloqueados y devuelve `viewerPremium`. Sin Premium **no** envía `user.id`, `name` ni `photo`. Con Premium sí. Cada ítem trae `canRespond` si tenés presencia en ese `venueId` |
| `POST` | `/api/discover/swipe` | `{ toUserId, direction }` → `{ ok, match, likeAllowance }`; sin cuota → `429 LIKES_EXHAUSTED` |
| `POST` | `/api/discover/rewind` | Deshace el último swipe del espacio activo; si era like, borra match+mensajes y `refundLike` → `{ ok, card?, likeAllowance }` |

### Notificaciones

Inbox in-app con polling (sin WebSocket en v1). Campana a la izquierda del Logout (user y admin).

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/notifications` | Lista paginada (`page`, `limit`; default page size 10). Preview campana: `limit=5`. Purga leídas con +30 días |
| `GET` | `/api/notifications/unread-count` | Badge |
| `POST` | `/api/notifications/read` | `{ ids? }` o `{ all: true }` — al leer setea `expiresAt` (+30 días) |

Tipos: like, match, mensaje, follows, actividad de personas seguidas, Espacio (organizador), presencia vencida, likes recargados, solicitud de Espacio resuelta, denuncias (admins + resolución al denunciante), presencia de seguidos (**solo Premium** si el actor tiene `showActivityToFollowers`).

Lógica del feed:

- Expira presencias vencidas del venue antes de armar el deck
- Candidatos = `Presence.active` mismo venue − yo − ya swipeados − **bloqueados**
- Orden aleatorio en cada carga
- Filtro blando de género / `interestedIn` (excepto viewer o candidato demo Sofía/Mateo/Valentina)
- Límite interno de candidatos: **40**
- Usuarios estándar: 50 likes; al consumir el último comienza recarga de 8h
- Premium: likes ilimitados; los `pass` no consumen cuota
- En UI, con cuota agotada el gesto puede animar pero la API responde `429` y no registra el swipe

Match: like mutuo en el mismo `venueId`; par ordenado + índice unique.

### Matches / chat / safety

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/matches` | Summaries (otro user, venue, lastMessage); omite peers bloqueados |
| `GET` | `/api/matches/:id/messages` | Thread (participantes; `403` si bloqueado) |
| `POST` | `/api/matches/:id/messages` | `{ body }` máx 2000 |
| `DELETE` | `/api/matches/:id` | Unmatch / disuelve el match |
| `POST` | `/api/matches/:id/report` | `{ reason, details?, unmatch? }` (`unmatch` default `true`) → crea `Report` |
| `POST` | `/api/matches/:id/block` | Crea `Block` + disuelve **todos** los matches entre el par |

### Admin

Todas bajo `requireAuth` + `requireAdmin`.

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/admin/stats` | users, venues activos, presencias, matches, solicitudes pendientes |
| `GET` | `/api/admin/users` | Hasta 100 users (rol `user`) |
| `GET` | `/api/admin/venue-requests` | `?status=` pending/approved/rejected |
| `GET` | `/api/admin/venue-requests/:id` | Detalle |
| `POST` | `/api/admin/venue-requests/:id/approve` | Crea venue con `ownerId = requester`; email al solicitante |
| `POST` | `/api/admin/venue-requests/:id/reject` | Rechazo (+ `adminNote`?); email al solicitante |
| `GET` | `/api/admin/reports` | Denuncias |
| `PATCH` | `/api/admin/reports/:id` | open/reviewed/dismissed |
| `PATCH`/`DELETE` | `/api/admin/promotions/:id` | Editar / soft-delete promo |
| `PATCH`/`DELETE` | `/api/admin/news/:id` | Editar / soft-delete noticia |

### Modelos Mongo

| Modelo | Campos clave |
|--------|----------------|
| **User** | email, passwordHash?, role, profile, profileComplete, emailVerified, premium, remainingLikes, likesRechargeAt, oauthAccounts, authProvider, followersCount, followingUsersCount, followingVenuesCount, autoAcceptFollowRequests, showActivityToFollowers (legado hideActivityFromFollowers), tokens de verificación/reset |
| **Venue** | name, type, address, city, description, photos, location?, ownerId?, followersCount, ratingAvg, ratingCount, active |
| **VenueReview** | venueId, userId, rating (1–5), body?, photos (≤3), active — unique `(userId, venueId)` |
| **ActivityEvent** | actorId, type (`venue_review_created`\|`venue_review_updated`\|`venue_followed`\|`user_post_created`), venueId?, reviewId?, postId?, payload, active |
| **UserPost** | authorId, venueId, body (1–200), photos (0–3), active |
| **VenueNews** | venueId, title, body, photos, publishedAt, active |
| **VenueRequest** | requesterId, name, type, address, city, geocodedAddress?, location?, description?, photos, contactEmail?, contactPhone?, status, adminNote?, reviewedBy?, venueId? |
| **Promotion** | venueId, title, description, priceUyu?, validFrom?, validUntil?, active |
| **PromoPurchase** | userId, venueId, promotionId, code, title, priceUyu?, status (`valid`/`redeemed`/`expired`/`refunded`), purchasedAt, validUntil?, redeemedAt? |
| **Follow** | followerId, targetType (`user`\|`venue`), targetId — unique compuesto |
| **FollowRequest** | fromUserId, toUserId, status (`pending`\|`accepted`\|`rejected`) — unique `(from,to)` |
| **Block** | blockerId, blockedId — unique; afecta Discover, Matches, Muro, Users |
| **Report** | reporterId, reportedUserId, matchId?, reason, details?, status |
| **Presence** | userId, venueId, startsAt, endsAt\|null, status (`active`\|`expired`\|`revoked`) |
| **Swipe** | fromUserId, toUserId, venueId, direction — unique `(from,to,venue)` |
| **Match** | users[2] ordenados, venueId — unique `(users, venueId)` |
| **Message** | matchId, senderId, body |
| **Notification** | userId, type, title, body?, href?, data, dedupeKey?, readAt, expiresAt (TTL 30 días tras leer) |

### Seed

`apps/api/src/seedData.ts` + `apps/api/src/pilotVenues.ts` (también `npm run seed`):

- Admin + **98 Espacios de Montevideo** (bar, pub, boliche, cervecería, concierto) con calle y pin geocodificado; promo “Promo Nocta” en **Jackson Bar**
- `syncPilotVenues()` en cada boot: borra Espacios que no están en el catálogo (p. ej. Niceto) y hace upsert de los 98 **sin pisar `ownerId`**
- Dirección visible = calle; `location` queda en el catálogo (sin Nominatim en cada boot)
- Fotos de catálogo: la UI lee `apps/web/public/images/venues/{NombreEspacio}Img.webp` (URL `/images/venues/…`) a partir del nombre. Convención: PascalCase sin acentos ni signos + `Img.webp` (`Jackson Bar` → `JacksonBarImg.webp`, `Negroni` → `NegroniImg.webp`). Si falta el archivo, cae al placeholder. Una foto subida a `/uploads/` (organizador) pisa esa portada.
- Users demo Sofía (premium) / Mateo / Valentina con perfil completo y presencia 48h en **Jackson Bar**
- Follows user↔user y de Espacios, noticias, reseñas, eventos de actividad y `PromoPurchase` demo de Mateo
- Auto-ejecución al boot si `MONGODB_URI=memory` (o Atlas vacío con `SEED_ON_EMPTY`)
- En cada boot: `syncPilotVenues` + `ensureDemoAccounts` + normalización de `lookingFor` a 1 opción

### Estado MVP backend (checklist)

- [x] Auth email/password + JWT + `GET /me`
- [x] OAuth Google / Apple / Microsoft (lógica completa; requiere env + Mongo)
- [x] Perfil / onboarding
- [x] Venues CRUD admin + listado público paginado (9) + búsqueda/filtro
- [x] Promociones (CRUD organizador/admin; compras solo seed / listado `me`)
- [x] Presencia (24h / 48h / 1 semana / permanente; una activa)
- [x] Discover + swipe + rewind + match + likes
- [x] Chat por match + unmatch / report / block
- [x] Panel admin por secciones
- [x] Organizador por `ownerId` + solicitudes + noticias
- [x] Reseñas (`VenueReview`) + eventos de actividad (`ActivityEvent`; feed Muro legacy sin UI)
- [x] Pantalla Likes (likes recibidos pendientes)
- [ ] Pagos / entradas / compra-canje de promos por API
- [ ] Panel organizador dedicado (hoy: manage en web + API)
- [ ] Chat realtime (Socket.io) — hoy REST
- [ ] Pantalla web de forgot/reset password

---

## Frontend

> Actualizar esta sección al agregar pantallas, assets, flujos UI o cambiar cómo se consume la API.

### Stack Web

- React 19 + Vite + TypeScript
- Bootstrap 5 + Bootstrap Icons
- Path: `apps/web`
- Estilos tema: `src/theme.css` (dark + lima; anillos de foco de `.btn` en lima, sin flash azul default de Bootstrap)
- Assets: `public/images/` — logos Nocta (`nocta-logo-limaneon-nobg.png`, blanco/negro); fotos de Espacios en `public/images/venues/{Nombre}Img.webp` (listado y detalle las piden por nombre). Si falta el archivo, caen al placeholder. `index.html` puede referenciar favicon

### UX / responsive

- Mobile-first; layouts reales en **mobile / tablet / desktop**
- Mobile: tab bar inferior; UI tipo dating app
- Tablet/desktop: top nav; grids de espacios; Discover centrado
- Footer mínimo (`AppFooter` / wordmark + ©) **solo en `/profile`**, todas las resoluciones
- Admin: top + drawer (mobile/tablet) + sidebar desktop (`AdminLayout`)
- Pocas cajas anidadas; `fade-in` / `fade-in-up`; `prefers-reduced-motion` en pulsos/overlays
- Carga: `NoctaLoading` (luna limaneon como “C” de Cargando, Syne 800, anillos; `screen` / `block` / `inline`)
- Iconos solo en botones / menús / tabs (nunca en títulos). Excepción: `VenueTrustBadge` al lado del nombre del Espacio (estado de organizador, no decoración)
- Feedback de interacción: `useToast()` (ver `.cursor/rules/toasts.mdc`); formularios largos pueden mostrar error inline

Reglas Cursor: `.cursor/rules/nocta.mdc`, `wordmark-nocta.mdc`, `toasts.mdc`, `espacios.mdc`, `fullstack-agent.mdc`.

### Componentes clave (además de páginas)

- Perfil: `ProfileSettingsModal`, `ProfileConnectionsModal`, `ProfileMyReviewsAccordion`, `FollowRequestProfileModal`
- Discover / venues: `DiscoverProfileDetail`, `VenueReviewsSection`, `VenueMap`, `LocationPickerMap`, `VenueTrustBadge`
- Misc: `AuthAtmosphere`, `PromoQrCode`, `PhotoLightbox`, `ToastProvider`, `NoctaWordmark`, `NoctaLoading` (Cargando con luna limaneon + anillos), `AppFooter`, `NotificationsBell`, `PremiumPackagesModal`

### Rutas UI

| Ruta | Pantalla |
|------|----------|
| `/login` · `/register` | Auth con escena Nocta; login con atajos demo + OAuth Google; Apple/Microsoft deshabilitados (toast); registro con nombre, confirmación y reglas de password en vivo |
| `/verify-email` | OTP 6 dígitos, pegado y reenvío con cooldown |
| `/auth/callback` | Recibe `?token=` post-OAuth |
| `/onboarding` | 5 pasos: datos + identidad + ubicación → estilo de vida → trabajo → búsqueda (1) + gustos → fotos |
| `/` | Redirect a `/venues` (user) o `/admin/overview` (admin) |
| `/venues` | Home de usuario. Cards 1/2/3 cols; strip “Publicado” 24h + CTA Discover; ícono verificado si hay `ownerId` (la interrogación “por reclamar” solo en el detalle) |
| `/venues/:id` | Foto + mapa (`col-12` / `col-md-5`); reseñas y CTA (`col-12` / `col-md-7`); ícono de organizador al lado del nombre |
| `/venues/:id/manage` | Organizador: noticias (foto obligatoria), promos (UYU + vigencia), Mercado Pago “próximamente” |
| `/likes` | Likes recibidos pendientes: Premium ve foto/nombre + Discover; sin Premium placeholder (sin name/foto/id) + modal; grilla 2 cols en mobile |
| `/muro` | Redirect a `/venues` (pantalla retirada) |
| `/discover` | Sin presencia: portada. Con presencia: swipe + rewind/pass/like/follow; overlays por foto; expand glass |
| `/matches` | Vacío animado o lista/grilla; menú eliminar / denunciar / bloquear |
| `/matches/:id` | Chat. En desktop (≥992): perfil a la izquierda (carrusel de fotos, datos, bloquear/denunciar al final del scroll) y conversación a la derecha |
| `/notifications` | Inbox completo (10 por página); campana muestra las últimas 5 + Ver más |
| `/profile` | Hero + galería; Mis reseñas; settings; contadores; Mis promos / Mis espacios; **único sitio con footer** |
| `/profile/promos` | Mis promos + QR |
| `/profile/venue-request` | Solicitud de espacio |
| `/admin`… | Igual que antes (overview, requests, venues, content, users, reports) |

### Consumo API

- Cliente: `src/lib/api.ts` (Bearer JWT en `localStorage`; JSON y `FormData`)
- Proxy Vite: `/api` y `/uploads` → `http://localhost:4000`
- Espacios: `page` / `limit` / `type` / `q` + IntersectionObserver
- Matches: `DELETE /api/matches/:id`, `POST .../report`, `POST .../block`
- Chat desktop: `GET /api/users/:id` para galería y datos del perfil en el panel del match
- Scrolls de UI: sin barra visible; sombreado en el extremo si hay más contenido (`OverflowFade`)

---

## Shared (`@nocta/shared`)

Tipos y catálogos usados por API y Web:

- Catálogos: `LOOKING_FOR`, `INTERESTS`, `INTEREST_CATEGORIES`, `WORK_STATUS`, `GENDERS`, `VENUE_TYPES`, `SEXUAL_ORIENTATIONS`, `LANGUAGES`, `ZODIAC_SIGNS`, `EDUCATION_LEVELS`, `PETS`, `DRINKING`, `FITNESS`, `SOCIAL_NETWORKS`, `URUGUAY_CITIES`, `PROFILE_COUNTRIES`, `OAUTH_PROVIDERS`, `REPORT_REASONS`, `VENUE_REQUEST_STATUSES`, `FOLLOW_TARGET_TYPES`, `FOLLOW_REQUEST_STATUSES`, `PROMO_PURCHASE_STATUSES` (+ labels)
- Límites: `VENUES_PAGE_SIZE` (9), `REVIEWS_PAGE_SIZE`, `MY_REVIEWS_PAGE_SIZE` (5), `MIN/MAX_VENUE_RATING`, `MAX_REVIEW_BODY_LENGTH`, `MAX_REVIEW_PHOTOS` (3), `MAX_POST_BODY_LENGTH` (200), `MAX_POST_PHOTOS` (3), `MIN/MAX_PHOTOS`, `MIN/MAX_AGE`, `DAILY_LIKE_LIMIT` (50), `LIKE_RECHARGE_HOURS` (8)
- Actividad: `ACTIVITY_TYPES` + `ACTIVITY_TYPE_LABELS` (incluye `user_post_created`)
- Notificaciones: `NOTIFICATION_TYPES` + `NOTIFICATION_TYPE_LABELS`, `NOTIFICATION_READ_TTL_DAYS` (30), `NOTIFICATIONS_PREVIEW_LIMIT` (5), `NOTIFICATIONS_PAGE_SIZE` (10)
- Presencia: `PRESENCE_PRESETS` (24h / 48h / 1 semana / permanente)
- Zodíaco editorial: `ZODIAC_INSIGHTS`; ciudad default: `DEFAULT_URUGUAY_CITY`; `DISPLAY_ADDRESS_HINT`
- Password / verify / upload: `PASSWORD_RULES`, `PASSWORD_HINT`, constantes de mail y multipart
- Timezone (`timezone.ts`): `timezoneFromCountry`, anclas de día civil para vigencia de promos
- Tipos: `AuthUser`, `FollowListUser`, `FollowRequestItem`, `FollowRequestProfile`, `Venue`, `VenueReview`, `UserPost`, `ActivityItem`, `ReceivedLike`, `ReceivedLikesResponse`, `VenueNews`, `VenueRequest`, `Promotion`, `PromoPurchase`, `MuroFeedResponse`, `PaginationMeta`, `PaginatedVenuesResponse`, `PaginatedReviewsResponse`, `DiscoverCard`, `LikeAllowance`, `DiscoverFeedResponse`, `DiscoverSwipeResponse`, `DiscoverRewindResponse`, `MatchSummary`, `ChatMessage`, `NotificationItem`, `NotificationsResponse`, `NotificationsUnreadResponse`, `AdminStats`, `AdminReport`, etc.

Tras cambiar shared: `npm run build:shared` (o `postinstall`).

---

## Convenciones

1. **Un solo README** (este). Al cambiar API, pantallas, env, seed o contratos, actualizar [Backend](#backend) y/o [Frontend](#frontend) (y Setup / Shared / Producto si aplica).
2. Contratos de API: si cambia un response/query, actualizar la tabla de endpoints **y** adaptar las pantallas que lo consumen en el mismo flujo.
3. No commitear secretos reales en `.env`; solo `.env.example`.
4. Organizador de espacio = `Venue.ownerId` (asignación). No inventar rol `owner`.
5. Mantener español en copy de producto y en este README.
6. En UI/copy de producto: **Espacio / Espacios** (no “Local / Locales”). En código pueden seguir `Venue` / `venueId` / `/venues`.
7. Wordmark visual: **siempre** `NoctaWordmark` (`no` + luna lima + `ta`; Syne 800). En copy corrido: **Nocta**. Detalle en `.cursor/rules/wordmark-nocta.mdc`.
8. Quien crea/gestiona un espacio se llama **Organizador** (no “dueño”). En código puede seguir `ownerId`.
9. Feedback de interacción (copiar, guardar, toggles, errores de acción): **Toast** Bootstrap via `useToast()` — no `alert()`.
10. Un solo agente full-stack puede tocar `apps/api`, `apps/web`, `packages/shared` y este README.
11. Scrolls de UI: barra oculta + sombreado de overflow (`OverflowFade` / `.cursor/rules/scrolls.mdc`). No aplica al scrollbar del documento.
