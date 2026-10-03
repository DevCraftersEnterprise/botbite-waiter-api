const toBool = (value: string | undefined, fallback: boolean): boolean =>
  value === undefined || value === ''
    ? fallback
    : value.toLowerCase() === 'true';

const toList = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

export default () => {
  const nodeEnv = process.env.NODE_ENV ?? 'development';
  const isProduction = nodeEnv === 'production';

  return {
    app: {
      port: parseInt(process.env.PORT ?? '3000', 10),
      nodeEnv,
      isProduction,
      corsOrigins: toList(process.env.CORS_ORIGINS),
      // Número de proxies delante de la app (Railway, Render, Nginx...). Necesario
      // para que req.ip y req.protocol sean los del cliente real.
      trustProxy: parseInt(process.env.TRUST_PROXY ?? '1', 10),
      frontendUrl: process.env.FRONTEND_URL,
    },
    database: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      name: process.env.DB_NAME,
      ssl: toBool(process.env.DB_SSL, isProduction),
      sslRejectUnauthorized: toBool(
        process.env.DB_SSL_REJECT_UNAUTHORIZED,
        true,
      ),
      sslCa: process.env.DB_SSL_CA,
    },
    jwt: {
      secret: process.env.JWT_SECRET,
      accessExpiry:
        process.env.JWT_ACCESS_EXPIRY || process.env.JWT_EXPIRES_IN || '15m',
      refreshSecret: process.env.JWT_REFRESH_SECRET,
      refreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
    },
    throttle: {
      ttlMs: parseInt(process.env.THROTTLE_TTL ?? '60', 10) * 1000,
      limit: parseInt(process.env.THROTTLE_LIMIT ?? '100', 10),
      loginLimit: parseInt(process.env.THROTTLE_LOGIN_LIMIT ?? '5', 10),
    },
    messages: {
      rateLimitTtlMs: parseInt(process.env.RATE_LIMIT_TTL ?? '60', 10) * 1000,
      rateLimitMax: parseInt(process.env.RATE_LIMIT_MAX ?? '10', 10),
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY,
    },
    twilio: {
      authToken: process.env.TWILIO_AUTH_TOKEN,
      accountSid: process.env.TWILIO_ACCOUNT_SID,
      validateSignature: toBool(process.env.TWILIO_VALIDATE_SIGNATURE, true),
      // URL pública exacta que Twilio llama (p. ej. https://api.botbite.com.mx).
      // Si no se define se reconstruye a partir de la petición.
      webhookBaseUrl: process.env.TWILIO_WEBHOOK_BASE_URL,
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
    },
  };
};
