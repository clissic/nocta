# Nocta

App de citas acotada a salidas nocturnas: el perfil permanece oculto hasta publicarse en un boliche, bar, pub, cervecería, fiesta privada, concierto o festival. Solo ves (y matcheás) con quienes también se publicaron en ese espacio.

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
| **user** | Registro → código email → onboarding (≥ `MIN_PHOTOS` fotos), publicar presencia, Discover, match, chat, follows, solicitar integración de espacio, gestionar noticias/promos de espacios donde sea `ownerId` |
| **admin** | Panel por secciones: resumen, solicitudes, espacios, contenido (promos/noticias), usuarios y denuncias |

**Organizador de espacio:** no es un rol. Es `Venue.ownerId → User`. Un usuario puede ser organizador de varios espacios; aparecen en su perfil.

Flujo usuario:

1. Auth (email/password u OAuth Google; Apple y Microsoft UI deshabilitadas “próximamente”) → onboarding  
2. Espacios (búsqueda + filtro por tipo + paginación) → publicar presencia  
3. Discover del espacio → like/pass → match → chat  

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
También se renueva su presencia 48h en Niceto y se limpian swipes/matches que las involucren,
para que vuelvan a aparecer en Discover. En el feed, las cuentas demo **saltan el filtro mutuo
de género** (así un user que solo busca mujeres igual puede ver a Mateo al probar).

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
models/     User · Follow · FollowRequest · Block · Report · Venue · VenueNews · VenueRequest · Promotion · PromoPurchase · Presence · Swipe · Match · Message · VenueReview · UserPost · ActivityEvent
oauth/      providers.ts · upsert.ts
routes/     auth · oauth · profile · users · me · venues · muro · presence · discover · matches · admin
uploads/    multer · validate · paths · middleware
utils/      ids · presence · serialize · follows · tokens · matchActions · geocode · venueAccess
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
| `SMTP_*` / `MAIL_FROM` / `MAIL_NOTIFY_TO` / `MAIL_DEV_LOG` | Nodemailer; `MAIL_NOTIFY_TO` recibe solicitudes de Espacios (fallback `SMTP_USER`) |
| OAuth `GOOGLE_*` / `APPLE_*` / `MICROSOFT_*` | Social login |

### Auth (email + código 6 dígitos)

Flujo: **register → código por mail (15 min) → verify → onboarding**.
Los mails de verificación y recuperación usan una plantilla responsive dark de Nocta, con panel amplio, acento lima y código segmentado.

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

`MIN_PHOTOS=1`, `MAX_PHOTOS=10`, `MIN_AGE=16`; `photos[0]`=avatar. Upload multipart `photo`/`photos` vía `src/uploads/`.

| Método | Ruta |
|--------|------|
| `GET`/`PUT` | `/api/profile` |
| `POST` | `/api/profile/photos` |
| `PATCH` | `/api/profile/photos/reorder` |
| `DELETE` | `/api/profile/photos/:index` |
| `POST` | `/api/profile/password` |

