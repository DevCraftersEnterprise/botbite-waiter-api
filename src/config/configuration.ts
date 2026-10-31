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
      // Sitio que redirige /m/<sucursal> a la página QR del mesero.
      qrBaseUrl: process.env.QR_BASE_URL || 'https://botbite.com.mx',
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
    bot: {
      // Firma los avisos a n8n. Sin él no se envían.
      webhookSecret: process.env.BOT_WEBHOOK_SECRET,
    },
    docs: {
      user: process.env.DOCS_USER,
      password: process.env.DOCS_PASSWORD,
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
    },
  };
};
