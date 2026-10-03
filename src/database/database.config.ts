import { readFileSync } from 'fs';
import { extname, join } from 'path';
import { DataSourceOptions } from 'typeorm';

/** `.ts` al ejecutar con ts-node desde src, `.js` desde dist. */
export const SOURCE_EXTENSION = extname(__filename);

export interface DatabaseSettings {
  host?: string;
  port: number;
  username?: string;
  password?: string;
  name?: string;
  ssl: boolean;
  sslRejectUnauthorized: boolean;
  sslCa?: string;
}

/**
 * DB_SSL_CA admite el contenido PEM o una ruta a un archivo .pem/.crt.
 */
const loadCa = (ca?: string): string | undefined => {
  if (!ca) return undefined;
  if (ca.includes('-----BEGIN')) return ca.replace(/\\n/g, '\n');
  return readFileSync(ca, 'utf8');
};

/**
 * Opciones compartidas por la app (TypeOrmModule) y la CLI de migraciones.
 * Las rutas se resuelven desde este archivo para funcionar igual en `src`
 * (ts-node) y en `dist` (build).
 */
export const buildDataSourceOptions = (
  settings: DatabaseSettings,
): DataSourceOptions => ({
  type: 'postgres',
  host: settings.host,
  port: settings.port,
  username: settings.username,
  password: settings.password,
  database: settings.name,
  ssl: settings.ssl
    ? {
        rejectUnauthorized: settings.sslRejectUnauthorized,
        ca: loadCa(settings.sslCa),
      }
    : false,
  extra: {
    // Forzar UTC en las sesiones de PostgreSQL.
    options: '-c timezone=UTC',
  },
  synchronize: false,
  // En `dist` solo los .js (un glob con .ts también tomaría los .d.ts).
  migrations: [join(__dirname, 'migrations', `*${SOURCE_EXTENSION}`)],
  migrationsTableName: 'migrations',
});