### Follows

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/users/:id` · `.../followers` · `.../following` | Público; `isFollowing` / `isFollowRequested` si hay viewer |
| `POST` | `/api/users/:id/follow` | Solicitud de seguimiento (pendiente), o follow inmediato si el target tiene `autoAcceptFollowRequests` |
| `DELETE` | `/api/users/:id/follow` | Cancela solicitud o deja de seguir |
| `GET` | `/api/me/follow-requests` | Solicitudes entrantes pendientes |
| `GET` | `/api/me/follow-requests/:id/profile` | Vista mínima del solicitante (foto, nombre, edad, altura, ubicación y redes) |
| `POST` | `/api/me/follow-requests/:id/accept` · `.../reject` | Aceptar / rechazar |
| `GET` | `/api/me/following` · `/api/me/followers` | Follows aceptados |
| `DELETE` | `/api/me/followers/:id` | Elimina a una persona de mis seguidores |
| `GET` | `/api/me/venues/owned` | Espacios donde soy `ownerId` |
| `GET` | `/api/me/promo-purchases` · `/api/me/promo-purchases/:id` | Promos compradas del usuario (QR) |
| `GET` | `/api/me/reviews` | Mis reseñas (`page`, `limit` default 5, `q` busca por espacio/texto) |
| `PATCH` | `/api/me/settings` | Privacidad: `autoAcceptFollowRequests`, `hideActivityFromFollowers` (parcial; ambos default `false`) |
| `POST`/`DELETE` | `/api/venues/:id/follow` | Follow de Espacios (instantáneo) |
| `GET` | `/api/venues/:id/followers` | |
| `GET` | `/api/users/:id/venues` | Espacios públicos del organizador |

### Auth social (OAuth) — implementado

Flujo authorization code:

1. `GET /api/auth/oauth/:provider` → redirect al IdP (`google` \| `apple` \| `microsoft`)
2. Callback `GET` (Google/Microsoft) o `POST` (Apple) en `/api/auth/oauth/:provider/callback`
3. Exchange del `code` → perfil → **`upsertOAuthUser`** (`emailVerified: true`)
4. Emite JWT y redirige a `{CLIENT_ORIGIN}/auth/callback?token=...`
5. Error → `{CLIENT_ORIGIN}/login?error=...`

En login, los botones de **Apple** y **Microsoft** quedan visualmente deshabilitados y muestran un toast (“se implementará próximamente”); no inician el flujo OAuth. Las rutas backend siguen existiendo para cuando se configuren `APPLE_*` / `MICROSOFT_*`.

Modelo: `passwordHash` opcional; `oauthAccounts[]` `{ provider, providerUserId }`; `authProvider`.

Código: `src/oauth/providers.ts`, `src/oauth/upsert.ts`, `src/routes/oauth.ts`.

### Profile

Ver sección **Profile y fotos** arriba.
| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/profile` | Usuario autenticado |
| `PUT` | `/api/profile` | Onboarding/edición ampliada: ubicación `livesIn: { country, city }` (formato País, Ciudad; la zona horaria de promos se deriva del país, Uruguay = GMT-3 / `America/Montevideo`), orientación, idiomas, zodíaco, educación, mascotas, bebidas, fitness, redes, trabajo (`jobTitle`/`company`/`studiedAt`); `photos: []` durante el alta; edad ≥ `MIN_AGE` |

### Venues, solicitudes, noticias y promociones

