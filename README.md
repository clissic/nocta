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
9. [Mobile](#mobile-android--expo)
10. [Shared](#shared-noctashared)
11. [Convenciones](#convenciones)

---

## Producto y roles

| Rol | Qué puede hacer |
|-----|-----------------|
| **user** | Registro → código email → onboarding (≥ `MIN_PHOTOS` fotos), Espacios, Likes recibidos, publicar presencia, Discover, match, chat, follows, solicitar integración de espacio, gestionar noticias/promos de espacios donde sea `ownerId` |
| **admin** | Misma experiencia de app que un usuario (Espacios, Discover, etc.) y además acceso al **Panel** desde el menú de cuenta. Con sesión, `/` sigue a `/venues` |

**Organizador de espacio:** no es un rol. Es `Venue.ownerId → User`. Un usuario puede ser organizador de varios espacios; aparecen en su perfil.

Flujo usuario:

1. Auth (email/password u OAuth Google; Apple y Microsoft UI deshabilitadas “próximamente”) → onboarding
2. Espacios (búsqueda + filtro por tipo + paginación) → publicar presencia
3. Discover del espacio → like/pass → match → chat
4. Likes: plan **4 AM+** (`see_likes`) revela identidad y abre ese perfil en Discover; free / 2 AM reciben teaser **blur del servidor** + candado y se ofrecen paquetes

Nav principal (mobile + tablet/desktop): **Espacios → Likes → Discover → Matches → Perfil**.

Regla de negocio: **una sola presencia activa** por defecto; con **Clone (6 A.M.)** hasta **3** Espacios a la vez. El deck de Discover es por `venueId`.

Ciudad piloto: **Montevideo**. El catálogo de seed tiene 113 Espacios reales (bar / pub / boliche / cervecería / concierto) con dirección y coordenadas; ninguno nace con organizador (`ownerId` vacío hasta que Admin asigne o se apruebe el formulario de perfil).

---

## Monorepo

```text
nocta/
├── apps/
│   ├── api/          # Express + MongoDB + JWT + OAuth
│   ├── web/          # React + Vite + Bootstrap 5
│   └── mobile/       # Expo / React Native (Android primero)
├── packages/
│   └── shared/       # Tipos, enums, constantes compartidas
├── .cursor/rules/    # Reglas Cursor del proyecto
└── README.md         # Este archivo (único)
```

Stack: **MERN** (Mongo, Express, React, Node) + TypeScript + workspaces npm + **Expo** (`apps/mobile`).

---

## Setup

Requisitos: **Node 20+**.

```bash
npm install
cp apps/api/.env.example apps/api/.env
cp apps/web/.env.example apps/web/.env.local
cp apps/mobile/.env.example apps/mobile/.env
```

Dos o tres terminales:

```bash
npm run dev:api      # http://localhost:4000
npm run dev:web      # http://localhost:5173
npm run dev:mobile   # Expo (Android: emulador o dispositivo)
```

Por defecto `MONGODB_URI=memory` (Mongo embebido; al arrancar la API corre seed demo).

Mongo real / Atlas:

```env
MONGODB_URI=mongodb+srv://USER:PASS@cluster.../nocta
```

Luego: `npm run seed`.

Al boot en **dev / memory** (además del seed en memory / `SEED_ON_EMPTY`): `syncPilotVenues()`, `ensureDemoAccounts()` y `normalizeLookingForSingleChoice()`.

En **producción** el boot es liviano por defecto: no corre demos/pilotos/normalize ni `Match.syncIndexes()`. Overrides:

| Variable | Efecto |
|----------|--------|
| `BOOT_SYNC=1` | Fuerza sync de demos/pilotos/normalize también en prod |
| `SKIP_BOOT_SYNC=1` | Omite sync de datos aunque no sea prod |
| `SYNC_INDEXES=1` | One-shot `Match.syncIndexes()` al boot (post-deploy) |
| `SEED_ON_EMPTY` | En Railway API: **`false`** (no seed automático en Atlas) |
| `MORGAN` | Prod usa `tiny`; `0` apaga; otro valor override (p. ej. `combined`) |

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
| `npm run dev:mobile` | Expo Dev Server (`apps/mobile`) |
| `npm run android` | Expo → Android |
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
| `CLIENT_ORIGIN` | CORS + redirects OAuth/web (URL del web, p. ej. Railway) |
| `MOBILE_APP_SCHEME` | Scheme deep link nativo (default `nocta`) para reset/OAuth con `client=mobile` |
| `API_PUBLIC_URL` | Base pública de la API; absolutiza `/uploads/` legacy en JSON |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Cuenta admin del seed (defaults de la tabla demo) |
| `MAIL_TRANSPORT` | `auto` (default) \| `smtp` \| `resend` — `smtp` fuerza Gmail aunque exista `RESEND_API_KEY` |
| `RESEND_API_KEY` | Mail vía Resend (HTTPS). En `auto` tiene prioridad; sin dominio solo envía al mail de la cuenta Resend |
| `SMTP_*` / `MAIL_FROM` / `MAIL_NOTIFY_TO` / `MAIL_DEV_LOG` | Nodemailer (DNS IPv4); `MAIL_NOTIFY_TO` recibe solicitudes de Espacios (fallback `SMTP_USER`) |
| OAuth `GOOGLE_*` / `APPLE_*` / `MICROSOFT_*` / `MICROSOFT_TENANT` | Social login (`MICROSOFT_TENANT` default `common`) |
| `TURNSTILE_SECRET_KEY` | Secret de Cloudflare Turnstile. Si está, registro, login y recupero exigen el token en web y app. El widget queda oculto si el chequeo pasa solo y aparece únicamente cuando Cloudflare pide confirmación. Site key pública: `VITE_TURNSTILE_SITE_KEY` (web) y `EXPO_PUBLIC_TURNSTILE_SITE_KEY` (app). El WebView de la app usa origen `http://localhost` hasta el dominio público (`EXPO_PUBLIC_TURNSTILE_BASE_URL`) |
| `STORAGE_DRIVER` | `auto` (default) \| `railway` \| `memory` — Object Storage |
| `MEMORY_STORAGE_DIR` | Solo con `memory`: carpeta de blobs (default `apps/api/.data/memory-storage`). `0`/`off` = solo RAM |
| `STORAGE_PUBLIC_BASE_URL` | Base CDN/custom delante del bucket (opcional; sin esto las públicas salen firmadas al bucket) |
| `STORAGE_SIGNED_URL_TTL_SECONDS` | TTL de URLs firmadas (default `3600`) |
| `AWS_ENDPOINT_URL` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_S3_BUCKET_NAME` / `AWS_DEFAULT_REGION` / `AWS_S3_URL_STYLE` | Credenciales Railway Bucket (preset AWS SDK). También acepta `ENDPOINT`/`BUCKET`/`ACCESS_KEY_ID`/`SECRET_ACCESS_KEY`/`REGION` o prefijo `STORAGE_*` |
| `EXPO_ACCESS_TOKEN` | Opcional. Token de [expo.dev](https://expo.dev/accounts/clissic/settings/access-tokens) para el cupo de avisos push. Sin esto el envío usa el cupo anónimo |
| `RATE_LIMIT_DISABLED` | `1` apaga los cupos de `express-rate-limit`. Default apagado (los cupos están activos). Los tests e2e los saltean con `NOCTA_E2E=1` |

### Cupos de solicitudes

`express-rate-limit`, contador en memoria del proceso. `429` con «Demasiadas solicitudes. Probá de nuevo en un momento.» `trust proxy` está en 1 para leer la IP real detrás de Railway.

Con sesión el cupo es por usuario (el `sub` del JWT). Sin sesión, por IP: en un Espacio mucha gente comparte la red. `GET /health` y `POST /api/premium/webhook` no entran.

| Ruta | Ventana | Máximo | Clave |
|------|---------|--------|--------|
| `POST /api/auth/login` | 15 min | 10 | IP |
| `POST /api/auth/register` | 1 h | 5 | IP |
| Reenvío de código y olvidé mi contraseña | 15 min | 5 | IP. Además, 1 por minuto por email |
| `GET /api/auth/oauth/:provider` | 15 min | 20 | IP |
| `GET /api/venues`, `/api/cities`, `/api/ads` | 1 min | 300 | IP |
| Resto de `/api` con JWT | 1 min | 120 | usuario |
| `POST /api/discover/swipe` | 1 min | 40 | usuario |
| `POST /api/matches/:id/messages` | 1 min | 30 | usuario |
| `POST /api/premium/checkout` | 10 min | 5 | usuario |
| `POST /api/me/push-token` | 1 min | 10 | usuario |

Fotos: 30 subidas, 40 borrados y 5 archivos sensibles por minuto, por usuario. Al reiniciar la API los contadores vuelven a cero. Con más de una instancia, cada una tiene el suyo.

**Object Storage / Image Service (Fase 1–8):** ver sección dedicada [Image Service](#image-service). Resumen: Sharp + Railway Object Storage; públicos sin original permanente; Express no sirve bytes de imágenes managed nuevas; identity PRIVATE/SENSITIVE; `OptimizedImage` en FE; `/uploads` solo legacy.
- Tests: `npm run test -w @nocta/api` (imágenes, storage y producto: auth, presencia, swipe, match, premium) · `npm run test:e2e -w @nocta/api` · `npm run test -w @nocta/web`.

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
4. **Railway Object Storage** es el storage de producción (`STORAGE_DRIVER=railway|auto|memory`). En local, si el bucket responde 403, usá `memory`.
5. **`STORAGE_DRIVER=memory` + Atlas:** los blobs se persisten en `apps/api/.data/memory-storage` (o `MEMORY_STORAGE_DIR`) para que las fotos no desaparezcan al reiniciar la API. `MEMORY_STORAGE_DIR=0`/`off` = solo RAM (tests/E2E).
6. **identity_verification** es PRIVATE/SENSITIVE (`admin_signed`, TTL 180d; no Discover/perfiles/JSON público). Staging multer en `tmp/upload-staging`, no en `private/`.
7. **`OptimizedImage`** es el componente público genérico del FE (web). Mobile usa `NoctaImage` + `resolveImageUri`.
8. **`/uploads` ya no acepta almacenamiento permanente nuevo** (Fase 11). Corpus residual + FE compat hasta cleanup confirmado.

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
- **Rate limits (en memoria):** upload 30/min · delete 40/min · sensitive 5/min por usuario (`IMAGE_RATE_LIMIT` → 429). El resto de la API: [Cupos de solicitudes](#cupos-de-solicitudes).

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

**Automático en producción (recomendado: Cron Railway, no in-process):**

1. En el servicio **API web**: dejar `IMAGE_LIFECYCLE_JOBS` **off** (no setear o `=0`) para no cargar CPU/RAM del request path con scheduler.
2. Crear un **Cron Job** en Railway (diario o cada 6h) con el mismo root del monorepo:
   ```bash
   npm run jobs:images -w @nocta/api -- --force
   ```
   (build previo: `npm run build -w @nocta/shared && npm run build -w @nocta/api` si el cron no reusa artefactos del deploy).
3. Solo si no hay Cron: `IMAGE_LIFECYCLE_JOBS=1` + opcional `IMAGE_LIFECYCLE_INTERVAL_MS=3600000` arranca `startImageLifecycleScheduler` in-process (mismo código; más costo en el dyno web).

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
| Fotos 404 / broken en UI | `diagnose:images` → `mongoWithoutObject`; logs `missing_object` | Con `STORAGE_DRIVER=memory` + Atlas: reiniciar la API sin persistencia borraba bytes (ahora se guardan en `apps/api/.data/memory-storage`). Remigrar/re-subir si el objeto ya faltaba; Railway sigue en 403 local |
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
3. Preferí **Cron Railway** → `npm run jobs:images -w @nocta/api -- --force`. Evitá `IMAGE_LIFECYCLE_JOBS=1` en el servicio API web (solo fallback).
4. `npm run diagnose:images -w @nocta/api` en staging → revisar findings; sin deletes auto.
5. Migración legacy completa o plan explícito; `/uploads` sigue read-only residual. **Retirar** `express.static /uploads` + proxy Vite solo tras **0 hits** `[legacy-uploads]` en prod (PR aparte).
6. Suite: `npm run test:all -w @nocta/api` + `npm run test -w @nocta/web`.

#### Rendimiento API (Railway)

- **Sin sleep** del servicio API (cold start malo para dating).
- Cache in-process de URLs firmadas (`signedUrlCache`; TTL ~80% de `STORAGE_SIGNED_URL_TTL_SECONDS`). Con CDN (`STORAGE_PUBLIC_BASE_URL`) las públicas no firman.
- Discover/matches usan proyecciones `.select()` / `.lean()` y resolución de fotos en batch.
- Build por servicio: API → `npm install && npm run build -w @nocta/shared && npm run build -w @nocta/api` (el web no debe construir la API).

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
OptimizedImage cae a /api/media/{id}?v=&f= (200 immutable; CDN pública sigue en 302)
```

| Variable | Rol |
|----------|-----|
| `STORAGE_PUBLIC_BASE_URL` | Origen CDN / custom domain delante del bucket (sin slash final) |
| `STORAGE_SIGNED_URL_TTL_SECONDS` | TTL firmas (fallback sin CDN + privados) |

**Cache:** objetos públicos en Storage llevan `Cache-Control: public, max-age=31536000, immutable` + `Content-Type` webp/avif. Privados: `private, no-store`. `GET /api/media/:id` con CDN estable responde 302 (`max-age=86400`); sin CDN (firma o memory) responde **200** con el mismo `Cache-Control` immutable y `ETag`, para que la URL estable no se vuelva a bajar. Web (`OptimizedImage`) guarda `/api/media`, `/uploads` y `/images` en Cache API `nocta-images-v1` (clave `nocta:{imageId}:{variant}:{format}`). Mobile (`NoctaImage`) usa expo-image `memory-disk` con `cacheKey` `nocta:{imageId}:{variant}:webp`, así una firma nueva no dispara otra descarga. `/uploads` legacy: `max-age=30d, immutable`.

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
| `POST` | `/api/auth/forgot-password` / `reset-password` | Reset por link. Body forgot: `{ email, client?: "web"\|"mobile" }` — `mobile` envía deep link `nocta://auth/reset-password?token=…` |

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
| `GET` | `/api/me/following` · `/api/me/followers` | Follows aceptados (máx. 10; `?limit=` · `?q=` · following `?type=user\|venue`) |
| `DELETE` | `/api/me/followers/:id` | Elimina a una persona de mis seguidores |
| `GET` | `/api/me/venues/owned` | Espacios donde soy `ownerId` |
| `GET` | `/api/me/promo-purchases` · `/api/me/promo-purchases/:id` | Promos compradas (QR). **No hay** endpoint de compra/canje en el MVP; las compras demo se crean en seed |
| `GET` | `/api/me/reviews` | Mis reseñas (`page`, `limit` default `MY_REVIEWS_PAGE_SIZE` = 5, `q`) |
| `PATCH` | `/api/me/settings` | `autoAcceptFollowRequests`, `showActivityToFollowers` (parcial; default `true`; legado `hideActivityFromFollowers` se interpreta al leer) |
| `GET` | `/api/me/blocked-users` | Usuarios bloqueados por la cuenta, paginados (`page`, `limit`) |
| `DELETE` | `/api/me/blocked-users/:id` | Desbloquea al usuario indicado |
| `GET` | `/api/me/reports` | Historial de denuncias propias, paginado (`page`, `limit`). Solo las del denunciante |
| `GET` | `/api/me/reports/:id` | Resultado de una denuncia propia (solo el denunciante) |
| `DELETE` | `/api/me/account` | Soft-delete (30 días de recuperación) con `{ confirmation: "Eliminar" }`; perfil invisible; no borra imágenes aún; protege la última cuenta admin activa |
| `POST` | `/api/me/account/restore` | Cancela el borrado pendiente dentro de los 30 días |
| `POST`/`DELETE` | `/api/venues/:id/follow` | Follow de Espacios (instantáneo) |
| `GET` | `/api/venues/:id/followers` | Seguidores del Espacio |
| `GET` | `/api/users/:id/venues` | Espacios públicos del organizador |

### Auth social (OAuth)

1. `GET /api/auth/oauth/:provider` → redirect al IdP (`google` \| `apple` \| `microsoft`). Query opcional `?client=mobile` para deep link nativo
2. Callback `GET` (Google/Microsoft) o `POST` (Apple) en `/api/auth/oauth/:provider/callback`
3. Exchange del `code` → **`upsertOAuthUser`** (`emailVerified: true`)
4. Si la cuenta está suspendida → `/login` (web) o `nocta://login` (mobile) con código y fechas de bloqueo
5. JWT → `{CLIENT_ORIGIN}/auth/callback?token=...` (web) o `nocta://auth/callback?token=...` (mobile; scheme = `MOBILE_APP_SCHEME`)
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
| `GET` | `/api/discover/likes` | Likes **recibidos** pendientes. Excluye bloqueados; `viewerPremium` + `canSeeLikes` (plan **4 AM+** con `see_likes`). Sin `canSeeLikes` **no** envía `user.id` ni `name` (salvo Heartshot); `user.photo` es URL firmada de teaser blur del servidor. Cada ítem trae `canRespond` si tenés presencia en ese `venueId` |
| `GET` | `/api/discover/likes/:likeId/teaser` | WebP blur generado en API (Sharp). Auth por firma HMAC (`exp`, `vid`, `sig`); no requiere Bearer. No expone `imageId` ni la foto nítida |
| `POST` | `/api/discover/swipe` | `{ toUserId, direction }` → `{ ok, match, likeAllowance }`; rechaza pares bloqueados; sin cuota → `429 LIKES_EXHAUSTED` |
| `POST` | `/api/discover/rewind` | Deshace el último swipe del espacio activo; si era like, borra match+mensajes y `refundLike`; nunca restaura perfiles bloqueados |

### Anuncios (Discover)

Anuncios insertados en el deck de Discover (client-side) cada **7–10** swipes de perfil. Like abre `/ads/:id`; pass saltea. Usuarios Premium con feature `no_ads` (todos los planes) no reciben anuncios.

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/ads/next` | Próximo anuncio ponderado (`weight`) o `{ ad: null }` si Premium con Sin anuncios / sin creatividades |
| `GET` | `/api/ads/:id` | Detalle del anuncio (landing) |

Seed demo: 3 creatividades vía `ensureDemoAds()` al sembrar / asegurar cuentas demo.

### Premium (Mercado Pago)

Planes `nocta_2am` / `nocta_4am` / `nocta_6am` con periodos 1 / 3 / 6 / 12 meses. Checkout = PreApproval MP; webhook sincroniza estado.

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/premium/plans` | Catálogo + periodos/precios (`currency` = `MP_CURRENCY`) |
| `POST` | `/api/premium/checkout` | `{ planId, periodMonths }` → `{ initPoint }` (redirigir a MP) |
| `GET` | `/api/premium/me` | `user` + `subscription` (active, plan, vigencia, features, `managedByMercadoPago`) |
| `GET` | `/api/premium/payments` | Historial paginado de cobros aprobados |
| `POST` | `/api/premium/cancel` | Cancela renovación (sigue hasta `premiumExpiresAt`) |
| `POST` | `/api/premium/pause` / `resume` | Solo suscripciones MP; `resume` puede devolver `NEEDS_CHECKOUT` |
| `POST` | `/api/premium/boost` | Consume un Boost del plan |
| `POST` | `/api/premium/webhook` | Webhook Mercado Pago (sin JWT) |

Env: `MP_ACCESS_TOKEN`, `MP_CURRENCY`, `MP_BACK_URL` (https pública; Mercado Pago rechaza `localhost`), `MP_WEBHOOK_SECRET?`. Mobile abre `initPoint` con `expo-web-browser`.

### Notificaciones

Inbox in-app con polling (sin WebSocket en v1). En Android, al crear el aviso también se manda un push de Expo si el teléfono registró un token (`POST /api/me/push-token`). Verificado el 17 oct 2026 en dos teléfonos con el APK de desarrollo (match y mensaje). Expo Go no recibe estos avisos: muestra el warning de SDK 53 y `ExpoTopicSubscriptionModule` ausente; el resto de la app sigue. Campana a la izquierda del Logout (user y admin). En mobile, la denuncia resuelta abre su resultado, la verificación abre Configuración, una solicitud de seguimiento abre Solicitudes, una solicitud de Espacio abre Registrar o reclamar y un Espacio del organizador abre su gestión. Likes, Discover, Espacios y Perfil abren esa pestaña. El toque del aviso del sistema usa el mismo destino. El panel de admin sigue en la web.

| Método | Ruta | Notas |
|--------|------|--------|
| `GET` | `/api/notifications` | Lista paginada (`page`, `limit`; default page size 10). Preview campana: `limit=5`. Purga leídas con +30 días |
| `GET` | `/api/notifications/unread-count` | Badge |
| `POST` | `/api/notifications/read` | `{ ids? }` o `{ all: true }` — al leer setea `expiresAt` (+30 días) |
| `POST` | `/api/me/push-token` | `{ token, platform: "android" }` registra el token de Expo. Requiere JWT |
| `DELETE` | `/api/me/push-token` | `{ token }` lo borra al cerrar sesión |

Env opcional: `EXPO_ACCESS_TOKEN` (cupo de envío en expo.dev). El archivo `google-services.json` vive en `apps/mobile` y no se commitea. Alta y rebuild: [Avisos nativos (Android)](#avisos-nativos-android).

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
| `GET` | `/api/matches` | Summaries (otro user, venue, lastMessage, `unreadCount`); `unreadChats` = chats con mensajes sin leer. Omite peers bloqueados |
| `GET` | `/api/matches/unread-count` | `{ chats }` para el badge del ícono Matches |
| `GET` | `/api/matches/:id/messages` | Thread (participantes; `403` si bloqueado). Marca el chat como leído para quien consulta |
| `POST` | `/api/matches/:id/messages` | `{ body }` máx 2000. Emite `message:new` por Socket.IO a la sala del match |
| `DELETE` | `/api/matches/:id` | Unmatch / disuelve el match (conserva mensajes del chat para auditoría) |
| `POST` | `/api/matches/:id/report` | `{ reason, details?, unmatch? }` (`unmatch` default `true`) → crea `Report` |
| `POST` | `/api/matches/:id/block` | Crea `Block` + disuelve **todos** los matches entre el par |

El mismo proceso HTTP expone Socket.IO en `/socket.io`. El handshake lleva el JWT (`auth.token`). El cliente entra con `chat:join` (solo si participa y no está bloqueado) y sale con `chat:leave`. El inbox de notificaciones sigue por polling.

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
| **Match** | users[2] ordenados, `pairKey` (`idA:idB`), venueId — unique `(pairKey, venueId)`. Una persona puede tener varios matches en el mismo Espacio |
| **Message** | matchId, senderId, body |
| **Notification** | userId, type, title, body?, href?, data, dedupeKey?, readAt, expiresAt (TTL 30 días tras leer) |

### Seed

`apps/api/src/seedData.ts` + `apps/api/src/pilotVenues.ts` (también `npm run seed`):

- Admin + **113 Espacios de Montevideo** (bar, pub, boliche, cervecería, concierto) con calle y pin geocodificado; promo “Promo Nocta” en **Jackson Bar**
- `syncPilotVenues()` en cada boot: limpia entradas antiguas sin organizador y hace upsert de los 113. Nunca borra Espacios registrados ni pisa datos editados por un Organizador.
- Dirección visible = calle; `location` queda en el catálogo (sin Nominatim en cada boot)
- Fotos de catálogo: la UI lee `apps/web/public/images/venues/{NombreEspacio}Img.webp` (URL `/images/venues/…`) a partir del nombre. Convención: PascalCase sin acentos ni signos + `Img.webp` (`Jackson Bar` → `JacksonBarImg.webp`, `Negroni` → `NegroniImg.webp`). Si falta el archivo, cae al placeholder. Una foto subida a `/uploads/` (organizador) pisa esa portada. La API también monta ese directorio en `GET /images/...` para mobile y clientes sin Vite.
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
- Mapas: CARTO raster `dark_all` + Leaflet (`VenueMap`, `LocationPickerMap`); configurar `VITE_CARTO_BASEMAPS_API_KEY` en `apps/web/.env.local` (mismas atribuciones OSM/CARTO). Mobile reusa la clave como `EXPO_PUBLIC_CARTO_BASEMAPS_API_KEY`
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

- Perfil: `ProfileActionButtons` (incluye cerrar sesión), `ProfileSettingsModal` (preferencias + Eliminar cuenta), `FollowRequestsModal`, `ProfileConnectionsModal`, `ProfileMyReviewsAccordion`, `FollowRequestProfileModal`, `DeleteAccountModal`
- Discover / venues: `DiscoverProfileDetail`, `VenueReviewsSection`, `VenueMap`, `LocationPickerMap`, `VenueTrustBadge`, `VenueFormFields`, `VenueClaimForm`, `VenueEvidenceFields`
- Misc: `AuthAtmosphere`, `PromoQrCode`, `PhotoLightbox`, `ToastProvider`, `NoctaWordmark`, `NoctaLoading` (Cargando con luna limaneon + anillos), `AppFooter`, `NotificationsBell`, `PremiumPackagesModal` / `PremiumPlanCards`, `AdminSearchSelect` (desplegable administrativo con búsqueda interna)

### Rutas UI

| Ruta | Pantalla |
|------|----------|
| `/login` · `/register` | Auth con escena Nocta. Tras enviar login, registro o recupero, `/auth/check` muestra Turnstile centrado y sigue con esa solicitud al verificar. Login local/OAuth informa suspensiones temporales o permanentes con fecha de inicio/fin; Apple/Microsoft deshabilitados (toast) |
| `/verify-email` | OTP 6 dígitos, pegado y reenvío con cooldown |
| `/auth/callback` | Recibe `?token=` post-OAuth |
| `/onboarding` | 6 pasos: datos + identidad + ubicación → estilo de vida → trabajo → búsqueda (1) + gustos → fotos (guardar) → Planazos (3 planes Premium; Omitir) |
| `/` | Landing pública (logo + Ingresar → `/login`). Con sesión completa redirige a `/venues` |
| `/venues` | Home de usuario. Cards 1/2/3 cols; strip “Publicado” con punto rojo que pulsa + CTA Discover; CTA para solicitar un Espacio faltante; ícono verificado si hay `ownerId` |
| `/venues/:id` | Foto + mapa CARTO/Leaflet (`col-12` / `col-md-5` en desktop; en mobile el mapa va bajo el hero); reseñas y CTA; ícono de organizador al lado del nombre. Mobile nativo: mapa al final del detalle (`VenueMap`) |
| `/venues/:id/manage` | Organizador: descripción, seguidores, acceso a edición, noticias, promos y Mercado Pago “próximamente” |
| `/venues/:id/edit` | Edición separada del Espacio: identidad, País/Ciudad, mapa, descripción y reemplazo opcional de portada |
| `/likes` | Likes recibidos pendientes: plan **4 AM+** ve foto/nombre + Discover; free / 2 AM teaser blur del servidor + modal Premium; grilla 2 cols en mobile |
| `/muro` | Redirect a `/venues` (pantalla retirada) |
| `/discover` | Sin presencia: portada con órbitas. Clone (varias): “Elegí un Espacio” y tarjetas. Con una elegida: swipe (← pass / → like / ↑ Heartshot). Botones: pass rojo, like lima, Heartshot violeta; rewind y seguir. Header: Boost con pulso lima si está ON, y píldora roja para dejar de publicar en ese Espacio. Cada foto muestra un dato del perfil (busca, sobre mí, gustos, altura, trabajo, vive en, orientación e idiomas, zodíaco, estilo de vida, redes). Sin más perfiles: “Deck completo”. Cada 7–10 swipes (sin `no_ads`) inserta un anuncio: like → `/ads/:id`. **Imágenes:** 1 foto activa (thumb/medium) + preload de la siguiente |
| `/ads/:id` | Landing del anuncio (imagen, copy, CTA externo o in-app) |
| `/report/:userId` | Formulario protegido para denunciar un perfil por motivo y detalles |
| `/reports/:reportId` | Resultado de una denuncia propia (descarte o medidas aplicadas) |
| `/matches` | Vacío animado o lista/grilla; badge de mensajes sin leer antes del menú (eliminar / denunciar / bloquear). El ícono Matches muestra cuántos chats tienen sin leer |
| `/matches/:id` | Chat de texto, para coordinar. En desktop (≥992): perfil a la izquierda (carrusel de fotos, datos, eliminar match / bloquear / denunciar al final del scroll) y conversación a la derecha. Unmatch conserva mensajes para auditoría |
| `/notifications` | Inbox completo (10 por página); campana muestra las últimas 5 + Ver más |
| `/premium` | Sin plan: marketing (órbita 2/4/6 AM + “Ver planes”). Con plan: dashboard (stats, beneficios, pausar/cancelar, historial MP). Modal `PremiumPackagesModal` para contratar/cambiar. El “Desde …/mes” de cada tarjeta es el periodo más barato (hoy, el anual ÷ 12) y la tarjeta lo aclara. Mobile: `PremiumScreen` + `PremiumPackagesSheet` |
| `/profile` | Hero + galería; Mis reseñas; contadores; **Visible en** una sola frase con los Espacios activos (hasta 3 con Clone); Mis promos / Mis espacios; cuatro acciones (configuración, solicitudes, editar, **cerrar sesión**); footer con el email; **Eliminar cuenta** desde Configuración (confirmación escrita); acceso al dashboard si es admin; **único sitio con AppFooter** |
| `/profile/blocked` | Lista paginada de usuarios bloqueados con opción para desbloquear |
| `/profile/reports` | Historial de denuncias propias. Cada fila abre `/reports/:id` |
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
- **`OptimizedImage`** (`components/OptimizedImage.tsx`): único componente para fotos PUBLIC (perfil, Espacios, promos/news, reviews, Discover). `<picture>` AVIF→WebP + srcset en CDN pública; prop `variants` para limitar (swipe: thumb+medium); `/api/media`, `/uploads` y `/images` se leen una vez y quedan en Cache API (`src/lib/imageCache.ts`); lazy + `decoding="async"`; fallback ante error. **No** usar en identity_verification.
- Proxy Vite: `/api` y `/uploads` → `http://localhost:4000` (solo legacy/local)
- Producción (p. ej. Railway, web y API en dominios distintos):
  - Web: `VITE_API_URL=https://…api…` y **redesplegar** (Vite incrusta el env en el build)
  - API: `CLIENT_ORIGIN=https://…web…`, `API_PUBLIC_URL=https://…api…` (absolutiza fotos en JSON)
- Espacios: `page` / `limit` / `type` / `q` + IntersectionObserver
- Matches: `DELETE /api/matches/:id`, `POST .../report`, `POST .../block`
- Chat desktop: `GET /api/users/:id` para galería y datos del perfil en el panel del match
- Scrolls de UI: sin barra visible; sombreado en el extremo si hay más contenido (`OverflowFade`)

---

## Mobile (Android / Expo)

> Actualizar esta sección al agregar pantallas, env, emulador o builds EAS de `apps/mobile`.
> Documento vivo del flujo local en **Windows + emulador Android + Expo Go**. No hace falta un README paralelo en `apps/mobile`.

App: `apps/mobile` (workspace `@nocta/mobile`). La web (`npm run dev:web`) **no** es necesaria para desarrollar mobile; sí la **API**.

### Stack

- Expo SDK 57 + React Native + TypeScript
- React Navigation (stack + tabs); tab bar custom con FAB Discover (espejo web mobile)
- JWT en `expo-secure-store`; cliente HTTP en `src/lib/api.ts` (`EXPO_PUBLIC_API_URL`)
- Tipos/constantes: `@nocta/shared` (no se comparte UI con Bootstrap)
- UI: tokens alineados a `theme.css` (lima `#d6ff4b`, canvas `#0a0a0b`); Syne + Outfit; `NoctaLoading` / `ui.tsx`
- Gestos Discover: `react-native-gesture-handler` + `react-native-reanimated`
- Imágenes: `NoctaImage` + `resolveImageUri` / `mediaUrl` — CDN/https tal cual; `/uploads`, `/api/media` y catálogo `/images/...` vía API; reescribe `localhost` → host del emulador; portadas de Espacios usan `venueCoverSrc` + `VENUE_PHOTO_FALLBACK` si falta el asset. Cache en disco y memoria (`cachePolicy="memory-disk"`, `imageDiskCacheKey`) para no re-descargar la misma foto.
- Deep links: scheme `nocta://` (reset password, OAuth callback)
- Wordmark: `src/components/NoctaWordmark.tsx` (Syne 800 + luna limaneon)
- Feedback: `useToast()` nativo (regla `.cursor/rules/mobile-android.mdc`)
- Mapas: `react-native-webview` + Leaflet/CARTO (`VenueMap`); clipboard: `expo-clipboard`; checkout Premium: `expo-web-browser`
- Mapas en detalle de Espacio: tiles CARTO dark; clave `EXPO_PUBLIC_CARTO_BASEMAPS_API_KEY` = misma que `VITE_CARTO_BASEMAPS_API_KEY` en web; geocode Nominatim si no hay `location`; al final del detalle
- Backlog de paridad diferida: [`apps/mobile/BACKLOG-PARIDAD-WEB.md`](apps/mobile/BACKLOG-PARIDAD-WEB.md)

### Requisitos (una vez)

1. **Node 20+**, JDK **17** (builds nativos), **Android Studio** + Android SDK + al menos un AVD (API 34+)
2. **Expo Go** en el emulador (o Dev Client vía EAS)
3. Repo en ruta local **fuera de OneDrive** (ej. `C:\dev\Nocta`). Si Metro falla con `Failed to construct transformer` / `EINVAL readlink` / pantalla blanca: sacar el repo de OneDrive, borrar `node_modules` y `npm install`
4. En la raíz del monorepo: `npm install`
5. Env mobile:
   ```powershell
   copy apps\mobile\.env.example apps\mobile\.env
   ```

### Variables de entorno (`apps/mobile/.env`)

| Variable | Emulador | Dispositivo físico |
|----------|----------|--------------------|
| `EXPO_PUBLIC_API_URL` | `http://10.0.2.2:4000` (default) | `http://<IP-LAN-PC>:4000` (ej. `http://192.168.1.10:4000`) |
| `EXPO_PUBLIC_CARTO_BASEMAPS_API_KEY` | Misma clave que `VITE_CARTO_BASEMAPS_API_KEY` en web | Igual |
| Project id EAS | En `app.config.ts` → `extra.eas.projectId` | Igual. No va en `.env` |

`10.0.2.2` es el alias del emulador Android hacia el `localhost` del host. No uses `localhost` ni `127.0.0.1` desde la app en el emulador.

`extra.eas.projectId` está fijo en `app.config.ts` (proyecto `@clissic/nocta`). EAS no puede escribir ese archivo porque la config es dinámica, y no lee un `EAS_PROJECT_ID` del `.env`. Un projectId inventado hace que Expo Go pida *Log in / Proceed anonymously* en cada reload y robe el stdin de Metro.

Opcional API (media absolutizada): en local suele bastar `API_PUBLIC_URL=http://localhost:4000`. Para OAuth en emulador ver [OAuth Google (mobile)](#oauth-google-mobile).

### Emulador Android (Windows)

`emulator` suele **no** estar en el PATH. Usá la ruta del SDK (default):

```powershell
# Listar AVDs
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -list-avds

# Arrancar (recomendado: Medium Phone; ocupa menos pantalla que Pixel_10)
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Medium_Phone_API_37.0

# Alternativa más grande
& "$env:LOCALAPPDATA\Android\Sdk\emulator\emulator.exe" -avd Pixel_10
```

Si el SDK está en otra carpeta: Android Studio → **Settings → Languages & Frameworks → Android SDK → Android SDK Location**, y reemplazá la base de la ruta.

**PATH opcional (sesión actual):**

```powershell
$env:Path += ";$env:LOCALAPPDATA\Android\Sdk\emulator;$env:LOCALAPPDATA\Android\Sdk\platform-tools"
emulator -list-avds
```

**Sin CLI:** Device Manager / Virtual Device Manager de Android Studio → ▶ en el AVD. No hace falta dejar el IDE abierto después.

**Tamaño de ventana:** el flag `-scale` está **obsoleto** (emulator 37+ lo ignora). Achicá arrastrando el borde de la ventana, o usá un AVD más chico (`Medium_Phone_API_37.0`).

**No hace falta** abrir Android Studio completo en cada sesión: solo el emulador (CLI o Device Manager).

### Flujo diario de desarrollo

Dos terminales en `C:\dev\Nocta` (+ el emulador):

| Paso | Acción |
|------|--------|
| 1 | `npm run dev:api` → esperar `Nocta API en http://localhost:4000` (`/health` OK) |
| 2 | Arrancar el AVD (comando de arriba o Device Manager) → home Android |
| 3 | `npm run dev:mobile` (o `npm run dev:mobile -- -c` para limpiar caché Metro) |
| 4 | En la terminal de Metro (con foco): tecla **`a`** → abre en Expo Go / emulador |

Smoke demo: `sofia@nocta.app` / `Demo1234!` → Espacios → publicar presencia → Discover (Jackson Bar). Otras demos: ver [Credenciales demo](#credenciales-demo).

### OAuth Google (mobile)

Flujo: botón Google → `expo-web-browser` → `GET /api/auth/oauth/google?client=mobile&returnUrl=<Linking.createURL>` → Google → callback API → vuelve al `returnUrl` con `?token=…` (en Expo Go es `exp://…/--/auth/callback`; en build nativo puede ser `nocta://…`). Sin `returnUrl` compatible el browser del emulador suele quedar en “cargando” tras elegir la cuenta.

Mismos `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` que la web (`apps/api/.env`).

#### Google Cloud Console

1. [APIs y servicios → Credenciales](https://console.cloud.google.com/apis/credentials) → cliente OAuth **Aplicación web**.
2. Distinguí los dos campos:
   - **Orígenes de JavaScript autorizados** — solo origen, **sin path** (ej. `http://localhost:4000`).
   - **URIs de redirección autorizados** — URL **completa** del callback.
3. Redirects válidos típicos:
   ```
   http://localhost:4000/api/auth/oauth/google/callback
   https://<tu-api-prod>/api/auth/oauth/google/callback
   ```
4. **No uses** `http://10.0.2.2:…` ni IPs privadas (`192.168.x.x`) como redirect: Google las rechaza (*debe terminar con un dominio público* / *Dominio privado principal*).

#### Emulador Android (recomendado: `adb reverse`)

Google solo acepta `localhost` en local; el navegador del AVD no llega solo a la API del host. Solución:

1. Emulador prendido. En PowerShell (cualquier carpeta):
   ```powershell
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" devices
   & "$env:LOCALAPPDATA\Android\Sdk\platform-tools\adb.exe" reverse tcp:4000 tcp:4000
   ```
   Si `devices` muestra `emulator-…. device` y el reverse no falla, listo.
2. En `apps/api/.env`: `API_PUBLIC_URL=http://localhost:4000` (y el redirect `localhost` ya registrado en Google).
3. Reiniciá la API (`npm run dev:api`) y probá Continuar con Google en la app.

Repetí el `adb reverse` si reiniciás el emulador o se desconecta adb.

#### Dispositivo físico

`API_PUBLIC_URL` con un host que Google acepte (p. ej. tunnel tipo ngrok/`*.railway.app`) y ese mismo URL como redirect en la consola. Las IPs LAN suelen ser rechazadas por Google igual que `10.0.2.2`.

### Atajos Metro / Expo

| Tecla / acción | Efecto |
|----------------|--------|
| `a` | Abrir Android |
| `r` | Reload de la app |
| `j` | Debugger |
| `?` | Ayuda |
| Ctrl+C | Parar Metro (si no hay menú interactivo encima) |

Recargar preferí **`r`** en Metro o el menú de desarrollo del emulador. El Reload de herramientas de Expo Go puede re-disparar prompts de cuenta.

### Troubleshooting Metro / Expo Go

| Síntoma | Qué hacer |
|---------|-----------|
| Prompt *Proceed anonymously* / *Log in* y la terminal no scrollea ni responde `r`/`a` | Ese menú de flechas captura el stdin. Enter → *Proceed anonymously*, o `npx expo login` (misma cuenta en Expo Go). El `projectId` de `app.config.ts` tiene que ser el real de EAS |
| Ctrl+C no mata Metro | El prompt interactivo atrapó la terminal. Cerrar la pestaña y matar el proceso del puerto **8081**, luego `npm run dev:mobile -- -c` |
| App no llega a la API | Emulador → `EXPO_PUBLIC_API_URL=http://10.0.2.2:4000`; API en `:4000`; reiniciar Metro tras cambiar `.env` |
| Mapa CARTO pide API key / tiles en blanco | Copiá la clave de `apps/web/.env.local` (`VITE_CARTO_…`) a `EXPO_PUBLIC_CARTO_BASEMAPS_API_KEY` en `apps/mobile/.env` y **reiniciá Metro** (no alcanza con `r`) |
| Foto de perfil desaparece tras reiniciar la API | Con `STORAGE_DRIVER=memory` + Atlas: re-subí una vez (persistencia en `apps/api/.data/memory-storage`). Si Railway 403, no uses `railway` hasta arreglar el bucket |
| Algunas portadas de Espacios en blanco / 404 `/images/venues/...` | Solo ~20 assets en `apps/web/public/images/venues`; la API sirve ese directorio en `GET /images/...`; el resto usa `VENUE_PHOTO_FALLBACK` (Unsplash) vía `NoctaImage` |
| `Unable to connect to adb daemon` al boot del AVD | Suele resolverse solo al iniciar `adb`; si el emulador queda offline, cerrarlo y volver a abrir |
| Google OAuth: redirect inválido / `10.0.2.2` rechazado | No registres IPs privadas en Google. Usá `localhost` + `adb reverse tcp:4000 tcp:4000` (ver [OAuth Google (mobile)](#oauth-google-mobile)) |
| OAuth abre Google pero falla el callback en emulador | `API_PUBLIC_URL=http://localhost:4000`, redirect localhost en Console, `adb reverse` activo, API reiniciada |

### Dispositivo físico

1. Mismo Wi‑Fi que la PC
2. `EXPO_PUBLIC_API_URL=http://<IP-LAN>:4000` en `apps/mobile/.env`
3. Firewall Windows: permitir Node en puertos **4000** y **8081**
4. API + `npm run dev:mobile` → QR en Expo Go
5. Opcional: `npx expo login` + misma cuenta en la app Expo Go

### Scripts / EAS

| Comando | Descripción |
|---------|-------------|
| `npm run dev:mobile` | Metro / Expo (`apps/mobile`) |
| `npm run android` | Expo → Android |
| `npm run dev:mobile -- -c` | Metro con caché limpia |
| `$env:EAS_NO_VCS=1; npx eas-cli build -p android --profile development` | APK de desarrollo, desde `apps/mobile`. El paquete npm es `eas-cli` |

Perfiles EAS: `development` (Dev Client + APK), `preview`, `production` (AAB). El project id está en `app.config.ts`.

### Avisos nativos (Android)

Funcionan en el APK de EAS. Expo Go no incluye el módulo nativo desde el SDK 53.

| Pieza | Dónde quedó |
|-------|-------------|
| Proyecto EAS | [@clissic/nocta](https://expo.dev/accounts/clissic/projects/nocta). Id `49230155-22fc-48ae-abf2-d81333188fe2` en `app.config.ts` → `extra.eas.projectId`. No va en `.env` |
| Paquete Android | `app.nocta.mobile` |
| Firebase | Proyecto `nocta-app-fb6f1`. `google-services.json` en `apps/mobile/` (gitignored) |
| Archivo en el build | Variable secreta `GOOGLE_SERVICES_JSON` en EAS (development, preview y production). `app.config.ts` la usa en el builder |
| Keystore | Generado por EAS. Nombre `Build Credentials f9KscSGun5`. Copia local `apps/mobile/@clissic__nocta.jks` (gitignored). No volver a subirlo por el formulario web |
| Clave de envío | FCM v1 en EAS: Google Service Account del proyecto Firebase. FCM Legacy y Play Store quedan vacíos |
| API del teléfono | En `eas.json`, perfil `development`, `EXPO_PUBLIC_API_URL` = IP LAN de la PC (`http://<IP>:4000`). `10.0.2.2` solo sirve en el emulador |
| Cupo Expo | `EXPO_ACCESS_TOKEN` en `apps/api/.env` (opcional) |

Rebuild, desde `apps/mobile`:

```powershell
$env:EAS_NO_VCS=1; npx eas-cli build -p android --profile development
```

`EAS_NO_VCS=1` hace falta en esta máquina: el pack de git local está dañado y `eas build` falla al clonar `file:///C:/dev/Nocta` (exit 128). Credenciales nuevas: `npx eas-cli credentials -p android`, perfil `development`. Para la clave de avisos, **Manage your Google Service Account Key for Push Notifications (FCM V1)** y después **Set up** → **Upload a new service account key**. El JSON sale de [Cuentas de servicio](https://console.firebase.google.com/project/nocta-app-fb6f1/settings/serviceaccounts/adminsdk) → Generar nueva clave privada. No es `google-services.json`.

### Pantallas MVP

| Área | Qué hay |
|------|---------|
| **Auth** | Login / register / forgot = panel + `NoctaWordmark`. Al enviar, una pantalla centrada muestra Turnstile (WebView, origen `localhost`) y sigue con esa solicitud al verificar. Register: reglas de contraseña, confirmar, términos (el enlace abre el documento), marketing. Verify / reset = `AuthAtmosphere`. OAuth Google vía `expo-web-browser` + `?client=mobile` (Apple/Microsoft = stub) |
| **Onboarding** | 6 pasos (parity web) + Planazos en carrusel horizontal (la tarjeta se centra al deslizar; beneficios completos, con explicación al tocar el ícono). El precio “Desde …/mes” es el del plan anual y la tarjeta lo aclara. Tocar una tarjeta abre Premium en los periodos de ese plan. Editar perfil reusa el flujo (`Onboarding` con `edit`) |
| **Barra superior** | Igual que la web en mobile: wordmark a Espacios, contador de Boost con pulso lima, campana con panel (últimas 5 + Ver más) y menú de cuenta desde la derecha (perfil, editar, configuración, Teleport con tuerca a sus opciones —si no hay Premium abre la compra de 2 A.M.—, Boost, Premium, Mis promos con QR, cerrar sesión). El pie abre Términos |
| **Tabs** | Espacios · Likes · Discover (FAB) · Matches · Perfil |
| **Espacios** | Listado full-bleed de la ciudad Teleport si está activa, o de la ciudad del catálogo más cercana al GPS (`POST /api/cities/nearest`). Sin permiso de ubicación no se listan Espacios. Punto rojo con pulso en “Publicado” / “Ahora”. **Detalle** parity web mobile: hero, follow, trust, reseñas, promos/noticias, publicar presencia (presets en una fila, mismo ancho), mapa CARTO al final |
| **Discover** | Swipe RNGH + Reanimated. Botones como la web: pass rojo, like lima, Heartshot violeta, rewind y seguir. Header: Boost (pulso si está ON) y píldora roja para dejar de publicar. Cada foto muestra el dato de perfil (busca, sobre mí, gustos, altura, trabajo, vive en, orientación e idiomas, zodíaco, estilo de vida, redes). El perfil ampliado repite la ficha completa: vive en, orientación, zodíaco, estudios, mascotas, bebidas, fitness, trabajo e idiomas, y permite bloquear o denunciar. Like de un anuncio abre su landing (imagen, copy y CTA). Clone: “Elegí un Espacio” con tarjetas. Sin más perfiles: “Deck completo”. Sin presencia: portada con órbitas |
| **Likes / Matches** | Grid de likes + gate Premium; matches + chat. El hilo carga el historial por REST y recibe cada mensaje nuevo por Socket.IO; si el socket no conecta, vuelve a consultar cada 8 s. El ícono Matches muestra cuántos chats tienen mensajes sin leer; cada fila, el badge de mensajes sin leer antes del menú. Chat de texto (para coordinar): header con avatar/venue, separadores de día, burbujas con hora, composer con ícono enviar |
| **Perfil** | Hero + galería 3×3; **Visible en** en una sola frase con los Espacios activos; acordeón Mis reseñas; Mis promos abre los QR; **Mis espacios** abre la gestión (ficha, noticias y promos); **Registrar espacio** abre el alta o la reclamación con mapa; acciones (settings, solicitudes, editar, cerrar sesión); email al final; Eliminar cuenta, bloqueados y Mis denuncias en Configuración; follows / conexiones; Notificaciones; Premium |
| **Premium** | Sin plan: marketing (órbita 2/4/6 AM). Con plan: dashboard (hero, stats, beneficios, pausar/cancelar, historial). Sheet de planes + periodos + checkout MP (`expo-web-browser`). El “Desde …/mes” de las tarjetas y de Planazos es el periodo más barato (hoy, el anual ÷ 12) y aclara el periodo |
| **Stack** | `VenueDetail`, `Chat`, `Notifications` (listado como la web: tarjeta, ícono, nombre en lima, hora, paginación), `Premium` (`planId?` desde settings), `Terms`, `MyPromos`, `UserReport`, `Ad` (`adId`), `ReportResolution` (`reportId`), `VenueRequest` (registrar o reclamar un Espacio, con mapa), `VenueManage` y `VenueEdit` (organizador: ficha, noticias y promos) |

### Pendiente en mobile

La lista viva está en [`PENDIENTES.md`](PENDIENTES.md). Tachá ahí cada ítem al cerrarlo. El historial de paridad con la web sigue en [`apps/mobile/BACKLOG-PARIDAD-WEB.md`](apps/mobile/BACKLOG-PARIDAD-WEB.md).

---

## Shared (`@nocta/shared`)

Tipos y catálogos usados por API, Web y Mobile:

- Catálogos: `LOOKING_FOR`, `INTERESTS`, `INTEREST_CATEGORIES`, `WORK_STATUS`, `GENDERS`, `VENUE_TYPES`, `SEXUAL_ORIENTATIONS`, `LANGUAGES`, `ZODIAC_SIGNS`, `EDUCATION_LEVELS`, `PETS`, `DRINKING`, `FITNESS`, `SOCIAL_NETWORKS`, `VENUE_COUNTRIES`, `VENUE_CITIES_BY_COUNTRY`, `PROFILE_COUNTRIES`, `OAUTH_PROVIDERS`, `REPORT_REASONS`, `VENUE_REQUEST_STATUSES`, `VENUE_REQUEST_REJECT_REASONS`, `FOLLOW_TARGET_TYPES`, `FOLLOW_REQUEST_STATUSES`, `PROMO_PURCHASE_STATUSES` (+ labels)
- Límites: `VENUES_PAGE_SIZE` (9), `REVIEWS_PAGE_SIZE`, `MY_REVIEWS_PAGE_SIZE` (5), `MIN/MAX_VENUE_RATING`, `MAX_REVIEW_BODY_LENGTH`, `MAX_REVIEW_PHOTOS` (3), portada de Espacio WebP (`VENUE_COVER_WIDTH/HEIGHT` = 1600×1200), `MAX_POST_BODY_LENGTH` (200), `MAX_POST_PHOTOS` (3), `MIN/MAX_PHOTOS`, `MIN/MAX_AGE`, `DAILY_LIKE_LIMIT` (50), `LIKE_RECHARGE_HOURS` (8)
- Actividad: `ACTIVITY_TYPES` + `ACTIVITY_TYPE_LABELS` (incluye `user_post_created`)
- Notificaciones: `NOTIFICATION_TYPES` + `NOTIFICATION_TYPE_LABELS`, `NOTIFICATION_READ_TTL_DAYS` (30), `NOTIFICATIONS_PREVIEW_LIMIT` (5), `NOTIFICATIONS_PAGE_SIZE` (10)
- Presencia: `PRESENCE_PRESETS` (24h / 48h / 1 semana / permanente)
- Premium: `PREMIUM_PLANS` / `PREMIUM_PERIOD_*`, `premiumDashboardFeatureItems`, `planHasFeature`, `isPremiumPlanDowngrade`, `maxActivePresencesForPlan`
- Zodíaco editorial: `ZODIAC_INSIGHTS`; geografía de Espacios: Uruguay, Argentina y Brasil habilitados; `DISPLAY_ADDRESS_HINT`
- Password / verify / upload: `PASSWORD_RULES`, `PASSWORD_HINT`, constantes de mail y multipart
- Timezone (`timezone.ts`): `timezoneFromCountry`, anclas de día civil para vigencia de promos
- Términos (`termsContent.ts`): `TERMS_SECTIONS`, `TERMS_VERSION`, `TERMS_UPDATED_LABEL` (web y mobile)
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
