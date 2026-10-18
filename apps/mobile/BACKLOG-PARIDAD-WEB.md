# Backlog — paridad mobile ↔ web

Guía de lo **aún no implementado** (o parcial) en `apps/mobile` respecto al viewport mobile de la web. Tachá ítems al completarlos y mové notas a la sección Mobile del [README raíz](../../README.md).

Última revisión: 17 oct 2026. Lo que falta implementar, en orden, está en [`PENDIENTES.md`](../../PENDIENTES.md). Este archivo conserva el historial de paridad con la web.

## Diferido (fuera de este ciclo)

### Auth / cuenta
- [x] OAuth Google (mobile via `expo-web-browser` + `?client=mobile`) — Apple / Microsoft siguen stub
- [x] Términos / legal in-app (registro y pie del menú de cuenta)
- [ ] Menú de cuenta: la lista de bloqueados no es un ítem del drawer (está en Configuración)

### Notificaciones
- [x] Push FCM / Expo Notifications (Android, APK de desarrollo; Expo Go no lo recibe)
- [x] Campana + badge en la barra, panel (últimas 5) e inbox paginado
- [x] Destinos nativos: denuncia resuelta, verificación (Configuración), solicitud de seguimiento, solicitud de Espacio, likes/discover/espacios/perfil. Sigue en la web: panel admin

### Premium
- [x] Pantalla Premium parity web (marketing + dashboard + sheet de planes)
- [x] Cancelar / pausar / reanudar + historial de pagos in-app
- [ ] IAP Play Billing (hoy: checkout Mercado Pago vía `expo-web-browser`)
- [x] Indicador de Boost en la barra (contador con pulso) y en Discover (ON con pulso)

### Discover / dating
- [x] Perfil ampliado / detalle tipo `DiscoverProfileDetail` web
- [x] Safety modal / reportar usuario desde Discover
- [x] Página Ads dedicada (`/ads/:id`)
- [x] Vacíos de Discover con órbitas (sin presencia y “Deck completo”)
- [ ] Preferencia reduced-motion

### Espacios
- [x] Detalle de Espacio parity web mobile (hero, follow, trust, reseñas, promos/news, publicar)
- [x] Mapa embebido en detalle (Leaflet + CARTO vía WebView; al final del scroll)
- [x] Picker de ubicación (registrar / reclamar Espacio)
- [x] Gestionar Espacio (`/venues/:id/manage`: ficha, noticias, promos)
- [x] Claim / venue-request
- [x] QR de promos compradas (Mis promos)
- [x] Promos del organizador (gestionar)
- [ ] Filtros geográficos avanzados (país/ciudad UI completa)

### Social / perfil
- [x] Settings sheet (rogue/teleport, plan pills → Premium, etc.)
- [x] Follow requests sheet
- [x] Conexiones (seguidores / siguiendo / Espacios)
- [x] Edición de perfil vía onboarding 6 pasos (`edit`)
- [x] Galería 3×3 + hero
- [x] Bloqueados en Configuración (hoja con lista y desbloqueo). No va en el menú de cuenta
- [x] Denunciar desde Discover, ver la resolución (`UserReport`, `ReportResolution`) y el historial propio en Configuración → Mis denuncias
- [ ] Muro de actividad
- [ ] Identidad verificada como trámite visible. El badge ya está en perfil, Discover y menú; el pedido vive en Configuración

### Chat
- [x] UI conversación parity web mobile (header avatar+venue, day seps, burbujas+hora, composer ícono)
- [x] Panel perfil del match — no se replica: en la web solo existe en desktop (≥992) y en la app las acciones están en el menú del match
- [x] Socket.io realtime (historial por REST; polling de 8 s solo si el socket no conecta)
- [ ] Reacciones / typing. Sin medios: el chat es solo texto, para coordinar.

### Plataforma
- [ ] Panel admin
- [ ] OverflowFade nativo en listas largas
- [ ] iOS parity smoke (ciclo actual priorizó Android)
- [x] Dev Client Android (APK EAS) para avisos push. Expo Go no alcanza
- [ ] Dev Client / humo en iOS

## Completado en este ciclo (referencia)

- Tokens lima `#d6ff4b`, canvas/panel/texto alineados a `theme.css`
- Tipografías Syne + Outfit
- `NoctaLoading`, UI kit (Button/Field/Chip/Empty/ScreenHeader)
- Tab bar custom + FAB Discover
- Auth atmosphere (login/register/verify/forgot/reset) + OAuth Google
- Espacios full-bleed + **detalle parity** (follow, reseñas, promos, presencia, mapa CARTO)
- Discover swipe (RNGH + Reanimated), Heartshot, Boost con pulso, datos por foto, ficha ampliada completa, picker Clone, dejar de publicar, bloquear y denunciar, ads feed y landing del anuncio
- Likes grid + gate Premium
- Matches + Chat (REST al abrir, mensajes nuevos por Socket.IO)
- Perfil: galería 3×3, **Visible en** (una frase, hasta 3 Espacios), Mis reseñas, Mis promos (QR), registrar o reclamar Espacio (mapa + comprobantes), gestionar Espacio (ficha, noticias y promos), settings, conexiones, follow requests, Notificaciones
- Términos y Condiciones in-app (mismo texto que la web, en `@nocta/shared`)
- Onboarding 6 pasos + Planazos + editar perfil
- Premium: marketing / dashboard / sheet de planes + checkout MP + historial
- Env mobile: `EXPO_PUBLIC_CARTO_BASEMAPS_API_KEY` (misma clave CARTO que web)
- API local: `memory` storage con persistencia en `apps/api/.data/memory-storage`