| Método | Ruta | Auth | Notas |
|--------|------|------|--------|
| `GET` | `/api/venues` | — | **Paginado** `page`, `limit` (default/máx `VENUES_PAGE_SIZE` = 9), `type`, `q` |
| `GET` | `/api/venues/:id` | — | Venue activo + últimas 3 promos vigentes + últimas 3 noticias + `ratingAvg`/`ratingCount`/`myReview?` |
| `GET` | `/api/venues/admin/all` | admin | Incluye inactivos; cada venue trae `owner` (nombre del organizador) cuando hay `ownerId` |
| `POST` | `/api/venues` | admin | Alta con `ownerId` (usuario rol `user`) obligatorio |
| `PATCH` | `/api/venues/:id` | admin | Edición / toggle `active` / reasignar `ownerId` |
| `DELETE` | `/api/venues/:id` | admin | Soft-delete (`active: false`) |
| `POST` | `/api/venues/requests` | user | multipart: guarda pendiente y envía email interno estilizado con foto adjunta + link de revisión |
| `GET` | `/api/venues/requests/mine` | user | Mis solicitudes |
| `GET` | `/api/venues/geocode/reverse` | user | `?lat=&lng=` → dirección detectada (Nominatim) |
| `POST` | `/api/venues/:id/promotions` | admin o organizador | Alta promo (`title`, `description`, `priceUyu`, `validFrom`/`validUntil` como `YYYY-MM-DD` en zona del perfil) |
| `GET` | `/api/venues/:id/promotions` | admin o organizador | Listado promos (incluye inactivas) |
| `PATCH`/`DELETE` | `/api/venues/:id/promotions/:promoId` | admin o organizador | Editar / soft-delete |
| `GET` | `/api/venues/:id/news` | — / manage | Activas; organizador/admin ven todas |
| `POST` | `/api/venues/:id/news` | admin o organizador | Alta noticia (multipart `photo` obligatorio, 1 imagen) |
| `PATCH`/`DELETE` | `/api/venues/:id/news/:newsId` | admin o organizador | Editar / soft-delete |
| `GET` | `/api/venues/:id/reviews` | — | Reseñas activas paginadas (`page`, `limit`; default `REVIEWS_PAGE_SIZE`) + agregados |
| `POST` | `/api/venues/:id/reviews` | user (perfil completo) | Upsert 1 reseña por user×Espacio (`rating` 1–5, `body?`, fotos 0–3 multipart flexible) |
| `PATCH` | `/api/venues/:id/reviews/:reviewId` | autor | Editar reseña (multipart flexible) |
| `DELETE` | `/api/venues/:id/reviews/:reviewId` | autor o admin | Soft-delete; recalcula promedio y desactiva actividad ligada |
| `GET` | `/api/muro/feed` | user | `{ news, promotions }` de Espacios seguidos + `{ activity, followingUsers? }`. Activity = propia + de personas seguidas (reseñas, follows de Espacios, publicaciones). Omite terceros con `hideActivityFromFollowers`; el autor siempre ve las suyas |
| `POST` | `/api/muro/posts` | user (perfil completo) | Publicación multipart: `venueId` + `body` (1–200) + fotos 0–3 (`photos`). Visible para seguidores y el autor; emite `user_post_created` |

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
| `GET` | `/api/discover/feed` | Deck del `venueId` activo + `likeAllowance`; sin presencia → `400` `NO_PRESENCE` |
| `POST` | `/api/discover/swipe` | `{ toUserId, direction }` → `{ ok, match, likeAllowance }`; sin cuota → `429 LIKES_EXHAUSTED` |
| `POST` | `/api/discover/rewind` | Deshace el último swipe del espacio activo → `{ ok, card?, likeAllowance }` (restaura tarjeta si la persona sigue publicada) |

Lógica del feed:

- Expira presencias vencidas del venue antes de armar el deck
- Candidatos = `Presence.active` mismo venue − yo − ya swipeados
- Orden aleatorio en cada carga del feed
- Filtro blando de género / `interestedIn` si están definidos (excepto si el viewer o el candidato es cuenta demo `*@nocta.app`)
- Limit interno de candidatos ~40
- Usuarios estándar: 50 likes; al consumir el último comienza una recarga de 8h
- Premium: likes ilimitados; los `pass` nunca consumen cuota
- Con cuota agotada, el swipe anima pero no se registra; Discover muestra reloj + overlay con cuenta regresiva

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
| `GET` | `/api/admin/stats` | users, venues activos, presencias, matches, solicitudes pendientes |
| `GET` | `/api/admin/users` | Hasta 100 users (rol `user`) |
| `GET` | `/api/admin/venue-requests` | `?status=` pending/approved/rejected |
| `GET` | `/api/admin/venue-requests/:id` | Detalle para revisión administrativa |
| `POST` | `/api/admin/venue-requests/:id/approve` | Crea venue con `ownerId = requester`, `address` pública y coords del pin; email al solicitante |
| `POST` | `/api/admin/venue-requests/:id/reject` | Rechazo (+ `adminNote` opcional); email al solicitante con el motivo |
| `GET` | `/api/admin/reports` | Listado de denuncias (reporter/reported) |
| `PATCH` | `/api/admin/reports/:id` | Estado open/reviewed/dismissed |
| `PATCH` | `/api/admin/promotions/:id` | Editar promo |
| `DELETE` | `/api/admin/promotions/:id` | Soft-delete promo (`active: false`) |
| `PATCH`/`DELETE` | `/api/admin/news/:id` | Editar / soft-delete noticia |

### Modelos Mongo

