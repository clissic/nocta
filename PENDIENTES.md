# Pendientes de Nocta

Lista viva de lo que **aún falta implementar**. Tachá el ítem al cerrarlo (`[x]`) y anotá la fecha al lado. No dupliques el detalle en el README: ahí solo va el enlace a este archivo.

Última revisión: 17 oct 2026.

## Cómo actualizarlo

- Un ítem = una tarea que todavía no está en el producto.
- Al terminarla, pasala a [Hecho](#hecho) con la fecha.
- Si aparece algo nuevo, agregalo en la banda que corresponda, no al final suelto.
- Fuera de alcance: el perfil al costado del chat (en el teléfono esas acciones ya están en el menú del match) y los medios en el chat. El chat es solo texto, para coordinar.

## Imprescindible

- [ ] Mercado Pago, cuando haya dominio público. Las credenciales ya están. Hasta entonces el checkout responde 502: `MP_BACK_URL` no puede ser `http://localhost:5173`. Con el dominio se prueba la vuelta (`/premium?status=success`) y que el webhook active el plan.
- [ ] Login con Google en un iPhone físico. El callback usa `API_PUBLIC_URL=http://localhost:4000` y Google rechaza una IP de la red local. Email y contraseña sí entran.

## Importante

- [ ] Reacciones e indicador de “escribiendo…” en el chat. Los mensajes siguen siendo solo texto.
- [ ] Elegir país y ciudad de Espacios sin Teleport. Sin Teleport la lista sale del GPS.

## Recomendable

- [ ] Cobro dentro de Play, al publicar la app. Hasta entonces Mercado Pago alcanza, igual que en la web.
- [ ] Muro de actividad.
- [ ] Preferencia de reduced-motion.
- [ ] OverflowFade nativo en listas largas.
- [ ] Panel de admin en el teléfono. Sigue solo en la web.
- [ ] OAuth Apple y Microsoft. Siguen en stub.
- [ ] Pasada de humo iOS repetible. El Dev Client de Android ya existe para los avisos.

## Hecho

Mové acá lo que salga de las listas de arriba.

- [x] 17 oct 2026 — Historial de denuncias propias. Configuración → Mis denuncias (web: `/profile/reports`; app: hoja en Configuración). Al abrir una se ve su resultado. `GET /api/me/reports`.
- [x] 17 oct 2026 — Lista de usuarios bloqueados. Está en Configuración (web: `/profile/blocked`; app: hoja desde Configuración), con desbloqueo. No va en el menú de cuenta.
- [x] 17 oct 2026 — Tests de producto en la API: auth, presencia, swipe, match y premium (`src/e2e/product.test.ts`, dentro de `npm run test -w @nocta/api`). Mobile sigue sin tests de UI.
- [x] 17 oct 2026 — Planazos abre el plan tocado. Cada tarjeta de la app navega a Premium con su `planId` y muestra los periodos de ese plan.
- [x] 17 oct 2026 — Cache de fotos de Espacios, perfiles y catálogo. Web en Cache API (`nocta-images-v1`); mobile en disco y memoria de expo-image. `GET /api/media` sin CDN responde 200 immutable. No requiere APK nuevo si Metro está conectado.
- [x] 17 oct 2026 — Tuerca de Teleport en el menú de cuenta de la web. Abre la configuración de Teleport; sin el plan, abre los planes.
- [x] 17 oct 2026 — Push nativo Android, verificado en dos teléfonos (match y mensaje). Expo Go no lo recibe. Credenciales y rebuild en el README, sección Avisos nativos.
- [x] 17 oct 2026 — Denunciar desde Discover y abrir la resolución (`UserReport`, `ReportResolution`).
- [x] 17 oct 2026 — Badge de identidad verificada en perfil, Discover y menú. El trámite sigue en Configuración.
