# AGENTS.md · botbite-waiter-api

Cómo se trabaja en este repo, tanto para personas como para agentes de código. La sección **Forma de trabajo** es igual en los tres repos de BotBite: si la cambias aquí, cámbiala también en los otros dos.

## El ecosistema

| Repo | Qué es | Dónde corre |
|---|---|---|
| `botbite-waiter-api` | API NestJS. Fuente de verdad de restaurantes, sucursales, menús, cuentas y notificaciones | Render, con Postgres en Neon |
| `botbite-web-app` | Panel para restaurantes y su personal (app.botbite.com.mx) | Netlify |
| `botbite-lander` | Landing (botbite.com.mx) | Netlify; el dominio está en GoDaddy con DNS en Netlify |

El mesero de WhatsApp corre en n8n (VPS de Hostinger, lo mantiene Carlos). Habla con la API por HTTP y no se conecta a la base.

## Forma de trabajo

### Ramas, commits y PRs

- No se hace commit directo a `main`. Cada cambio sale de `main` actualizado (`git pull`) en su propia rama: `feat/`, `fix/`, `refactor/`, `chore/` o `docs/`.
- Los commits van en inglés con Conventional Commits: `feat: …`, `fix(netlify): …`, `chore(node): …`.
- Un PR por rama hacia `main`. Lo revisa e integra Sergio. Si el cambio toca varios repos, cada PR dice en qué orden se integran y despliegan.
- Haz push seguido: lo que solo está en tu disco se puede perder.

### Idioma

- Los nombres en el código (variables, clases, columnas, rutas) van en inglés.
- Los comentarios, la documentación y los textos de la interfaz van en español.

### Antes de abrir un PR

- Corre el lint, las pruebas y el build que tenga el repo (ver **Comandos**). Si algo falla, dilo en el PR.
- Comprueba que el cambio funciona, no solo que compila.
- Si cambias variables de entorno, comandos o el despliegue, actualiza el README (y en la API, `.env.template`).

### Dependencias

- Solo se aplican actualizaciones menores o de parche. Las versiones mayores (NestJS, TypeORM, Angular…) no se suben sin acordarlo, porque rompen compatibilidad sin necesidad.
- Se usa Node 22.23.4 (`.nvmrc`), la misma versión que en Render y Netlify.

### Base de datos

- Nunca apuntes a producción desde tu máquina. El `.env` local puede tener credenciales reales; para probar usa un Postgres local o una rama de Neon.
- El esquema solo cambia con migraciones de TypeORM (`synchronize` está apagado). Cada migración tiene su `down()`, y las que ya corrieron en producción no se editan.
- Primero se agrega y después se quita. El código que deja de usar una columna o una tabla se despliega antes que la migración que la borra, porque Render corre la migración mientras la versión anterior sigue atendiendo.
- Si una migración transforma o borra datos, primero se saca un respaldo y se prueba en una rama de Neon con copia de producción.

### Seguridad

- Los secretos no van en el código, en commits, en PRs ni en chats (WhatsApp incluido). Viven en las variables de entorno de Render y Netlify o en las credenciales de n8n.
- Todo acceso a datos respeta la separación por restaurante y por sucursal.
- De los datos personales (teléfonos, datos fiscales) se guarda lo mínimo, y nunca se escriben en logs.

### Coordinación con n8n

- Las rutas que usa el bot (`/v1/bot/*`) se documentan en Swagger (`/docs`). Un cambio incompatible se le avisa a Carlos antes de desplegarlo y la fecha se acuerda con él.
- Las páginas que revisó Meta (`/agentes`, el aviso de privacidad y protección de datos) y el `<head>` de la home no se cambian sin su visto bueno.

### Después de integrar

- `main` se despliega solo. Revisa el despliegue y verifica en producción lo que cambiaste: la salud de la API, la pantalla afectada o un `curl`.

## Este repo: API

NestJS 11, TypeORM 0.3 con Postgres (Neon), Socket.IO (namespace `/orders`), JWT con refresh rotativo, argon2 y Cloudinary.

### Estructura

- `src/modules/<dominio>/`: controller, entidades, DTOs y un caso de uso por archivo en `use-cases/`.
- `src/core/`: autenticación y `AccessControlService`, que aplica los permisos por restaurante y sucursal.
- `src/common/`: utilidades, subida de archivos e i18n (`src/i18n`).
- `src/database/migrations/`: migraciones.

### Comandos

```bash
npm ci
npm run start:dev                  # http://localhost:3000/v1
npm run lint
npm test                           # pruebas unitarias
npm run test:e2e                   # pruebas e2e (ver abajo)
npm run build
npm run migration:generate -- src/database/migrations/NombreDelCambio
npm run migration:run              # usa la base del .env: revisa antes a dónde apunta
```

Las pruebas e2e levantan la app completa y **borran la base** antes de correr las migraciones. Apúntalas solo a un Postgres local:

```bash
docker run -d --name botbite-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
docker exec botbite-pg createdb -U postgres botbite_test
npm run test:e2e                   # configurable con E2E_DB_HOST, _PORT, _USERNAME, _PASSWORD y _NAME
```

### Convenciones

- Las entidades heredan de `BaseEntity` (`id` uuid, `isActive`, `createdAt`, `updatedAt`, `deletedAt`).
- La entrada se valida con DTOs de class-validator. El `ValidationPipe` global rechaza los campos que no están en el DTO.
- Cada ruta declara sus roles con `@Auth([...])`. Si toca datos de un restaurante o una sucursal, también pasa por `AccessControlService`. El personal (rol `USER`) solo ve las sucursales que tiene asignadas.
- Las respuestas nunca incluyen contraseñas ni tokens (`@Exclude` y `ClassSerializerInterceptor`).
- Los mensajes de error usan claves de i18n (`errors.*`).
- `@/` es el alias de `src/`.
- Una variable de entorno nueva se agrega en `src/config/configuration.ts`, en `src/config/env.validation.ts` y en `.env.template`.

### Despliegue en Render

| Paso | Comando |
|---|---|
| Build | `npm ci --include=dev && npm run build` |
| Pre-deploy | `npm run migration:run:prod` |
| Start | `npm run start:prod` |

Después de desplegar, revisa los logs del deploy y corre `curl https://api.botbite.com.mx/v1/health`.