| Modelo | Campos clave |
|--------|----------------|
| **User** | email, passwordHash?, role, profile, profileComplete, premium, remainingLikes, likesRechargeAt, oauthAccounts, authProvider, followersCount, followingUsersCount, followingVenuesCount |
| **Venue** | name, type, address, city, description, photos, location?, ownerId?, followersCount, ratingAvg, ratingCount, active |
| **VenueReview** | venueId, userId, rating (1–5), body?, photos (≤3), active — unique `(userId, venueId)` |
| **ActivityEvent** | actorId, type (`venue_review_created`\|`venue_review_updated`\|`venue_followed`\|`user_post_created`), venueId?, reviewId?, postId?, payload, active |
| **UserPost** | authorId, venueId, body (1–200), photos (0–3), active |
| **VenueNews** | venueId, title, body, photos, publishedAt, active |
| **VenueRequest** | requesterId, name, type, address (para mostrar), city (ciudades UY), geocodedAddress?, location?, description?, photos, contactEmail?, contactPhone? (solo admin), status, adminNote?, reviewedBy?, venueId? |
| **Promotion** | venueId, title, description, priceUyu?, validFrom?, validUntil?, active |
| **PromoPurchase** | userId, venueId, promotionId, code, title, priceUyu?, status (`valid`/`redeemed`/`expired`/`refunded`), purchasedAt, validUntil?, redeemedAt? |
| **Follow** | followerId, targetType (`user`\|`venue`), targetId — unique compuesto (solo follows aceptados) |
| **FollowRequest** | fromUserId, toUserId, status (`pending`\|`accepted`\|`rejected`) — unique `(from,to)` |
| **Presence** | userId, venueId, startsAt, endsAt\|null, status (`active`\|`expired`\|`revoked`) |
| **Swipe** | fromUserId, toUserId, venueId, direction — unique `(from,to,venue)` |
| **Match** | users[2] ordenados, venueId — unique `(users, venueId)` |
| **Message** | matchId, senderId, body |

### Seed

`apps/api/src/seedData.ts` (también `npm run seed`):

- Admin + ~15 venues (boliche, bar, pub, cervecería, fiesta, concierto, festival) + promo “Promo Nocta”
- Users demo Sofía / Mateo / Valentina con perfil completo y presencia 48h en **Niceto Club**
- Follows user↔user y de Espacios, 1–2 noticias, reseñas demo + eventos de actividad (para probar el Muro)
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
- [x] Panel admin por secciones (resumen, solicitudes, espacios, contenido, usuarios, denuncias), con sidebar desktop y drawer derecho con logout en mobile/tablet
- [x] Organizador por `ownerId` + solicitudes de integración + noticias (`VenueNews`) + feed Muro (news/promos + actividad social)
- [x] Reseñas de Espacios (`VenueReview`) + publicaciones del Muro (`UserPost`) + timeline de actividad (`ActivityEvent`)
- [ ] Pagos / entradas  
- [ ] Panel organizador dedicado (hoy: API + espacios en perfil; editor completo diferido)  
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
- Tablet/desktop: top nav; grids de espacios; Discover centrado  
- Footer mínimo en `AppLayout` (wordmark + ©; no en login/auth; en mobile solo en `/profile`)  
- Pocas cajas anidadas; animaciones fade sobrias (`fade-in` / `fade-in-up`)  
- Pulso `venue-live`, overlay de match y sheets respetan `prefers-reduced-motion`  
- Iconos solo en botones / menús / tabs (nunca en títulos)

Reglas Cursor: `.cursor/rules/nocta.mdc`.

### Rutas UI

