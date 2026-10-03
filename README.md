# BotBite Waiter API

API de BotBite: mesero virtual por WhatsApp (Twilio) para restaurantes, más el
backend del panel web (restaurantes, sucursales, productos, menús, pedidos y
notificaciones de caja en tiempo real).

Stack: NestJS 11 · TypeORM · PostgreSQL · Socket.IO · Twilio · OpenAI · Cloudinary.

## Puesta en marcha

```bash
npm install
cp .env.template .env        # y completa los valores
docker compose up -d db      # Postgres local (opcional)
npm run migration:run
npm run start:dev
```

API en `http://localhost:3000/v1`. El webhook de Twilio debe apuntar a
`https://<tu-dominio>/v1/messages/webhook`.

## Scripts

| Script | Uso |
| --- | --- |
| `start:dev` | Desarrollo con recarga |
| `build` / `start:prod` | Compilar y ejecutar `dist` |
| `migration:run` / `migration:revert` | Migraciones desde `src` (ts-node) |
| `migration:generate -- src/database/migrations/Nombre` | Generar migración a partir de las entidades |
| `migration:run:prod` | Migraciones desde `dist` (en producción también corren al arrancar) |
| `test` | Pruebas unitarias |
| `test:e2e` | Pruebas e2e: necesitan un Postgres; la base `E2E_DB_NAME` (por defecto `botbite_test`) **se borra** en cada corrida |
| `lint` | ESLint + Prettier |

## Variables de entorno

Ver [.env.template](.env.template). Se validan al arrancar ([src/config/env.validation.ts](src/config/env.validation.ts)); la app no inicia si falta alguna obligatoria. Importantes en producción:

- `JWT_SECRET` y `JWT_REFRESH_SECRET`: distintos y de al menos 32 caracteres.
- `CORS_ORIGINS`: orígenes del panel web (aplica también a los WebSockets).
- `TRUST_PROXY`: número de proxies delante de la API.
- `TWILIO_VALIDATE_SIGNATURE=true`. Si la firma falla detrás de un proxy, define `TWILIO_WEBHOOK_BASE_URL` con la URL pública exacta configurada en Twilio.
- `DB_SSL` / `DB_SSL_REJECT_UNAUTHORIZED` / `DB_SSL_CA`: el certificado de la base se verifica por defecto.

## Arquitectura

```
src/
├── core/        # auth (JWT, guards, @Auth) y control de acceso por restaurante
├── common/      # traducciones, utilidades, subida de archivos, adaptador de Socket.IO
├── config/      # configuración tipada y validación del entorno
├── database/    # conexión, data source de la CLI y migraciones
└── modules/     # auth, users, restaurants, branches, products, categories,
                 # menus, orders, customers, messages (bot), openai, health
```

### Flujo del bot

1. Twilio llama al webhook → se valida la firma → el mensaje se encola y se
   responde de inmediato (los reintentos de Twilio se descartan por `MessageSid`).
2. Los mensajes de cada cliente se procesan en orden: QR de la mesa → idioma →
   ubicación → flujo principal (menú, pedidos, info/fotos, recomendaciones,
   amenidades, cuenta).
3. Caja recibe avisos por WhatsApp y en el panel (Socket.IO, namespace `/orders`).

La cola es en memoria (una sola instancia). Para escalar horizontalmente hay que
moverla, junto con los límites de peticiones, a Redis/BullMQ.

### Permisos

- `super` / `admin`: todos los restaurantes. Solo ellos asignan créditos de
  mensajes y activan/desactivan restaurantes, sucursales y productos.
- `client`: solo los restaurantes de los que es dueño.
- `user`: hoy no está vinculado a ningún restaurante, por lo que no accede a
  datos de restaurantes.

### WebSocket

La conexión al namespace `/orders` requiere el access token:

```ts
io(`${apiUrl}/orders`, { auth: { token: accessToken } });
```
