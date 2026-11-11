# BotBite Waiter API

API de **BotBite**, el mesero virtual por WhatsApp para restaurantes. Es la fuente de verdad del negocio y el backend del panel web ([botbite-waiter-app](https://github.com/DevCraftersEnterprise/botbite-waiter-app)).

- **Panel web:** restaurantes, sucursales, productos, menús, pedidos, personal y notificaciones de caja en tiempo real.
- **Mesero de WhatsApp:** un servicio en Node.js que mantiene Carlos, fuera de este repo. Ver [Mesero de WhatsApp](#mesero-de-whatsapp).
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
- [CI y ramas protegidas](#ci-y-ramas-protegidas)
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
| `lint:check` | ESLint sin corregir, como en la CI |
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
| `BOT_WEBHOOK_SECRET` | No | Firma de los avisos al servicio del mesero (mínimo 32 caracteres). Sin él no se envían |
| `CUSTOMERS_EXPORT_ENABLED` | No (apagado en producción) | `true` permite exportar clientes a CSV. Se enciende cuando el aviso de privacidad de BotBite cubra la exportación |
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
    ├── bot/          # API para el mesero: llaves, configuración y cuentas
    ├── bot-events/   # avisos firmados de la API al mesero
    └── health/
```

## Mesero de WhatsApp

La conversación con el comensal corre en el **servicio del mesero** ([cosunab/botbite-mesero](https://github.com/cosunab/botbite-mesero)), fuera de este repo, con n8n para tareas secundarias: QR con verificación de ubicación, pedidos, cuenta, pagos y facturas. La API no recibe mensajes de WhatsApp ni los envía.

La API guarda lo que debe durar (menú, cuentas, comandas y notificaciones) y el panel lo muestra en vivo por Socket.IO, en el namespace `/orders`.

**API del bot:** el mesero llama a `/v1/bot/*` con el header `X-BotBite-Key`. El límite es por llave (`THROTTLE_BOT_LIMIT`, 1000 por minuto), no por IP, porque el servicio del mesero atiende a todos los negocios desde la misma IP.
- Cada llave pertenece a una sucursal, y la sucursal siempre sale de la llave. Solo se guarda su hash y se muestra una sola vez.
- `GET /v1/bot/branch` devuelve la configuración y el catálogo. Responde con `ETag`: si el mesero envía `If-None-Match`, contesta `304` cuando nada cambió. Del restaurante trae también `logoUrl` y `privacyUrl` (null si no hay), y en `features` va `languages`: apagado, el bot atiende solo en español.
  - **Zona horaria:** `timezone` es de la sucursal. La usan el mesero, los pedidos y los reportes del panel. Se edita en los datos de la sucursal, aunque `bot-config` también la acepta.
  - **Horario del mesero:** va en `hours`, con la misma forma que `ordering.hours`. Vacío, atiende siempre. `dailyCloseTime` es aparte: el "Cierre del día".
  - **Comisión del mesero:** `commissionPct` es la comisión de BotBite en sus pagos (`marketplace_fee`, sobre el `amountDue`). 0 es sin comisión. Solo la cambia un admin, como `ordering.commissionPct`.
- `POST /v1/bot/orders` abre la cuenta con su primera ronda y `POST /v1/bot/orders/:code/rounds` agrega comandas. Reenviar el mismo `code` o `number` no duplica nada. La API pone los precios con el menú vigente.
- `PATCH /v1/bot/orders/:code` avanza la cuenta (`status`) o la entrega de un pedido pagado (`fulfillmentStatus`), uno a la vez. Con `bill_requested` aplica el monedero, y con `payment_link` guarda la propina y el `commissionPct` con que el bot generó el link, en mesas y en pedidos.
- Recoger y domicilio usan las mismas rutas: `POST /v1/bot/orders` con `type` (`pickup` o `delivery`), `delivery` (dirección, referencias, punto y costo de envío), `scheduledFor` y `commissionPct`, sin mesa. Se abren al generar el link, y `open` → `payment_link` aplica el monedero. Si el link vence, el bot manda `cancelled` y el saldo vuelve. Al pagarse quedan en `fulfillmentStatus: pending` y caja recibe un solo aviso, sin la dirección.
- `POST /v1/bot/payments` registra un pago aprobado: cierra la cuenta y abona el cashback. Reenviar el mismo `providerPaymentId` no lo procesa dos veces.
- `POST /v1/bot/invoices` registra una factura que FacturAPI ya timbró. Reenviar el mismo `providerInvoiceId` no la registra dos veces.
- `POST /v1/bot/daily-close` cierra las cuentas de WhatsApp que nadie pidió.
- `POST /v1/bot/customers/lookup` y `PATCH /v1/bot/customers` leen y guardan al comensal. El teléfono va en el cuerpo para que no quede en los logs. Los datos fiscales solo vienen con `includeTaxProfile: true`.
- `POST /v1/bot/notifications` manda avisos sueltos a caja. Con `eventId` (un UUID que el bot repite en cada reintento) no se duplican: el reintento responde 200 con `created: false`.
- `PATCH /v1/bot/ordering` con `{ "accepting": false }` pausa los pedidos cuando caja escribe *pausar*, y con `true` los reanuda. Responde 404 si la sucursal no tiene el modo pedidos activo.
- Las rutas están documentadas en Swagger, en `/docs`.

**Cuentas y comandas:** `orders` es la cuenta de una mesa y `order_rounds` sus comandas. Estados de la cuenta: `open` → `bill_requested` → `payment_link` o `with_waiter` → `paid` o `settled`. También `auto_closed` y `cancelled`. Estados de la comanda: `new` → `preparing` → `delivered`, o `cancelled`. El personal mueve las comandas, cobra las cuentas y abre sus propias cuentas desde el panel; las rondas de una cuenta de WhatsApp solo las agrega el bot.

**Pedidos (recoger y domicilio):** viven en `orders` con `type` `pickup` o `delivery`, sin mesa. La entrega va en `fulfillmentStatus`, aparte del estado de la cuenta: `pending` (pagado) → `preparing` → `on_the_way` (domicilio) o `ready` (recoger) → `delivered`. La visita se cuenta al pagar, no al abrir. No salen en Órdenes ni en el cierre diario: el panel los muestra en "Para entregar". En los indicadores del día (`GET /v1/orders/summary`) cuentan como cuenta hasta que se pagan y nunca como mesa abierta. La dirección y el punto solo se guardan en el pedido, nunca en el cliente, y `OrderingPrivacyService` los borra cada día a las 4:00 cuando el pedido cumple 30 días sin cambios. El costo de envío y la comisión se guardan como los cobró el bot.

**Monedero:** `restaurant_customers` guarda al comensal por restaurante y `wallet_movements` cada cambio de saldo. El saldo se comparte entre las sucursales de un restaurante y nunca entre restaurantes. El descuento se aplica una vez al pedir la cuenta, topado al saldo y al subtotal, y se devuelve si se cancela la cuenta o si una comanda cancelada deja la cuenta por debajo del descuento. El cashback se calcula sobre lo consumido, sin propina ni envío, y solo al pagar en línea.

**Pagos:** `payments` guarda todo pago aprobado, aunque no cuadre, porque el dinero ya entró: `approved` cerró la cuenta, `incomplete` llegó de menos y la cuenta sigue abierta, y `unmatched` no tiene cuenta o ya estaba cerrada. En los dos últimos caja recibe una alerta. Lo que se debía (`amount`) es consumo más propina más envío (`deliveryFee`). No se guarda la respuesta cruda de Mercado Pago porque trae datos del pagador.

**Facturas:** la API no timbra. El servicio del mesero timbra en FacturAPI y registra el resultado en `invoices`, que guarda lo que dice el CFDI (folio, UUID del SAT, RFC, razón social, uso, forma de pago y total sin propina) pero no el correo. Caja recibe un aviso por cada factura y una alerta si una cuenta recibe una segunda. Las facturas con error no se registran: el mesero avisa a caja con `POST /v1/bot/notifications`.

**Datos fiscales:** `customer_tax_profiles` guarda los datos del comensal por restaurante, solo si aceptó guardarlos y en la misma transacción que una factura timbrada. Una factura nueva con permiso los reemplaza, y `PATCH /v1/bot/customers` con `deleteTaxProfile: true` los borra de la base, sin `deletedAt`.

**Para entregar:** `GET /v1/orders/to-deliver?branchId=<id>` devuelve los pedidos pagados que faltan por entregar, con la dirección y el teléfono del cliente: primero los programados por su hora y los demás por la hora de pago. `PATCH /v1/orders/:id/fulfillment` con `{ status }` los avanza y le avisa al bot. Los ven el dueño, los admins y el personal de la sucursal.

**Cancelar un pedido pagado:** `POST /v1/orders/:id/cancel-paid`, solo el dueño o un admin, mientras no se haya entregado. Devuelve el saldo que se usó, quita el cashback ganado (sin dejar el monedero en negativo), manda una alerta a caja con el monto a reembolsar y avisa al bot con `order.cancelled`. Por ahora el reembolso en Mercado Pago se hace a mano; los totales del pedido no cambian.

**Cobros en el panel:** `GET /v1/orders/billing?branchId=<id>&date=YYYY-MM-DD` devuelve los pagos en línea y las facturas de un día en la zona horaria de la sucursal; sin `date`, los de hoy. Cada pago dice el tipo de cuenta (`orderType`) y si hay que reembolsarlo (`toRefund`: se aprobó, pero el pedido se canceló después). El panel no lo cuenta como cobrado. La ven el dueño, los admins y el personal de la sucursal.

**Avisos al mesero:** la API hace `POST <botBaseUrl>/portal-evento` con `{ type, branchId, restaurantSlug, branchSlug, occurredAt, data }`. Si `botBaseUrl` trae query (por ejemplo `?negocio=punto-de-union`), se conserva: `https://mesero/portal-evento?negocio=punto-de-union`. Los tipos son `round.status_changed`, `order.closed`, `order.fulfillment_changed`, `order.cancelled` y `catalog.changed`. `order.cancelled` sale cuando el dueño cancela un pedido pagado, con `orderCode`, `orderType`, `language`, `phone`, `refundAmount` y `providerPaymentId`. `order.fulfillment_changed` sale cuando caja mueve un pedido en "Para entregar" (no cuando lo mueve el bot), con `orderCode`, `orderType`, `fulfillmentStatus`, `language` y `phone`. Este último sale al cambiar productos, menús o categorías y al guardar el Mesero digital, la sucursal o el restaurante; no trae datos, así que el mesero vuelve a leer `GET /v1/bot/branch`. Son de mejor esfuerzo: se reintentan y, si el mesero no responde, solo se registra.

Para validarlos, el mesero recalcula el HMAC-SHA256 de `<X-BotBite-Timestamp>.<cuerpo>` con `BOT_WEBHOOK_SECRET` y lo compara con `X-BotBite-Signature: sha256=<hex>`.

**Configuración de la sucursal:** se edita en el panel, en la pantalla "Mesero digital".

| Método | Ruta | Quién |
| --- | --- | --- |
| `GET`, `PATCH` | `/v1/branches/:restaurantId/:branchId/bot-config` | Dueño o admin. Slug, `phone_number_id`, URL del mesero y funciones contratadas: solo admin |
| `GET`, `POST` | `/v1/branches/:restaurantId/:branchId/bot-keys` | Solo admin |
| `DELETE` | `/v1/branches/:restaurantId/:branchId/bot-keys/:keyId` | Solo admin |
| `GET` | `/v1/branches/:restaurantId/:branchId/ordering` | Dueño, admin o personal de la sucursal. `{ ordering: null }` si nunca se configuró |
| `PATCH` | `/v1/branches/:restaurantId/:branchId/ordering` | Dueño o admin. Activarlo, el número de pedidos y la comisión: solo admin |
| `PATCH` | `/v1/branches/:restaurantId/:branchId/ordering/accepting` | Dueño, admin o personal de la sucursal: el interruptor "Recibiendo pedidos" |
| `PATCH`, `DELETE` | `/v1/restaurants/:restaurantId/logo` | Dueño o admin. Sube (PNG, JPG o WebP; Cloudinary lo deja cuadrado) o quita el logo |

El aviso de privacidad del restaurante es `privacyUrl` en `PATCH /v1/restaurants/:restaurantId` (https; `null` lo quita). El bot muestra siempre el de BotBite y agrega este si existe.

**Modo pedidos:** `branch_ordering` guarda, por sucursal, lo que necesita el número de pedidos (recoger y domicilio con pago por adelantado): su número de WhatsApp, los tipos, la tarifa de envío, las zonas sin entrega, el horario, los pedidos programados, la comisión de BotBite y el interruptor "Recibiendo pedidos". El bot lo lee en `branch.ordering` de `GET /v1/bot/branch` (null si la sucursal no lo tiene) y comparte con el mesero la llave, la URL base y el catálogo. Para activarlo hacen falta el `phoneNumberId` y el teléfono, y para el envío a domicilio, las coordenadas de la sucursal. Un número de WhatsApp atiende una sola sucursal y un solo modo: no puede ser a la vez el del mesero y el de pedidos. Al guardar se manda `catalog.changed`.

**Slugs:** el del restaurante es único en la plataforma y sale de su nombre (`punto-de-union`). El de la sucursal sigue el estándar `<restaurante>-<sucursal>` (`punto-de-union-cocorit`): se genera al crearla y, si un admin lo cambia, debe empezar con el del restaurante. Cambiar el slug de un restaurante no renombra sus sucursales, porque el QR impreso y el webhook dependen de ellos.

**Mesas:** si la sucursal tiene lista de mesas, la API rechaza con `400` las que no están, vengan del bot o del personal, y guarda la mesa como está escrita en la lista (`a5` queda `A5`). Sin lista acepta cualquiera.

**QR:** el QR impreso abre `botbite.com.mx/m/<slug>`, que redirige a la página del mesero. Si la página del QR cambia de servidor, basta con cambiar la redirección en la landing; si cambia el slug, hay que generar e imprimir el QR de nuevo.
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

**Menú por CSV** (dueño o admin), un menú de sucursal por archivo:

| Método | Ruta | Uso |
| --- | --- | --- |
| `POST` | `/v1/menus/menu/:menuId/import/preview` | Qué se crearía y actualizaría, y los errores por fila y columna. No guarda nada |
| `POST` | `/v1/menus/menu/:menuId/import` | Guarda todo en una transacción; con un error, nada. Luego copia las fotos y avisa al mesero una vez |
| `GET` | `/v1/menus/menu/:menuId/export` | El menú en el mismo formato (UTF-8 con BOM) |

Columnas: `nombre, descripcion, categoria, precio, familia, recomendado, activo, foto_url`; `nombre`, `categoria` y `precio` son obligatorias. Acepta UTF-8 o Windows-1252, `,` o `;` y hasta 1,000 filas. El producto se busca por nombre sin distinguir acentos ni mayúsculas, y una celda vacía no cambia el valor. Las fotos (solo https) las descarga Cloudinary; si una falla, el producto se guarda sin ella.

**Clientes** (dueño o admin; el personal no), por restaurante:

| Método | Ruta | Uso |
| --- | --- | --- |
| `GET` | `/v1/restaurants/:restaurantId/customers` | Visitas, alta y última visita, gasto y ticket de las cuentas pagadas (sin propina), monedero y cashback ganado, promociones, estado y los 3 favoritos. Filtra por `status` y `promos`, busca por nombre o teléfono, ordena por cualquier columna y pagina. Trae los totales de arriba y el teléfono parcialmente oculto |
| `POST` | `/v1/restaurants/:restaurantId/customers/:id/phone` | El teléfono completo de un cliente |
| `GET` | `/v1/restaurants/:restaurantId/customers/export` | CSV con los mismos filtros. El teléfono completo solo de quien aceptó promociones; apagado si `CUSTOMERS_EXPORT_ENABLED` no lo permite |

Estado: nuevo (1 visita), ocasional (2), recurrente (3 o más) e inactivo (más de 30 días sin venir), que manda sobre los otros. Ver un teléfono y exportar quedan en `audit_logs`: quién, cuándo, qué, en qué restaurante y cuántos registros, sin teléfonos ni nombres.

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
- ajustes del modo pedidos, sus permisos y el interruptor "Recibiendo pedidos";
- pedidos de recoger y domicilio: monedero, pago con envío, "Para entregar", cancelación sin pagar y borrado de direcciones;
- cancelación de pedidos pagados: saldo, cashback, alerta a caja y aviso al bot;
- cuentas, rondas y sus estados, con carga simultánea y reintentos;
- avisos firmados al mesero, contra un servidor local;
- notificaciones;
- WebSocket.

## CI y ramas protegidas

- **Ramas:** el trabajo se integra en `dev` (rama por defecto) y pasa a producción con un PR de `dev` a `main`.
- **CI** ([.github/workflows/ci.yml](.github/workflows/ci.yml)): en cada PR hacia `dev` o `main`, y en cada push a esas ramas, corre lint, las pruebas unitarias, el build y las e2e contra un Postgres 16 vacío. No usa secretos.
- **`dev` y `main` protegidas:** solo entra por PR y con el check `test` en verde. No se borran ni aceptan force-push, y la regla aplica también a los administradores.
- **Despliegue:** Render despliega `main`; `dev` no se despliega. Como solo entra lo que pasó la CI, lo que despliega ya está probado.

## Solución de problemas

| Síntoma | Causa probable |
| --- | --- |
| `Cannot find module '.../dist/main'` | Falta `npm run build` en el Build Command de Render |
| La app no inicia: `JWT_REFRESH_SECRET must be at least 32 characters` | Falta la variable o es demasiado corta |
| El panel no recibe notificaciones en tiempo real | El panel no envía el token en el WebSocket, o su origen no está en `CORS_ORIGINS` |
| `self-signed certificate` al conectar a la base | Define `DB_SSL_CA` con el certificado del proveedor |