| Ruta | Pantalla |
|------|----------|
| `/login` · `/register` | Auth responsive con escena Nocta animada (Espacios, perfiles y conexiones); en mobile el login queda solo con el panel centrado y wordmark grande; registro con nombre, confirmación y reglas de contraseña en vivo; botones Apple y Microsoft deshabilitados con toast “próximamente” |
| `/verify-email` | Escena de seguridad animada, código de 6 dígitos, pegado OTP y reenvío con cooldown |
| `/auth/callback` | Recibe `?token=` post-OAuth |
| `/onboarding` | Alta/edición en 5 pasos: datos + identidad + ubicación → estilo de vida (orientación, idiomas, zodíaco, etc.) → trabajo → búsqueda (1 opción) + gustos → upload fotos |
| `/` | Muro (home, sin título visual): `container` Bootstrap; burbuja **Mi actividad** (avatar + badge `+`) + avatares de seguidos con scroll horizontal; click en seguido abre perfil mínimo; publicar abre modal (Espacio buscable, texto, ≤3 fotos); desktop `col-lg-4` actividad sticky + `col-lg-8` noticias/promos; mobile/tablet timeline con fade + scroll |
| `/venues` | Espacios: cards visuales 1/2/3 cols, texto sobre degradado, badge/pulso solo en el espacio con presencia activa |
| `/venues/:id` | Detalle: foto + mapa; rating/reseñas (crear/editar con estrellas, texto y 0–3 fotos); últimas 3 promos y noticias; llamada final para seguir el Espacio; tablet/desktop con columna visual e info scrolleable |
| `/venues/:id/manage` | Gestión responsive del organizador: cabecera compacta + seguidores destacados; Noticias (imagen obligatoria) y Promociones (precio UYU + validez desde/hasta; se ocultan solas al vencer); listas publicadas en acordeón con búsqueda; Mercado Pago (próximamente); desde “Mis espacios” en perfil |
| `/muro` | Redirect a `/` |
| `/discover` | Sin presencia: portada animada. Con presencia: tarjeta arrastrable; acciones rewind / pass / like / solicitar follow; sus 10 fotos pueden mostrar Busca, Sobre mí, Gustos, Altura, Trabajo/educación, Vive en, Orientación e idiomas, Zodíaco (rasgos positivos + compatibilidad), Estilo de vida y Redes sociales; botón glass abre con transición el perfil ampliado; al terminar el deck aparece un estado animado con recarga y acceso a Espacios |
| `/matches` | Vacío: portada animada con acceso a Discover y Espacios. Con datos: lista densa 3 líneas en mobile; grilla 2/3 cols en tablet/desktop; menú eliminar/denunciar/bloquear |
| `/matches/:id` | Chat con avatar en header, hora en burbujas y separadores Hoy/Ayer/fecha |
| `/profile` | Hero + galería; acordeón Mis reseñas (búsqueda + paginación de a 5); botón de follow con badge de pendientes → modal de configuración (auto-aceptar follows; ocultar actividad a seguidores; aceptar/rechazar solicitudes); contadores seguidores / seguidos / espacios (seguidos) con modal, búsqueda y últimas 10 (dejar de seguir/eliminar seguidor; al tocar el nombre, perfil reducido); Busca con íconos; Gustos por categorías; “Mis promos” → `/profile/promos`; “Mis espacios” → `/venues/:id/manage`; CTA “Registrar espacio” |
| `/profile/promos` | Mis promos responsive: mobile acordeón + QR; tablet/desktop lista + panel QR sticky; vacío con CTA a Espacios |
| `/profile/venue-request` | Solicitud de espacio: mapa clicable (Uruguay), dirección detectada + para mostrar, foto por upload, contactos opcionales solo admin; al enviar OK → toast de confirmación + redirect a `/profile` |
| `/admin` | Redirect a `/admin/overview` |
| `/admin/overview` | Resumen: KPIs y accesos rápidos |
| `/admin/requests` | Cola de solicitudes (filtros pendiente/aprobada/rechazada) |
| `/admin/venues` | Listado de espacios: organizador por nombre + copiar ID (toast); toggle activo |
| `/admin/venues/new` | Alta de espacio con organizador |
| `/admin/content` | Promos y noticias por espacio (sin prompts) |
| `/admin/users` | Usuarios con búsqueda; foto + badge de perfil; debajo del email Premium (naranja) / Sin premium; modal con ficha completa (perfil ampliado: orientación, idiomas, zodíaco, vive en, trabajo/estudios, estilo de vida, redes) |
| `/admin/reports` | Denuncias abiertas/revisadas/descartadas |
| `/admin/venue-requests/:id` | Revisión Nocta de solicitud: foto, mapa, datos, nota; al aprobar/rechazar se avisa por email al solicitante |

