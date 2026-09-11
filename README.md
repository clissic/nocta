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
7. [Image Service](#image-service)
8. [Frontend](#frontend)
9. [Shared](#shared-noctashared)
10. [Convenciones](#convenciones)

---

## Producto y roles

| Rol | Qué puede hacer |
|-----|-----------------|
| **user** | Registro → código email → onboarding (≥ `MIN_PHOTOS` fotos), Espacios, Likes recibidos, publicar presencia, Discover, match, chat, follows, solicitar integración de espacio, gestionar noticias/promos de espacios donde sea `ownerId` |
| **admin** | Misma experiencia de app que un usuario (Espacios, Discover, etc.) y además acceso al **Panel** desde el menú de cuenta. Al entrar a `/` se redirige a `/venues` |

**Organizador de espacio:** no es un rol. Es `Venue.ownerId → User`. Un usuario puede ser organizador de varios espacios; aparecen en su perfil.

Flujo usuario:

1. Auth (email/password u OAuth Google; Apple y Microsoft UI deshabilitadas “próximamente”) → onboarding
2. Espacios (búsqueda + filtro por tipo + paginación) → publicar presencia
3. Discover del espacio → like/pass → match → chat
4. Likes: plan **4 AM+** (`see_likes`) revela fotos y abre ese perfil en Discover; free / 2 AM las fotos quedan bloqueadas y se ofrecen paquetes

Nav principal (mobile + tablet/desktop): **Espacios → Likes → Discover → Matches → Perfil**.

Regla de negocio: **una sola presencia activa** por defecto; con **Clone (6 A.M.)** hasta **3** Espacios a la vez. El deck de Discover es por `venueId`.

Ciudad piloto: **Montevideo**. El catálogo de seed tiene 113 Espacios reales (bar / pub / boliche / cervecería / concierto) con dirección y coordenadas; ninguno nace con organizador (`ownerId` vacío hasta que Admin asigne o se apruebe el formulario de perfil).

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
cp apps/web/.env.example apps/web/.env.local
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
| Sofía | `sofia@nocta.app` | `Demo1234!` | Premium **2 AM** en seed |
| Mateo | `mateo@nocta.app` | `Demo1234!` | Premium **4 AM** + compra demo de “Promo Nocta” en Jackson Bar |
| Valentina | `valentina@nocta.app` | `Demo1234!` | Premium **6 AM** (Espía + Clone) |

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
| `npm run migrate:images` | Migrar imágenes legacy → Image Service (`--preview`/`DRY_RUN=1`; real exige credenciales Railway) |
| `npm run validate:images` | Validar ledger + Object Storage post-migración |
| `npm run repair:images-memory` | Restaurar refs si una migrate corrió con storage memory (`--execute`) |
| `npm run cleanup:images` | Inventario de huérfanos (default dry-run; borrado solo con `--execute`) |
| `npm run diagnose:images` | Diagnóstico Image Service (siempre dry-run; 6 categorías; sin deletes) |
| `npm run purge:deleted-accounts` | Purga cuentas tras 30 días + identity TTL (`--dry-run`) |
| `npm run build` | Build shared → api → web |
| `npm run build:shared` | Solo `packages/shared` |

---

## Backend

> Actualizar esta sección al agregar rutas, modelos, env o cambiar seed/paginación/OAuth.

### Stack API

- Express + Mongoose + Zod + JWT + `jose` + Nodemailer / Resend + Multer
- Path: `apps/api`
- Health: `GET /health` → `{ ok, service, db }`
- Estáticos legacy: `GET /uploads/*` (solo fotos antiguas en disco `apps/api/uploads/`)
- Imágenes **nuevas** públicas: el browser las pide al Object Storage (CDN o URL firmada), no al pipeline de bytes de Express
- Gates: `requireVerified` / `requireProfileComplete`; perfiles requieren autenticación y detalle de Espacio admite `optionalAuth`

### Estructura (`apps/api/src`)

```text
config.ts · db.ts · index.ts · seed.ts · seedData.ts · pilotVenues.ts
models/     User · Venue · Presence · Swipe · Match · Message · Follow · …
image-service/  registry · ingest · Sharp · delivery · privateAccess
image-lifecycle/  inventory · migrate · cleanup · diagnose · accountDeletion
storage/    Railway / memory Object Storage
middleware/ auth · gates · imageRateLimit
uploads/    multer temp (legacy bridge) · validate
mail/       mailer · templates
middleware/ auth · gates · optionalAuth
models/     User · Follow · FollowRequest · Block · Report · Venue · VenueNews · VenueRequest · Promotion · PromoPurchase · Presence · Swipe · Match · Message · VenueReview · UserPost · ActivityEvent · ImageAsset
oauth/      providers.ts · upsert.ts
routes/     auth · oauth · profile · users · me · venues · muro · presence · discover · matches · admin · media (302 fallback)
uploads/    multer · validate · paths · middleware  (legado; sigue sirviendo `/uploads`)
storage/    abstracción Object Storage (Railway Buckets S3-compat; memory en local/tests)
image-service/  registry · Sharp · ingest · resolveDelivery (URL directa CDN/firmada)
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
| `CLIENT_ORIGIN` | CORS + redirects OAuth (URL del web, p. ej. Railway) |
| `API_PUBLIC_URL` | Base pública de la API; absolutiza `/uploads/` legacy en JSON |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Cuenta admin del seed (defaults de la tabla demo) |
| `MAIL_TRANSPORT` | `auto` (default) \| `smtp` \| `resend` — `smtp` fuerza Gmail aunque exista `RESEND_API_KEY` |
| `RESEND_API_KEY` | Mail vía Resend (HTTPS). En `auto` tiene prioridad; sin dominio solo envía al mail de la cuenta Resend |
| `SMTP_*` / `MAIL_FROM` / `MAIL_NOTIFY_TO` / `MAIL_DEV_LOG` | Nodemailer (DNS IPv4); `MAIL_NOTIFY_TO` recibe solicitudes de Espacios (fallback `SMTP_USER`) |
| OAuth `GOOGLE_*` / `APPLE_*` / `MICROSOFT_*` / `MICROSOFT_TENANT` | Social login (`MICROSOFT_TENANT` default `common`) |
| `STORAGE_DRIVER` | `auto` (default) \| `railway` \| `memory` — Object Storage |
| `STORAGE_PUBLIC_BASE_URL` | Base CDN/custom delante del bucket (opcional; sin esto las públicas salen firmadas al bucket) |
| `STORAGE_SIGNED_URL_TTL_SECONDS` | TTL de URLs firmadas (default `3600`) |
| `AWS_ENDPOINT_URL` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_BUCKET_NAME` / `AWS_DEFAULT_REGION` / `AWS_S3_URL_STYLE` | Credenciales Railway Bucket (preset AWS SDK). También acepta `ENDPOINT`/`BUCKET`/`ACCESS_KEY_ID`/`SECRET_ACCESS_KEY`/`REGION` o prefijo `STORAGE_*` |

**Object Storage / Image Service (Fase 1–8):** ver sección dedicada [Image Service](#image-service). Resumen: Sharp + Railway Object Storage; públicos sin original permanente; Express no sirve bytes de imágenes managed nuevas; identity PRIVATE/SENSITIVE; `OptimizedImage` en FE; `/uploads` solo legacy.
- Tests: `npm run test -w @nocta/api` · `npm run test:e2e -w @nocta/api` · `npm run test -w @nocta/web`.

### Image Service

Arquitectura final (browser → Object Storage; API solo orquesta):

```
Upload multipart → multer temp → validate (MIME real, size, dims, bombs)
  → Sharp (variants_v1 | identity_raw | evidence_raw)
  → Railway Object Storage (keys public/… o private/…)
  → ImageAsset en Mongo (metadata + refs; NUNCA binarios)
  → JSON al cliente con URL CDN/firmada
  → OptimizedImage (<picture> AVIF/WebP + srcset + lazy)
```

**Verdades de diseño (explícitas):**

1. MongoDB **nunca** almacena binarios de imagen (solo refs `/api/media/{id}`, paths legacy o imageIds privados).
2. Los **originales públicos no se almacenan** de forma permanente (solo variantes WebP/AVIF).
3. Express **no sirve** bytes de imágenes públicas managed nuevas (`GET /api/media/:id` = 302 a Storage). **`/uploads` es legacy read-only** (telemetría `[legacy-uploads]`; writes → 405).
4. **Railway Object Storage** es el storage actual (`STORAGE_DRIVER=railway|auto|memory`).
5. **identity_verification** es PRIVATE/SENSITIVE (`admin_signed`, TTL 180d; no Discover/perfiles/JSON público). Staging multer en `tmp/upload-staging`, no en `private/`.
6. **`OptimizedImage`** es el componente público genérico del FE.
7. **`/uploads` ya no acepta almacenamiento permanente nuevo** (Fase 11). Corpus residual + FE compat hasta cleanup confirmado.

#### ImageTypes

| Tipo | Visibility | Processing | Access | Retention |
|------|------------|------------|--------|-----------|
| `user_profile` | public | `variants_v1` | `public_cdn_or_signed` | owner_lifetime |
| `space` | public | `variants_v1` | `public_cdn_or_signed` | owner_lifetime |
| `space_news` / `space_promotion` | public | `variants_v1` | `public_cdn_or_signed` | owner_lifetime |
| `space_request` | public | `variants_v1` | `public_cdn_or_signed` | ttl 90d |
| `review` | public | `variants_v1` | `public_cdn_or_signed` | owner_lifetime |
| `user_post` | public | `variants_v1` | `public_cdn_or_signed` | owner_lifetime |
| `identity_verification` | private/SENSITIVE | `identity_raw` | `admin_signed` | ttl 180d |
| `claim_evidence` | private | `evidence_raw` | `owner_or_admin_signed` | ttl 365d |
| `report_evidence` | private | `evidence_raw` | `owner_or_admin_signed` | ttl 365d |

Registry: `apps/api/src/image-service/registry.ts`.

#### Processing / Storage / Access

- **variants_v1:** thumb/medium/large × webp/avif; `rotate()` + re-encode (sin EXIF/GPS); sin upscale; sin original.
- **identity_raw / evidence_raw:** JPEG/PDF privado; sin variantes públicas; sin URL CDN.
- **Cache Storage:** públicos `Cache-Control: public, max-age=31536000, immutable`; privados `private, no-store`.
- **Rate limits (en memoria):** upload 30/min · delete 40/min · sensitive 5/min por usuario (`IMAGE_RATE_LIMIT` → 429).

#### Seguridad

MIME real (Sharp), límites de bytes/dims/píxeles, rechazo SVG/GIF/ejecutables, filenames sanitizados, segmentos sin path traversal, ownership + auth en privados, identity solo admin (conocer `imageId` no alcanza), errores genéricos sin filtrar keys internas.

#### Migración / cleanup / cuenta

- `npm run migrate:images` (`--preview` / `DRY_RUN=1`, lotes, idempotente)
- `npm run cleanup:images` (dry-run default; borrado solo `--execute`)
- Soft-delete 30d → `purge:deleted-accounts` / `jobs:images` borra imágenes públicas/privadas/variantes/metadata
- Identity TTL 180d (job `identity_retention`, SENSITIVE, separado de públicas)
- E2E HTTP: `npm run test:e2e -w @nocta/api`
- **Fase 11 (deprecación legacy):** staging en `tmp/upload-staging`; `/uploads` read-only + telemetría
- **Fase 12 (automatización lifecycle):** jobs idempotentes con ledger `ImageLifecycleJobRun`
- **Fase 14 (housekeeping):** `diagnose:images` dry-run + `listObjects`/`deleteByPrefix` + métricas `[image-metric]`
- **Fase 15 (go-live):** auditoría + memory bloqueado en prod + GIF fuera del edge + checklist

#### Jobs de lifecycle (Fase 12)

| Job | Qué hace | Borrado automático |
|-----|----------|-------------------|
| `purge_deleted_accounts` | Cuentas soft-delete > 30d → purge imágenes + cuenta | Sí |
| `identity_retention` | `identity_verification` TTL registry (180d); limpia refs User; **nunca** publica | Sí (solo identity) |
| `orphan_classify` | Clasifica metadata↔storage, dangling, legacy residual | **No** (solo reporte) |

**Manual:**

```bash
# Dry-run de todos
npm run jobs:images -w @nocta/api -- --dry-run

# Un job
npm run jobs:images -w @nocta/api -- --job=identity_retention --force

# Ejecutar de verdad (idempotente por hora UTC)
npm run jobs:images -w @nocta/api -- --force
```

Alias legacy: `npm run purge:deleted-accounts` ahora delega al bundle de jobs.

**Automático en producción (sin Redis):**

1. En Railway: `IMAGE_LIFECYCLE_JOBS=1` y opcional `IMAGE_LIFECYCLE_INTERVAL_MS=3600000` (default 1h).
2. El API arranca un scheduler in-process (`startImageLifecycleScheduler`) que corre los 3 jobs con backoff por ítem y ledger Mongo.
3. Alternativa: Cron de Railway / GitHub Action → `npm run jobs:images -w @nocta/api -- --force` (mismo código).

Ledger: colección `ImageLifecycleJobRun` (processed / deleted / errors / pending / durationMs / summary).

Huérfanos dudosos **no** se borran solos: revisar `summary.samples` del job `orphan_classify` y, si corresponde, `cleanup:images --execute` a mano.

#### Housekeeping y observabilidad (Fase 14)

Operaciones de storage para ops: `listObjects(prefix)`, `exists(key)`, `deleteObject(key)`, `deleteByPrefix(prefix)`.

**Diagnóstico (siempre DRY RUN — informa, no borra):**

```bash
npm run diagnose:images -w @nocta/api
```

Detecta:

1. Mongo metadata sin objeto en storage  
2. Objetos en storage sin `ImageAsset`  
3. Variantes públicas incompletas  
4. `ImageType` / visibility / namespace inconsistentes  
5. Imágenes de cuentas soft-delete o owner ausente  
6. Residuos legacy (`/uploads`, claims, identity en disco)

Rechaza `--execute` / `--delete`. Tras revisar: `cleanup:images --execute` o jobs lifecycle.

**Métricas** (stdout JSON, prefijo `[image-metric]`): `upload`, `processing_error`, `sharp_error`, `storage_error`, `signing` (latencia ms), `migration_error`, `cleanup_error`, `missing_object`.  
No loguean URLs firmadas, tokens, docs de identidad ni bytes de imagen (keys private redactadas).

**Troubleshooting**

| Síntoma | Qué mirar | Acción |
|---------|-----------|--------|
| Fotos 404 / broken en UI | `diagnose:images` → `mongoWithoutObject`; logs `missing_object` | Remigrar o re-subir; no confiar en refs memory-migrate |
| Bucket crece sin Mongo | `objectWithoutMongo` (usa `listObjects`) | Revisar samples; borrar solo con `cleanup`/`deleteByPrefix` manual |
| Variantes rotas / picture incompleto | `incompleteVariants` | Re-ingest de esa imagen |
| Identity mezclada con pública | `inconsistentImageType` | Corregir metadata; identity nunca CDN |
| Cuenta borrada con fotos vivas | `deletedAccountObjects` | Esperar/job `purge_deleted_accounts` o purge manual |
| Hits `[legacy-uploads]` | `legacyResidues` + `validate:images` | Migrar residual; luego `cleanup:images --execute` |
| Errores Sharp / upload | grepear `[image-metric]` `sharp_error` / `processing_error` / `storage_error` | Revisar MIME/size; credenciales Railway |
| Firmas lentas | `signing` con `ms` alto | CDN (`STORAGE_PUBLIC_BASE_URL`) para públicas; TTL firmas |
| Migración falla | `migration_error` + ledger `ImageMigrationRecord` | `validate:images`; `repair:images-memory` si migrate corrió en memory |

CDN smoke: `npm run diag:storage -w @nocta/api`.

#### Go-live checklist (Fase 15)

Antes de producción:

1. Railway Object Storage con credenciales (`STORAGE_DRIVER=auto|railway`); **memory bloqueado en `NODE_ENV=production`** salvo `STORAGE_ALLOW_MEMORY=1`.
2. `STORAGE_PUBLIC_BASE_URL` apuntando a CDN/custom domain (sin slash final).
3. `IMAGE_LIFECYCLE_JOBS=1` **o** cron externo → `npm run jobs:images -w @nocta/api -- --force`.
4. `npm run diagnose:images -w @nocta/api` en staging → revisar findings; sin deletes auto.
5. Migración legacy completa o plan explícito; `/uploads` sigue read-only residual.
6. Suite: `npm run test:all -w @nocta/api` + `npm run test -w @nocta/web`.

Veredicto de auditoría en canvas / informe Fase 15.

#### CDN pública (Fase 13)

Arquitectura de entrega **pública**:

```
Mongo (storageKey /api/media/{id})
  → API resolveDelivery → URL CDN (STORAGE_PUBLIC_BASE_URL + key)
  → Browser
  → OptimizedImage (<picture> AVIF/WebP + srcset; reescribe variantes en CDN)
```

Sin CDN (dev local):

```
Mongo → API → URL firmada al bucket Railway/memory → Browser
OptimizedImage cae a /api/media/{id}?v=&f= (302 firmado)
```

| Variable | Rol |
|----------|-----|
| `STORAGE_PUBLIC_BASE_URL` | Origen CDN / custom domain delante del bucket (sin slash final) |
| `STORAGE_SIGNED_URL_TTL_SECONDS` | TTL firmas (fallback sin CDN + privados) |

**Cache:** objetos públicos en Storage llevan `Cache-Control: public, max-age=31536000, immutable` + `Content-Type` webp/avif. Privados: `private, no-store`. Redirect `/api/media` a CDN: `max-age=86400`; a firma: `max-age=60`.

**Seguridad:** `identity_verification` / keys `private/*` **nunca** reciben URL CDN (`getPublicUrl` → null; `resolveReadUrl` → signed). Mongo **no** guarda URLs absolutas.

**Verificar staging/prod:**

```bash
npm run diag:storage -w @nocta/api
# Esperado con CDN: resolveMode=public, usesCdn=false en samplePrivate
curl -I "https://<cdn>/<public/.../medium.webp>"   # Cache-Control immutable
```

#### Legacy `/uploads` — qué queda y cómo verificar

| Qué | Estado |
|-----|--------|
| Escrituras permanentes a `/uploads` | **Eliminadas** (multer → `tmp/upload-staging` → Image Service) |
| `POST/PUT/DELETE /uploads/*` | **Bloqueadas** (405 `LEGACY_UPLOADS_READONLY`) |
| `GET /uploads/*` | **Permanece** (solo corpus migrable residual + telemetría) |
| FE `OptimizedImage` / `apiUrl` para `/uploads` | **Permanece** (compat si Mongo aún tiene refs legacy) |
| Vite proxy `/uploads` | **Permanece** (dev: sirve GETs legacy vía API) |
| Carpetas `apps/api/uploads`, `private/*` | **Permanece** hasta cleanup confirmado (`cleanup:images --execute`) |
| Identity / claims staging | **TEMP**; lectura admin de archivos viejos en `private/` si existen |

**Verificar cero dependencia de escritura:**

1. `npm run test -w @nocta/api` (incluye `phase11.legacyDeprecation`)
2. `npm run test:e2e -w @nocta/api`
3. `npm run validate:images -w @nocta/api` → `legacyPublic` / `legacyPrivate` → 0
4. En logs de API: ausencia de `[legacy-uploads] GET` en tráfico normal (o solo hits residuales)
5. Tras período de prueba sin hits: `cleanup:images --execute` y luego retirar `express.static` + proxy Vite (paso final explícito)
#### Desarrollo local vs producción

| | Local | Producción |
|--|-------|------------|
| Storage | `memory` o Railway | Railway bucket |
| CDN | opcional `STORAGE_PUBLIC_BASE_URL` | recomendada |
| Legacy `/uploads` | disco API | solo archivos no migrados |
| Seed | memory + seed | Atlas + migrate si hay legacy |

#### Endpoints de imagen (resumen)

| Método | Ruta | Notas |
|--------|------|--------|
| `POST` | `/api/profile/photos` | upload público + rate limit |
| `DELETE` | `/api/profile/photos/:index` | delete + rate limit |
| `POST` | `/api/me/identity-verification` | SENSITIVE + rate limit |
| `GET` | `/api/media/:id` | solo public → 302 Storage (fallback) |
| Admin | download identity/claims | URL firmada `no-store` |

Código: `apps/api/src/image-service/**`, `image-lifecycle/**`, `storage/**`.

### Auth (email + código 6 dígitos)

Flujo: **register → código por mail (15 min) → verify → onboarding**.
Los mails de verificación y recuperación usan plantilla responsive dark de Nocta (acento lima, código segmentado).

| Método | Ruta | Notas |
|--------|------|--------|
| `POST` | `/api/auth/register` | `emailVerified:false` + código; JWT con flag |
| `POST` | `/api/auth/login` | Sin verificar → `403 EMAIL_NOT_VERIFIED`; suspensión → `403 ACCOUNT_*_SUSPENDED` con fechas/duración |
| `GET` | `/api/auth/me` | Usuario del Bearer; controla suspensión y versión de sesión en cada request |
| `POST` | `/api/auth/verify-email` | `{ email, code }` o `{ code }` + Bearer; una cuenta ya verificada no emite JWT sin sesión propia |
| `POST` | `/api/auth/resend-verification` | Nuevo código; rate-limit 60s |
| `POST` | `/api/auth/forgot-password` / `reset-password` | Reset por link (API lista; **sin pantalla dedicada en el web aún**) |

Shared: `EMAIL_VERIFICATION_CODE_LENGTH=6`, `EMAIL_VERIFICATION_TTL_MINUTES=15`, `PASSWORD_HINT`.

Discover, presence, matches y varias mutaciones de venues/muro exigen `emailVerified` / perfil completo según gate. **Profile** (`/api/profile*`) hoy usa `requireAuth` (sin `requireVerified` en esas rutas).

### Profile y fotos

`MIN_PHOTOS=1`, `MAX_PHOTOS=10`, `MIN_AGE=16`, `MAX_AGE=99`; `photos[0]`=avatar. Upload multipart `photo`/`photos` vía multer → ingest Object Storage (públicos nuevos).

**Contrato fotos en JSON:** en Mongo las refs managed siguen siendo `/api/media/{id}` (o `/uploads/...` legacy). En respuestas API, `serialize*` las expande a URL directa Storage/CDN (o absolutiza legacy). El PUT de perfil canónica URLs firmadas/CDN de vuelta a la ref estable.

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
| `GET` | `/api/users/:id` | Perfil autenticado; devuelve 404 si existe bloqueo en cualquier dirección |
| `GET` | `/api/users/:id/followers` · `.../following` | Listas sociales públicas |
| `POST` | `/api/users/:id/follow` | Solicitud (pendiente) o follow inmediato si `autoAcceptFollowRequests` |
| `DELETE` | `/api/users/:id/follow` | Cancela solicitud o deja de seguir |
| `POST` | `/api/users/:id/block` | Bloqueo idempotente: invisibilidad mutua, elimina vínculos/solicitudes, disuelve matches y neutraliza swipes |
| `POST` | `/api/users/:id/report` | Denuncia directa de perfil con `{ reason, details? }` |
| `GET` | `/api/me/follow-requests` | Solicitudes entrantes pendientes |
| `GET` | `/api/me/follow-requests/:id/profile` | Vista mínima del solicitante |
| `POST` | `/api/me/follow-requests/:id/accept` · `.../reject` | Aceptar / rechazar |
| `GET` | `/api/me/following` · `/api/me/followers` | Follows aceptados |
| `DELETE` | `/api/me/followers/:id` | Elimina a una persona de mis seguidores |
| `GET` | `/api/me/venues/owned` | Espacios donde soy `ownerId` |
| `GET` | `/api/me/promo-purchases` · `/api/me/promo-purchases/:id` | Promos compradas (QR). **No hay** endpoint de compra/canje en el MVP; las compras demo se crean en seed |
| `GET` | `/api/me/reviews` | Mis reseñas (`page`, `limit` default `MY_REVIEWS_PAGE_SIZE` = 5, `q`) |
| `PATCH` | `/api/me/settings` | `autoAcceptFollowRequests`, `showActivityToFollowers` (parcial; default `true`; legado `hideActivityFromFollowers` se interpreta al leer) |
| `GET` | `/api/me/blocked-users` | Usuarios bloqueados por la cuenta, paginados (`page`, `limit`) |
| `DELETE` | `/api/me/blocked-users/:id` | Desbloquea al usuario indicado |
| `GET` | `/api/me/reports/:id` | Resultado de una denuncia propia (solo el denunciante) |
| `DELETE` | `/api/me/account` | Soft-delete (30 días de recuperación) con `{ confirmation: "Eliminar" }`; perfil invisible; no borra imágenes aún; protege la última cuenta admin activa |
| `POST` | `/api/me/account/restore` | Cancela el borrado pendiente dentro de los 30 días |
| `POST`/`DELETE` | `/api/venues/:id/follow` | Follow de Espacios (instantáneo) |
| `GET` | `/api/venues/:id/followers` | Seguidores del Espacio |
| `GET` | `/api/users/:id/venues` | Espacios públicos del organizador |

### Auth social (OAuth)

1. `GET /api/auth/oauth/:provider` → redirect al IdP (`google` \| `apple` \| `microsoft`)
2. Callback `GET` (Google/Microsoft) o `POST` (Apple) en `/api/auth/oauth/:provider/callback`
3. Exchange del `code` → **`upsertOAuthUser`** (`emailVerified: true`)
4. Si la cuenta está suspendida → `/login` con código y fechas de bloqueo
5. JWT → `{CLIENT_ORIGIN}/auth/callback?token=...`
6. Error → `{CLIENT_ORIGIN}/login?error=...`

En login, Apple y Microsoft están deshabilitados en UI (toast “próximamente”); las rutas backend siguen existiendo.

Modelo: `passwordHash` opcional; `oauthAccounts[]` `{ provider, providerUserId }`; `authProvider`.

### Venues, solicitudes, noticias, reseñas y promociones

| Método | Ruta | Auth | Notas |
|--------|------|------|--------|
| `GET` | `/api/venues` | — | Paginado `page`, `limit` (default/máx `VENUES_PAGE_SIZE` = 9), `type`, `q` |
| `GET` | `/api/venues/:id` | — / optionalAuth | Activo + últimas 3 promos vigentes + 3 noticias + `ratingAvg`/`ratingCount`/`myReview?`/`isFollowing?`/`owner?` |
| `GET` | `/api/venues/:id/manage` | admin o organizador | Datos administrables; también funciona si está inactivo |
| `GET` | `/api/venues/admin/all` | admin | Incluye inactivos; paginado (`page`, `limit` mínimo 10, `q`) y con `owner` |
| `POST` | `/api/venues` | admin | Multipart: mismos datos de una recomendación (nombre, tipo, país/ciudad, mapa, dirección, portada WebP, descripción, contacto opcional) + `ownerId` obligatorio; crea el Espacio activo de inmediato |
| `PATCH` | `/api/venues/:id` | admin | Edición / `active` / reasignar `ownerId` |
| `PATCH` | `/api/venues/:id/manage` | admin o organizador | multipart; edita datos, ubicación y reemplaza opcionalmente la portada |
| `DELETE` | `/api/venues/:id` | admin | Soft-delete (`active: false`) |
| `POST` | `/api/venues/requests` | user | multipart; **sin portada** (la carga el admin al aprobar); `wantsToManage`; si es `true`, exige `managementMessage?` y 1–3 `evidenceFiles` privados |
| `GET` | `/api/venues/claimable` | user | Espacios activos sin Organizador; búsqueda `q`, máximo 30 |
| `POST` | `/api/venues/claims` | user | Reclama un Espacio existente; multipart con `venueId`, `message?` y 1–3 `evidenceFiles` privados (PDF/JPG/PNG/WebP, 2 MB c/u) |
| `GET` | `/api/venues/requests/mine` | user | Mis solicitudes |
| `GET` | `/api/venues/geocode/search` | user | `?address=&city=&country=` → geocodificación directa y dirección normalizada |
| `GET` | `/api/venues/geocode/reverse` | user | `?lat=&lng=` → Nominatim |
| `POST` | `/api/venues/:id/promotions` | admin o organizador | `title`, `description`, `priceUyu`, `validFrom`/`validUntil` (`YYYY-MM-DD` en zona del perfil) |
| `GET` | `/api/venues/:id/promotions` | admin o organizador | Incluye inactivas; acepta `page`/`limit` (mínimo 10) para Dashboard |
| `PATCH`/`DELETE` | `/api/venues/:id/promotions/:promoId` | admin o organizador | Editar / soft-delete |
| `GET` | `/api/venues/:id/news` | — / manage | Activas; organizador/admin ven todas; acepta `page`/`limit` (mínimo 10) |
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
| `GET` | `/api/presence/me` | `presence` (más reciente), `presences[]`, `maxPresences` (1 o 3 con Clone); expira vencidas del user |
| `POST` | `/api/presence` | `{ venueId, hours }` — `hours: null` = permanente; sin Clone revoca otras activas; con Clone suma hasta 3; bloqueado si `discoverDisabled` |
| `DELETE` | `/api/presence/me` | Revoca presencia(s); `?venueId=` para una sola (Clone); limpia likes salientes y entrantes de esos Espacios (los matches/chats se conservan) |

Presets UI: `PRESENCE_PRESETS` — 24h / 48h / 1 semana / permanente.

### Discover / swipe / match

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/discover/feed` | Deck del `venueId` activo + `likeAllowance`; sin presencia → `400` `NO_PRESENCE`. Cards con `isFollowing` / `isFollowRequested`. Acepta `?userId=` para priorizar esa persona si quien consulta es Premium. **Fotos:** entrega CDN/firmada solo `photos[0]`; el resto refs `/api/media/{id}` o `/uploads/...` (sin firmar el álbum completo) |
| `GET` | `/api/discover/likes` | Likes **recibidos** pendientes. Excluye bloqueados; `viewerPremium` + `canSeeLikes` (plan **4 AM+** con `see_likes`). Sin `canSeeLikes` **no** envía `user.id`, `name` ni `photo` (salvo Heartshot). Cada ítem trae `canRespond` si tenés presencia en ese `venueId` |
| `POST` | `/api/discover/swipe` | `{ toUserId, direction }` → `{ ok, match, likeAllowance }`; rechaza pares bloqueados; sin cuota → `429 LIKES_EXHAUSTED` |
| `POST` | `/api/discover/rewind` | Deshace el último swipe del espacio activo; si era like, borra match+mensajes y `refundLike`; nunca restaura perfiles bloqueados |

### Anuncios (Discover)

Anuncios insertados en el deck de Discover (client-side) cada **7–10** swipes de perfil. Like abre `/ads/:id`; pass saltea. Usuarios Premium con feature `no_ads` (todos los planes) no reciben anuncios.

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/ads/next` | Próximo anuncio ponderado (`weight`) o `{ ad: null }` si Premium con Sin anuncios / sin creatividades |
| `GET` | `/api/ads/:id` | Detalle del anuncio (landing) |

Seed demo: 3 creatividades vía `ensureDemoAds()` al sembrar / asegurar cuentas demo.

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
- Boost / Heartshot (4 AM+): se cargan la cuota **mensual** del plan al comprar y otra vez cada **30 días** durante el periodo pagado (p. ej. 3 meses → cargasargas en día 0, 30 y 60). Si cancela, siguen hasta `premiumExpiresAt`
- En UI, con cuota agotada el gesto puede animar pero la API responde `429` y no registra el swipe

Match: like mutuo en el mismo `venueId`; par ordenado + índice unique.

### Matches / chat / safety

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/matches` | Summaries (otro user, venue, lastMessage); omite peers bloqueados |
| `GET` | `/api/matches/:id/messages` | Thread (participantes; `403` si bloqueado) |
| `POST` | `/api/matches/:id/messages` | `{ body }` máx 2000 |
| `DELETE` | `/api/matches/:id` | Unmatch / disuelve el match (conserva mensajes del chat para auditoría) |
| `POST` | `/api/matches/:id/report` | `{ reason, details?, unmatch? }` (`unmatch` default `true`) → crea `Report` |
| `POST` | `/api/matches/:id/block` | Crea `Block` + disuelve **todos** los matches entre el par |

### Admin

Todas bajo `requireAuth` + `requireAdmin`.
Las listas del Dashboard muestran 10 registros por página, con acordeón de
**Filtros** y paginación: usuarios, Espacios, solicitudes, verificaciones,
ciudades, denuncias, transacciones, auditoría y, por cada Espacio, promociones
y noticias.

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/admin/stats` | Snapshot de KPIs (compatibilidad): usuarios, admins, Espacios, presencias, matches, solicitudes/denuncias y métricas de promos/Premium |
| `GET` | `/api/admin/overview` | Resumen por pestañas: KPIs + series mensuales (últimos 12 meses). Ganancias totales en USD = Premium USD + (promos UYU ÷ 39) |
| `GET` | `/api/admin/users` | Cuentas paginadas (`page`, `limit` mínimo 10, `q`, `role?`), incluidos usuarios y administradores |
| `GET` | `/api/admin/users/:id` | Ficha completa de una cuenta para consultas administrativas |
| `PATCH` | `/api/admin/users/:id` | Edita rol, email, verificación, Premium y datos del perfil; impide degradar al último administrador |
| `GET` | `/api/admin/venue-requests` | Paginado (`page`, `limit` mínimo 10) + `status?` pending/approved/rejected |
| `GET` | `/api/admin/venue-requests/:id` | Detalle de alta o reclamación |
| `GET` | `/api/admin/venue-requests/:id/evidence/:fileId` | Descarga autenticada de un comprobante privado |
| `POST` | `/api/admin/venue-requests/:id/approve` | **Create:** multipart con datos editables + portada WebP obligatoria; crea Venue. **Claim:** JSON `{ adminNote? }`; asigna `ownerId`. Email + notif al solicitante |
| `POST` | `/api/admin/venue-requests/:id/reject` | `{ reason }` (`VENUE_REQUEST_REJECT_REASONS`) + `adminNote?` (obligatoria si `other`); email + notif |
| `GET` | `/api/admin/reports` | Denuncias paginadas (`page`, `limit` mínimo 10, `status?`) |
| `POST` | `/api/admin/reports/:id/actions` | Resolución única con explicación obligatoria: descartar o suspender 30/90/180/360 días o permanentemente; revoca sesiones/presencia y envía emails |
| `GET` | `/api/admin/promo-purchases` | Compras internas de promos, read-only y paginadas (`page`, `limit`; default/mínimo 10) |
| `GET` | `/api/admin/premium-purchases` | Cobros Premium Mercado Pago, read-only y paginados (`page`, `limit`) |
| `GET` | `/api/admin/audit` | Eventos de auditoría paginados (`page`, `limit`, `q?`, `action?`) |
| `PATCH`/`DELETE` | `/api/admin/promotions/:id` | Editar / soft-delete promo |
| `PATCH`/`DELETE` | `/api/admin/news/:id` | Editar / soft-delete noticia |

### Modelos Mongo

| Modelo | Campos clave |
|--------|----------------|
| **User** | email, passwordHash?, role, profile, profileComplete, emailVerified, premium, premiumPlanId, premiumExpiresAt, premiumPeriodMonths, premiumAllowanceNextAt, premiumAllowanceCyclesLeft, boostsRemaining, heartshotsRemaining, remainingLikes, likesRechargeAt, oauthAccounts, authProvider, followersCount, followingUsersCount, followingVenuesCount, autoAcceptFollowRequests, showActivityToFollowers (legado hideActivityFromFollowers), tokens de verificación/reset |
| **Venue** | name, type, address, country, city, description, photos, location?, ownerId?, followersCount, ratingAvg, ratingCount, active |
| **VenueReview** | venueId, userId, rating (1–5), body?, photos (≤3), active — unique `(userId, venueId)` |
| **ActivityEvent** | actorId, type (`venue_review_created`\|`venue_review_updated`\|`venue_followed`\|`user_post_created`), venueId?, reviewId?, postId?, payload, active |
| **UserPost** | authorId, venueId, body (1–200), photos (0–3), active |
| **VenueNews** | venueId, title, body, photos, publishedAt, active |
| **VenueRequest** | requesterId, requestType, targetVenueId?, wantsToManage, managementMessage?, evidenceFiles, name, type, address, country, city, geocodedAddress?, location?, description?, photos, contactEmail?, contactPhone?, status, adminNote?, reviewedBy?, venueId? |
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

- Admin + **113 Espacios de Montevideo** (bar, pub, boliche, cervecería, concierto) con calle y pin geocodificado; promo “Promo Nocta” en **Jackson Bar**
- `syncPilotVenues()` en cada boot: limpia entradas antiguas sin organizador y hace upsert de los 113. Nunca borra Espacios registrados ni pisa datos editados por un Organizador.
- Dirección visible = calle; `location` queda en el catálogo (sin Nominatim en cada boot)
- Fotos de catálogo: la UI lee `apps/web/public/images/venues/{NombreEspacio}Img.webp` (URL `/images/venues/…`) a partir del nombre. Convención: PascalCase sin acentos ni signos + `Img.webp` (`Jackson Bar` → `JacksonBarImg.webp`, `Negroni` → `NegroniImg.webp`). Si falta el archivo, cae al placeholder. Una foto subida a `/uploads/` (organizador) pisa esa portada.
- Users demo Sofía (premium) / Mateo / Valentina con perfil completo y presencia 48h en **Jackson Bar**; creatividades demo de anuncios (`ensureDemoAds`)
- Follows user↔user y de Espacios, noticias, reseñas, eventos de actividad y `PromoPurchase` demo de Mateo
- Auto-ejecución al boot si `MONGODB_URI=memory` (o Atlas vacío con `SEED_ON_EMPTY`)
- En cada boot: `syncPilotVenues` + `ensureDemoAccounts` + normalización de `lookingFor` a 1 opción

### Estado MVP backend (checklist)

- [x] Auth email/password + JWT + `GET /me`
- [x] OAuth Google / Apple / Microsoft (lógica completa; requiere env + Mongo)
- [x] Perfil / onboarding
- [x] Venues CRUD admin + listado público paginado (9) + búsqueda/filtro
- [x] Promociones (CRUD organizador/admin; compras solo seed / listado `me`)
- [x] Presencia (24h / 48h / 1 semana / permanente; 1 activa por defecto, hasta 3 con Clone / 6 A.M.)
- [x] Discover + swipe + rewind + match + likes
- [x] Anuncios en Discover (cada 7–10 swipes; Sin anuncios en todos los Premium)
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
- Recharts (gráficas del Resumen admin)
- Estilos tema: `src/theme.css` (dark + lima; anillos de foco de `.btn` en lima, sin flash azul default de Bootstrap)
- Mapas: CARTO raster `dark_all` + Leaflet; configurar `VITE_CARTO_BASEMAPS_API_KEY` en `apps/web/.env.local` (las atribuciones OSM/CARTO permanecen visibles)
- Assets: `public/images/` — logos Nocta (`nocta-logo-limaneon-nobg.png`, blanco/negro); fotos de Espacios en `public/images/venues/{Nombre}Img.webp` (listado y detalle las piden por nombre). Si falta el archivo, caen al placeholder. `index.html` puede referenciar favicon

### UX / responsive

- Mobile-first; layouts reales en **mobile / tablet / desktop**
- Mobile: tab bar inferior; UI tipo dating app
- Tablet/desktop: top nav; grids de espacios; Discover centrado
- Footer mínimo (`AppFooter` / wordmark + ©) **solo en `/profile`**, todas las resoluciones
- Admin: top + drawer (mobile/tablet) + sidebar desktop (`AdminLayout`); Perfil muestra acceso de ancho completo al dashboard solo para administradores
- Listas Admin: paginación responsive estandarizada en bloques de 10 registros
- Pocas cajas anidadas; `fade-in` / `fade-in-up`; `prefers-reduced-motion` en pulsos/overlays
- Carga: `NoctaLoading` (luna limaneon como “C” de Cargando, Syne 800, anillos; `screen` / `block` / `inline`)
- Iconos solo en botones / menús / tabs (nunca en títulos). Excepción: `VenueTrustBadge` al lado del nombre del Espacio (estado de organizador, no decoración)
- Búsquedas: `ManualSearchInput`; el texto se aplica únicamente con Enter o el botón de lupa, y limpiar restablece los resultados inmediatamente
- Feedback de interacción: `useToast()` (ver `.cursor/rules/toasts.mdc`); formularios largos pueden mostrar error inline

Reglas Cursor: `.cursor/rules/nocta.mdc`, `wordmark-nocta.mdc`, `toasts.mdc`, `espacios.mdc`, `fullstack-agent.mdc`.

### Componentes clave (además de páginas)

- Perfil: `ProfileActionButtons`, `ProfileSettingsModal` (solo preferencias), `FollowRequestsModal`, `ProfileConnectionsModal`, `ProfileMyReviewsAccordion`, `FollowRequestProfileModal`, `DeleteAccountModal`
- Discover / venues: `DiscoverProfileDetail`, `VenueReviewsSection`, `VenueMap`, `LocationPickerMap`, `VenueTrustBadge`, `VenueFormFields`, `VenueClaimForm`, `VenueEvidenceFields`
- Misc: `AuthAtmosphere`, `PromoQrCode`, `PhotoLightbox`, `ToastProvider`, `NoctaWordmark`, `NoctaLoading` (Cargando con luna limaneon + anillos), `AppFooter`, `NotificationsBell`, `PremiumPackagesModal`, `AdminSearchSelect` (desplegable administrativo con búsqueda interna)

### Rutas UI

| Ruta | Pantalla |
|------|----------|
| `/login` · `/register` | Auth con escena Nocta; login local/OAuth informa suspensiones temporales o permanentes con fecha de inicio/fin; Apple/Microsoft deshabilitados (toast) |
| `/verify-email` | OTP 6 dígitos, pegado y reenvío con cooldown |
| `/auth/callback` | Recibe `?token=` post-OAuth |
| `/onboarding` | 6 pasos: datos + identidad + ubicación → estilo de vida → trabajo → búsqueda (1) + gustos → fotos (guardar) → Planazos (3 planes Premium; Omitir) |
| `/` | Redirect a `/venues` |
| `/venues` | Home de usuario. Cards 1/2/3 cols; strip “Publicado” 24h + CTA Discover; CTA para solicitar un Espacio faltante; ícono verificado si hay `ownerId` |
| `/venues/:id` | Foto + mapa (`col-12` / `col-md-5`); reseñas y CTA (`col-12` / `col-md-7`); ícono de organizador al lado del nombre |
| `/venues/:id/manage` | Organizador: descripción, seguidores, acceso a edición, noticias, promos y Mercado Pago “próximamente” |
| `/venues/:id/edit` | Edición separada del Espacio: identidad, País/Ciudad, mapa, descripción y reemplazo opcional de portada |
| `/likes` | Likes recibidos pendientes: plan **4 AM+** ve foto/nombre + Discover; free / 2 AM placeholder + modal; grilla 2 cols en mobile |
| `/muro` | Redirect a `/venues` (pantalla retirada) |
| `/discover` | Sin presencia: portada. Varias (Clone): picker de Espacios. Con una elegida: swipe (← pass / → like / ↑ Heartshot) + botones; Boost en header; rewind Premium; likes agotados → CTA Premium; detalle con bloquear/denunciar. Cada 7–10 swipes (usuarios sin `no_ads`) inserta un anuncio: like → `/ads/:id`, pass saltea. **Imágenes:** `OptimizedImage`; 1 foto activa por card (thumb/medium) + preload de la 1.ª del siguiente; galería del detalle lazy por índice |
| `/ads/:id` | Landing del anuncio (imagen, copy, CTA externo o in-app) |
| `/report/:userId` | Formulario protegido para denunciar un perfil por motivo y detalles |
| `/reports/:reportId` | Resultado de una denuncia propia (descarte o medidas aplicadas) |
| `/matches` | Vacío animado o lista/grilla; menú eliminar / denunciar / bloquear |
| `/matches/:id` | Chat. En desktop (≥992): perfil a la izquierda (carrusel de fotos, datos, eliminar match / bloquear / denunciar al final del scroll) y conversación a la derecha. Unmatch conserva mensajes para auditoría |
| `/notifications` | Inbox completo (10 por página); campana muestra las últimas 5 + Ver más |
| `/profile` | Hero + galería; Mis reseñas; contadores; Mis promos / Mis espacios; cuatro acciones con popover (configuración, solicitudes, editar y eliminar); borrado con confirmación escrita; acceso al dashboard si es admin; **único sitio con footer** |
| `/profile/blocked` | Lista paginada de usuarios bloqueados con opción para desbloquear |
| `/profile/promos` | Mis promos + QR |
| `/profile/venue-request` | Pestañas Registrar/Reclamar: el alta **no** pide portada (la publica el admin); sugerencia u Organizador con comprobantes; reclamación sin cambios |
| `/admin/overview` | Resumen con pestañas (Usuarios, Espacios, Solicitudes, Transacciones, Ciudades): KPIs + gráficas de 12 meses |
| `/admin/requests` · `/admin/venues` · `/admin/content` · `/admin/cities` · `/admin/verifications` | Listas con acordeón **Filtros** + paginación |
| `/admin/users` | Usuarios y administradores; filtros (búsqueda + rol) en acordeón; modal para editar cuenta/perfil |
| `/admin/reports` | Denuncias paginadas con filtros en acordeón; fichas y modal Acciones |
| `/admin/transactions` | Premium / promos en filtros; tarjetas paginadas |
| `/admin/audit` | Tabla de auditoría con filtros (búsqueda + acción) y paginación |

### Consumo API

- Cliente: `src/lib/api.ts` — `api()` / OAuth usan `apiUrl()`; `VITE_API_URL` (bake en build) apunta a la API en producción; vacío en local → rutas relativas + proxy Vite
- Helper `mediaUrl()`: `https://…` (CDN/firmada) tal cual; `/uploads/` y `/api/media/` vía API
- **`OptimizedImage`** (`components/OptimizedImage.tsx`): único componente para fotos PUBLIC (perfil, Espacios, promos/news, reviews, Discover). `<picture>` AVIF→WebP + srcset; prop `variants` para limitar (swipe: thumb+medium); legacy `/uploads` y `/images` como `<img>`; lazy + `decoding="async"`; fallback ante error. **No** usar en identity_verification.
- Proxy Vite: `/api` y `/uploads` → `http://localhost:4000` (solo legacy/local)
- Producción (p. ej. Railway, web y API en dominios distintos):
  - Web: `VITE_API_URL=https://…api…` y **redesplegar** (Vite incrusta el env en el build)
  - API: `CLIENT_ORIGIN=https://…web…`, `API_PUBLIC_URL=https://…api…` (absolutiza fotos en JSON)
- Espacios: `page` / `limit` / `type` / `q` + IntersectionObserver
- Matches: `DELETE /api/matches/:id`, `POST .../report`, `POST .../block`
- Chat desktop: `GET /api/users/:id` para galería y datos del perfil en el panel del match
- Scrolls de UI: sin barra visible; sombreado en el extremo si hay más contenido (`OverflowFade`)

---

## Shared (`@nocta/shared`)

Tipos y catálogos usados por API y Web:

- Catálogos: `LOOKING_FOR`, `INTERESTS`, `INTEREST_CATEGORIES`, `WORK_STATUS`, `GENDERS`, `VENUE_TYPES`, `SEXUAL_ORIENTATIONS`, `LANGUAGES`, `ZODIAC_SIGNS`, `EDUCATION_LEVELS`, `PETS`, `DRINKING`, `FITNESS`, `SOCIAL_NETWORKS`, `VENUE_COUNTRIES`, `VENUE_CITIES_BY_COUNTRY`, `PROFILE_COUNTRIES`, `OAUTH_PROVIDERS`, `REPORT_REASONS`, `VENUE_REQUEST_STATUSES`, `VENUE_REQUEST_REJECT_REASONS`, `FOLLOW_TARGET_TYPES`, `FOLLOW_REQUEST_STATUSES`, `PROMO_PURCHASE_STATUSES` (+ labels)
- Límites: `VENUES_PAGE_SIZE` (9), `REVIEWS_PAGE_SIZE`, `MY_REVIEWS_PAGE_SIZE` (5), `MIN/MAX_VENUE_RATING`, `MAX_REVIEW_BODY_LENGTH`, `MAX_REVIEW_PHOTOS` (3), portada de Espacio WebP (`VENUE_COVER_WIDTH/HEIGHT` = 1600×1200), `MAX_POST_BODY_LENGTH` (200), `MAX_POST_PHOTOS` (3), `MIN/MAX_PHOTOS`, `MIN/MAX_AGE`, `DAILY_LIKE_LIMIT` (50), `LIKE_RECHARGE_HOURS` (8)
- Actividad: `ACTIVITY_TYPES` + `ACTIVITY_TYPE_LABELS` (incluye `user_post_created`)
- Notificaciones: `NOTIFICATION_TYPES` + `NOTIFICATION_TYPE_LABELS`, `NOTIFICATION_READ_TTL_DAYS` (30), `NOTIFICATIONS_PREVIEW_LIMIT` (5), `NOTIFICATIONS_PAGE_SIZE` (10)
- Presencia: `PRESENCE_PRESETS` (24h / 48h / 1 semana / permanente)
- Zodíaco editorial: `ZODIAC_INSIGHTS`; geografía de Espacios: Uruguay, Argentina y Brasil habilitados; `DISPLAY_ADDRESS_HINT`
- Password / verify / upload: `PASSWORD_RULES`, `PASSWORD_HINT`, constantes de mail y multipart
- Timezone (`timezone.ts`): `timezoneFromCountry`, anclas de día civil para vigencia de promos
- Tipos: `AuthUser`, `SuspensionDuration`, `ModerationStatus`, `FollowListUser`, `FollowRequestItem`, `Venue`, `VenueReview`, `DiscoverCard`, `AdminReport`, etc.

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
