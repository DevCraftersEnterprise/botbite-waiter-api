/**
 * Variables para las pruebas e2e. Se fijan antes de cargar la app; las del
 * archivo .env no las sobrescriben. La base de datos se toma de E2E_DB_*
 * (por defecto un Postgres local en el puerto 5432) y se vacía en cada corrida.
 */
const env: Record<string, string> = {
  NODE_ENV: 'test',
  PORT: '0',
  DB_HOST: process.env.E2E_DB_HOST ?? 'localhost',
  DB_PORT: process.env.E2E_DB_PORT ?? '5432',
  DB_USERNAME: process.env.E2E_DB_USERNAME ?? 'postgres',
  DB_PASSWORD: process.env.E2E_DB_PASSWORD ?? 'postgres',
  DB_NAME: process.env.E2E_DB_NAME ?? 'botbite_test',
  DB_SSL: 'false',
  JWT_SECRET: 'e2e-access-secret-0123456789abcdef0123456789',
  JWT_REFRESH_SECRET: 'e2e-refresh-secret-0123456789abcdef012345678',
  JWT_ACCESS_EXPIRY: '15m',
  JWT_REFRESH_EXPIRY: '7d',
  OPENAI_API_KEY: 'sk-e2e',
  TWILIO_AUTH_TOKEN: 'e2e-twilio-token',
  TWILIO_ACCOUNT_SID: 'AC00000000000000000000000000000000',
  TWILIO_VALIDATE_SIGNATURE: 'true',
  TWILIO_WEBHOOK_BASE_URL: 'https://api.botbite.test',
  CLOUDINARY_CLOUD_NAME: 'e2e',
  CLOUDINARY_API_KEY: 'e2e',
  CLOUDINARY_API_SECRET: 'e2e',
  THROTTLE_LIMIT: '1000',
};

Object.assign(process.env, env);