### Consumo API

- Cliente: `src/lib/api.ts` (Bearer JWT en `localStorage`; JSON y `FormData`)
- Feedback de interacción: `ToastProvider` / `useToast()` (toasts Bootstrap; ver `.cursor/rules/toasts.mdc`)
- Proxy Vite: `/api` y `/uploads` → `http://localhost:4000`
- Espacios: query `page`, `limit`, `type`, `q` + IntersectionObserver para más páginas
- Matches: `DELETE /api/matches/:id`, `POST .../report` (`REPORT_REASONS`), `POST .../block`; lista usa `lastMessage.createdAt`

---

## Shared (`@nocta/shared`)

Tipos y catálogos usados por API y Web:

- `LOOKING_FOR`, `INTERESTS`, `INTEREST_CATEGORIES`, `WORK_STATUS`, `GENDERS`, `VENUE_TYPES`, `URUGUAY_CITIES`, `OAUTH_PROVIDERS`, `REPORT_REASONS`, `VENUE_REQUEST_STATUSES` (+ labels donde aplica)  
- `VENUES_PAGE_SIZE` (9), `REVIEWS_PAGE_SIZE`, `MY_REVIEWS_PAGE_SIZE` (5), `MIN/MAX_VENUE_RATING`, `MAX_REVIEW_BODY_LENGTH`, `MAX_REVIEW_PHOTOS` (3), `ACTIVITY_TYPES` (+ labels), `MIN_PHOTOS`, `MAX_PHOTOS`, `MIN_AGE`, `PRESENCE_PRESETS`, `DAILY_LIKE_LIMIT` (50), `LIKE_RECHARGE_HOURS` (8), `DISPLAY_ADDRESS_HINT`
- `PASSWORD_RULES`, `PASSWORD_HINT`, constantes de verificación y upload
- Tipos: `AuthUser` (incl. `autoAcceptFollowRequests`, `hideActivityFromFollowers`), `FollowListUser`, `Venue`, `VenueReview`, `UserPost`, `ActivityItem`, `VenueNews`, `VenueRequest`, `Promotion`, `PromoPurchase`, `MuroFeedResponse`, `PaginationMeta`, `PaginatedVenuesResponse`, `OAuthProvider`, `DiscoverCard`, `LikeAllowance`, `DiscoverFeedResponse`, `DiscoverSwipeResponse`, `MatchSummary`, `ChatMessage`, `AdminStats`, `AdminReport`, etc.  
- Labels: `REPORT_REASON_LABELS`, `REPORT_STATUS_LABELS`, `PROMO_PURCHASE_STATUS_LABELS`, `ACTIVITY_TYPE_LABELS`

Tras cambiar shared: `npm run build:shared` (o `postinstall`).

---

## Convenciones

1. **Un solo README** (este). Al cambiar API, pantallas, env, seed o contratos, actualizar [Backend](#backend) y/o [Frontend](#frontend) (y Setup / Shared / Producto si es transversal).  
2. Contratos de API: si cambia un response/query, actualizar la tabla de endpoints **y** adaptar las pantallas que lo consumen en el mismo flujo.  
3. No commitear secretos reales en `.env`; solo `.env.example`.  
4. Organizador de espacio = `Venue.ownerId` (asignación). No inventar rol `owner`.  
5. Mantener español en copy de producto y en este README.  
6. En UI/copy de producto: **Espacio / Espacios** (no “Local / Locales”). En código pueden seguir `Venue` / `venueId` / `/venues`.
7. Wordmark visual: **siempre** `NoctaWordmark` (`no` + luna lima + `ta`; Syne 800). En copy corrido: **Nocta**. Detalle en `.cursor/rules/wordmark-nocta.mdc`.
8. Quien crea/gestiona un espacio se llama **Organizador** (no “dueño”). En código puede seguir `ownerId`.
9. Feedback de interacción (copiar, guardar, toggles, errores de acción): **siempre** Toast Bootstrap via `useToast()` — no `alert()`.

