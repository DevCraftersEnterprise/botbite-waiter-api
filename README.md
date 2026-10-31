# BotBite Waiter API

API de **BotBite**, el mesero virtual por WhatsApp para restaurantes. Es la fuente de verdad del negocio y el backend del panel web ([botbite-waiter-app](https://github.com/DevCraftersEnterprise/botbite-waiter-app)).

- **Panel web:** restaurantes, sucursales, productos, menús, pedidos, personal y notificaciones de caja en tiempo real.
- **Mesero de WhatsApp:** corre en n8n, fuera de este repo. Ver [Mesero de WhatsApp](#mesero-de-whatsapp).
- **Multi-restaurante y multi-sucursal:** cada cliente solo ve y administra lo suyo.

**Stack:** NestJS 11 · TypeORM · PostgreSQL · Socket.IO · Cloudinary.

## Índice
- [Puesta en marcha](#puesta-en-marcha)
- [Scripts](#scripts)
- [Variables de entorno](#variables-de-entorno)
- [Despliegue (Render + Neon)](#despliegue-render--neon)
- [Arquitectura](#arquitectura)
- [Mesero de WhatsApp](#mesero-de-whatsapp)
- [Roles y permisos](#roles-y-permisos)
- [Concurrencia y escalabilidad](#concurrencia-y-escalabilidad)
- [Pruebas](#pruebas)
- [Solución de problemas](#solución-de-problemas)

## Puesta en marcha

Requisitos: Node.js 22+ y PostgreSQL 16+ (local con Docker o una rama de Neon).

```bash
npm install
cp .env.template .env          # completa los valores (ver abajo)
docker compose up -d db        # Postgres local, opcional
npm run migration:run
npm run start:dev
```

La API queda en `http://localhost:3000/v1` y el health check en `GET /v1/health`.

## Scripts

| Script | Uso |
| --- | --- |
| `start:dev` | Desarrollo con recarga |
| `build` / `start:prod` | Compilar y ejecutar `dist/main` |
| `migration:run` / `migration:revert` | Migraciones desde `src` (ts-node) |
| `migration:generate -- src/database/migrations/Nombre` | Generar una migración a partir de las entidades |
| `migration:run:prod` | Migraciones desde `dist` (requiere `build`) |
| `test` | Pruebas unitarias |
| `test:e2e` | Pruebas e2e contra Postgres. La base `E2E_DB_NAME` (por defecto `botbite_test`) **se borra** en cada corrida |
| `lint` / `format` | ESLint y Prettier |

## Variables de entorno

Se validan al arrancar ([src/config/env.validation.ts](src/config/env.validation.ts)): si falta una obligatoria, la app no inicia. La referencia completa está en [.env.template](.env.template).

| Variable | Obligatoria | Descripción |
| --- | --- | --- |
| `PORT`, `NODE_ENV` | Sí | `NODE_ENV=production` activa SSL en la base y las migraciones al arrancar |
| `CORS_ORIGINS` | En producción | Orígenes del panel separados por coma. Aplica a REST y WebSockets |
| `TRUST_PROXY` | No (1) | Número de proxies delante de la API (Render = 1) |
| `QR_BASE_URL` | No (`https://botbite.com.mx`) | Sitio que redirige `/m/<sucursal>` a la página QR del mesero |
| `DOCS_USER`, `DOCS_PASSWORD` | No | Acceso a Swagger en `/docs`. En producción no se publica sin ellas |
| `BOT_WEBHOOK_SECRET` | No | Firma de los avisos a n8n (mínimo 32 caracteres). Sin él no se envían |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | Sí | Conexión a PostgreSQL |
| `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`, `DB_SSL_CA` | No | SSL activo en producción y con verificación del certificado |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Sí | Mínimo 32 caracteres cada uno y distintos entre sí |
| `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY` | No (`15m`, `7d`) | Formato `15m`, `1h`, `7d` |
| `CLOUDINARY_*` | Sí | Imágenes de productos, QR y PDF de menús |
| `THROTTLE_*` | No | Límites de peticiones de la API |

Generar un secreto: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`.

## Despliegue (Render + Neon)

La API corre como **Web Service en Render** y la base de datos está en **Neon**.

### Render (Settings → Build & Deploy)

| Campo | Valor |
| --- | --- |
| Build Command | `npm ci --include=dev && npm run build` |
| Pre-Deploy Command | `npm run migration:run:prod` |
| Start Command | `npm run start:prod` |
| Health Check Path | `/v1/health` |

> Sin `npm run build` en el Build Command no existe `dist/main` y el despliegue falla con `Cannot find module '.../dist/main'`.

### Neon
- Usa el host **con pooling** (`ep-xxxx-pooler.<región>.aws.neon.tech`): Neon pone PgBouncer delante y la API puede abrir más conexiones sin agotar las de la base.
- `DB_SSL=true` con `DB_SSL_REJECT_UNAUTHORIZED=true`. El certificado de Neon es público y válido, así que no hace falta `DB_SSL_CA`.
- Si el proyecto tiene *scale to zero*, la primera consulta tras un rato sin uso tarda unos cientos de milisegundos más. En horario de servicio conviene desactivarlo o subir el tiempo de suspensión.
- Usa una **rama de Neon** para desarrollo y pruebas, nunca la de producción. Las pruebas e2e borran la base.

### Orden al desplegar cambios con migraciones
1. Respaldo o *branch* de la base en Neon (es instantáneo).
2. Merge a `main`: Render compila, corre las migraciones (pre-deploy) y despliega.
3. Revisa que `GET /v1/health` responda `{"status":"ok"}`.

Las ramas `v1` (versión anterior) y `main` (v2) se conservan en el repositorio.

## Arquitectura

```
src/
├── core/        # auth (JWT, guards, @Auth) y control de acceso por restaurante/sucursal
├── common/      # traducciones, subida de archivos, adaptador de Socket.IO, utilidades
├── config/      # configuración tipada y validación del entorno
├── database/    # conexión, data source de la CLI y migraciones
└── modules/
    ├── auth/         # login, refresh con rotación, logout
    ├── users/        # usuarios y roles
    ├── restaurants/  branches/  products/  categories/  menus/
    ├── orders/  customers/
    ├── notifications/ # notificaciones de caja y WebSocket (Socket.IO)
    ├── bot/          # API para el mesero de n8n: llaves, configuración y cuentas
    ├── bot-events/   # avisos firmados de la API a n8n
    └── health/
```

## Mesero de WhatsApp

La conversación con el comensal corre en **n8n**, fuera de este repo: QR con verificación de ubicación, pedidos, cuenta, pagos y facturas. La API no recibe mensajes de WhatsApp ni los envía.

La API guarda lo que debe durar (menú, cuentas, comandas y notificaciones) y el panel lo muestra en vivo por Socket.IO, en el namespace `/orders`.

**API del bot:** n8n llama a `/v1/bot/*` con el header `X-BotBite-Key`.
- Cada llave pertenece a una sucursal, y la sucursal siempre sale de la llave. Solo se guarda su hash y se muestra una sola vez.
- `GET /v1/bot/branch` devuelve la configuración y el catálogo. Responde con `ETag`: si n8n envía `If-None-Match`, contesta `304` cuando nada cambió.
- `POST /v1/bot/orders` abre la cuenta con su primera ronda y `POST /v1/bot/orders/:code/rounds` agrega comandas. Reenviar el mismo `code` o `number` no duplica nada. La API pone los precios con el menú vigente.
- `PATCH /v1/bot/orders/:code` avanza la cuenta y `POST /v1/bot/notifications` manda avisos sueltos a caja.
- Las rutas están documentadas en Swagger, en `/docs`.

**Cuentas y comandas:** `orders` es la cuenta de una mesa y `order_rounds` sus comandas. Estados de la cuenta: `open` → `bill_requested` → `payment_link` o `with_waiter` → `paid` o `settled`. También `auto_closed` y `cancelled`. Estados de la comanda: `new` → `preparing` → `delivered`, o `cancelled`. El personal mueve las comandas, cobra las cuentas y abre sus propias cuentas desde el panel; las rondas de una cuenta de WhatsApp solo las agrega el bot.

**Avisos a n8n:** la API hace `POST <botBaseUrl>/portal-evento` con `{ type, branchId, occurredAt, data }`. Los tipos son `round.status_changed`, `order.closed` y `catalog.changed`. Son de mejor esfuerzo: se reintentan y, si n8n no responde, solo se registra.

Para validarlos, n8n recalcula el HMAC-SHA256 de `<X-BotBite-Timestamp>.<cuerpo>` con `BOT_WEBHOOK_SECRET` y lo compara con `X-BotBite-Signature: sha256=<hex>`.

**Configuración de la sucursal:** se edita en el panel, en la pantalla "Mesero digital".

| Método | Ruta | Quién |
| --- | --- | --- |
| `GET`, `PATCH` | `/v1/branches/:restaurantId/:branchId/bot-config` | Dueño o admin. Slug, `phone_number_id`, URL de n8n y funciones contratadas: solo admin |
| `GET`, `POST` | `/v1/branches/:restaurantId/:branchId/bot-keys` | Solo admin |
| `DELETE` | `/v1/branches/:restaurantId/:branchId/bot-keys/:keyId` | Solo admin |

**QR:** el QR impreso abre `botbite.com.mx/m/<slug>`, que redirige a la página del mesero. Si n8n cambia de servidor, basta con cambiar la redirección en la landing; si cambia el slug, hay que generar e imprimir el QR de nuevo.

**Rutas temporales:** `GET /v1/messages/notifications`, `PATCH /v1/messages/:id/read` y `/unread` siguen respondiendo para no romper el panel mientras se despliega; las nuevas están en `/v1/notifications`. `GET /v1/messages/conversations` responde una lista vacía hasta que la pantalla de Órdenes use las cuentas nuevas.

## Roles y permisos

| Rol | Alcance |
| --- | --- |
| `super`, `admin` | Todos los restaurantes. Solo ellos activan o desactivan restaurantes, sucursales y productos |
| `client` | Dueño: solo sus restaurantes, sucursales, productos, categorías, menús y pedidos |
| `user` | Cajero o mesero: **solo lectura** de las sucursales que tiene asignadas (restaurantes, sucursales, pedidos y notificaciones, que sí puede marcar como atendidas) y el WebSocket de su sucursal |

El control de acceso está centralizado en [`AccessControlService`](src/core/access/access-control.service.ts). El personal no tiene acceso por defecto: cada ruta de lectura lo habilita explícitamente.

**Asignar personal a una sucursal** (dueño o admin):

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/v1/branches/:restaurantId/:branchId/staff` | Listar personal |
| `POST` | `/v1/branches/:restaurantId/:branchId/staff` | Asignar (`{ "email": "..." }`, cuenta con rol `user`) |
| `DELETE` | `/v1/branches/:restaurantId/:branchId/staff/:userId` | Quitar |

Las cuentas `user` las crea un admin (`POST /v1/users/register-user`).

**WebSocket:** la conexión requiere el access token.

```ts
io(`${apiUrl}/orders`, { auth: { token: accessToken } });
```

## Concurrencia y escalabilidad

**Hoy (una instancia):** la API atiende peticiones cortas y las conexiones de Socket.IO del panel.

**Límites actuales:** los límites de peticiones y las salas de Socket.IO viven en memoria. Con más de una instancia, cada una lleva su propia cuenta y los eventos no llegan a los clientes conectados a otra instancia.

**Siguientes pasos, en orden de impacto:**
1. **Socket.IO con `@socket.io/redis-adapter`** y **throttler con almacenamiento en Redis**, para escalar horizontalmente.
2. **Caché del menú por sucursal** (Redis o memoria con expiración), invalidada al editar productos o menús.
3. **Neon con pooling** y `max` del pool de TypeORM ajustado al plan.
4. Observabilidad: logs estructurados, métricas y alertas.

## Pruebas

```bash
npm test                                  # unitarias
E2E_DB_PORT=5432 npm run test:e2e          # e2e (variables E2E_DB_*)
```

Las e2e levantan la app completa contra Postgres real. Cubren:
- auth: rotación y reutilización de tokens, y logout;
- multi-tenant y personal;
- categorías por restaurante y slugs;
- configuración del mesero, llaves y `GET /v1/bot/branch`;
- cuentas, rondas y sus estados, con carga simultánea y reintentos;
- avisos firmados a n8n, contra un servidor local;
- notificaciones;
- WebSocket.

## Solución de problemas

| Síntoma | Causa probable |
| --- | --- |
| `Cannot find module '.../dist/main'` | Falta `npm run build` en el Build Command de Render |
| La app no inicia: `JWT_REFRESH_SECRET must be at least 32 characters` | Falta la variable o es demasiado corta |
| El panel no recibe notificaciones en tiempo real | El panel no envía el token en el WebSocket, o su origen no está en `CORS_ORIGINS` |
| `self-signed certificate` al conectar a la base | Define `DB_SSL_CA` con el certificado del proveedor |
