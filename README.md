# BotBite Waiter API

API de **BotBite**, el mesero virtual por WhatsApp para restaurantes, y backend del panel web ([botbite-waiter-app](https://github.com/DevCraftersEnterprise/botbite-waiter-app)).

- **Bot de WhatsApp (Twilio):** el comensal escanea el QR de la mesa, elige idioma, indica su mesa y pide en lenguaje natural, por texto o por nota de voz. El bot arma el carrito, confirma el pedido, avisa a caja y cierra la cuenta.
- **Panel web:** restaurantes, sucursales, productos, menús, pedidos, personal y notificaciones de caja en tiempo real.
- **Multi-restaurante y multi-sucursal:** cada cliente solo ve y administra lo suyo.

**Stack:** NestJS 11 · TypeORM · PostgreSQL · Socket.IO · Twilio · OpenAI (traducciones y notas de voz) · Cloudinary.

## Índice
- [Puesta en marcha](#puesta-en-marcha)
- [Scripts](#scripts)
- [Variables de entorno](#variables-de-entorno)
- [Despliegue (Render + Neon)](#despliegue-render--neon)
- [Arquitectura](#arquitectura)
- [Flujo del bot](#flujo-del-bot)
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

**Para probar el bot en local:**
1. Expón la API con un túnel (`ngrok http 3000` o `cloudflared`).
2. En Twilio, configura el webhook de WhatsApp en `https://<túnel>/v1/messages/webhook` (POST).
3. Define `TWILIO_WEBHOOK_BASE_URL=https://<túnel>`; si no, la firma no coincide detrás del túnel.

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
| `FRONTEND_URL` | No | URL del panel para los enlaces que envía el bot |
| `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME` | Sí | Conexión a PostgreSQL |
| `DB_SSL`, `DB_SSL_REJECT_UNAUTHORIZED`, `DB_SSL_CA` | No | SSL activo en producción y con verificación del certificado |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Sí | Mínimo 32 caracteres cada uno y distintos entre sí |
| `JWT_ACCESS_EXPIRY`, `JWT_REFRESH_EXPIRY` | No (`15m`, `7d`) | Formato `15m`, `1h`, `7d` |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` | Sí | Credenciales de Twilio |
| `TWILIO_VALIDATE_SIGNATURE` | No (`true`) | Solo desactivar en local |
| `TWILIO_WEBHOOK_BASE_URL` | No | URL pública exacta que Twilio llama, si la firma falla detrás de un proxy |
| `OPENAI_API_KEY` | Sí | Traducción de descripciones y transcripción de notas de voz |
| `CLOUDINARY_*` | Sí | Imágenes de productos, QR y PDF de menús |
| `THROTTLE_*`, `RATE_LIMIT_*` | No | Límites de la API y de mensajes de WhatsApp por cliente |

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
    ├── messages/     # bot de WhatsApp: webhook, cola, flujo, notificaciones, WebSocket
    ├── openai/       # traducción y transcripción
    └── health/
```

## Flujo del bot

1. Twilio llama a `POST /v1/messages/webhook`. Se valida la firma `X-Twilio-Signature` y el `AccountSid`.
2. El mensaje se registra por `MessageSid` (los reintentos de Twilio se descartan), se encola y se responde de inmediato con TwiML vacío.
3. La cola procesa en orden los mensajes de cada cliente, y en paralelo los de clientes distintos.
4. Máquina de estados por cliente y sucursal:

   ```
   QR de la mesa → idioma → mesa/ubicación → flujo principal
   ```

   El flujo principal no usa IA: reglas, palabras clave y búsqueda difusa tolerante a errores. Cubre:
   - menú (PDF), información y fotos de platillos, recomendaciones y consumo;
   - pedido de varios productos con cantidades y notas ("sin cebolla");
   - confirmación (avisa a caja), amenidades y cuenta (avisa a caja y guarda el pedido).
5. Las respuestas salen por la API de Twilio y caja recibe el aviso por WhatsApp y en el panel (Socket.IO, namespace `/orders`).

Cada respuesta del flujo principal consume un **crédito de mensaje** de la sucursal. Los créditos los asigna un admin y, sin saldo, el bot deja de responder.

## Roles y permisos

| Rol | Alcance |
| --- | --- |
| `super`, `admin` | Todos los restaurantes. Solo ellos asignan créditos y activan o desactivan restaurantes, sucursales y productos |
| `client` | Dueño: solo sus restaurantes, sucursales, productos, menús y pedidos |
| `user` | Cajero o mesero: **solo lectura** de las sucursales que tiene asignadas (restaurantes, sucursales, pedidos, conversaciones y notificaciones, que sí puede marcar como atendidas) y el WebSocket de su sucursal |

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

**Hoy (una instancia):**
- El webhook responde en milisegundos y el procesamiento ocurre en segundo plano.
- Los mensajes de clientes distintos se atienden en paralelo. Los de un mismo cliente van en orden, porque su conversación es una máquina de estados.
- La creación de conversaciones, los créditos y el registro de mensajes son atómicos en la base, así que no hay pedidos duplicados ni créditos perdidos con mensajes simultáneos.
- La prueba e2e `concurrency` simula **10 comensales pidiendo al mismo tiempo en la misma sucursal** (60 mensajes) y verifica que cada uno reciba sus respuestas, que se creen 10 pedidos correctos y que se descuenten exactamente 30 créditos.

**Límites actuales:**
- La cola y los límites de peticiones viven en memoria. Con más de una instancia, cada una lleva su propia cuenta, y si el proceso se reinicia se pierden los mensajes que estaban en cola.
- Cada mensaje vuelve a cargar la sucursal con su menú completo.

**Siguientes pasos, en orden de impacto:**
1. **Cola con Redis + BullMQ** y un proceso *worker* separado. La cola sobrevive a reinicios y permite varias instancias.
2. **Socket.IO con `@socket.io/redis-adapter`** y **throttler con almacenamiento en Redis**, para escalar horizontalmente.
3. **Caché del menú por sucursal** (Redis o memoria con expiración), invalidada al editar productos o menús.
4. **Neon con pooling** y `max` del pool de TypeORM ajustado al plan.
5. **Twilio:** revisar el límite de mensajes por segundo del número de WhatsApp. Si se usa un sender por sucursal, la carga ya se reparte.
6. Observabilidad: logs estructurados, métricas de la cola y alertas.

## Pruebas

```bash
npm test                                  # unitarias
E2E_DB_PORT=5432 npm run test:e2e          # e2e (variables E2E_DB_*)
```

Las e2e levantan la app completa contra Postgres real, con el envío de Twilio simulado. Cubren:
- auth: rotación y reutilización de tokens, y logout;
- multi-tenant y personal;
- webhook firmado y flujo completo QR → pedido → cuenta;
- reintentos de Twilio;
- concurrencia y WebSocket.

## Solución de problemas

| Síntoma | Causa probable |
| --- | --- |
| `Cannot find module '.../dist/main'` | Falta `npm run build` en el Build Command de Render |
| La app no inicia: `JWT_REFRESH_SECRET must be at least 32 characters` | Falta la variable o es demasiado corta |
| Twilio responde 403 al webhook | La URL firmada no coincide: define `TWILIO_WEBHOOK_BASE_URL` |
| El panel no recibe notificaciones en tiempo real | El panel no envía el token en el WebSocket, o su origen no está en `CORS_ORIGINS` |
| El bot no responde en una sucursal | Sin créditos, sucursal o restaurante desactivados, o número del asistente distinto al configurado en Twilio (formato `+52…`) |
| `self-signed certificate` al conectar a la base | Define `DB_SSL_CA` con el certificado del proveedor |
