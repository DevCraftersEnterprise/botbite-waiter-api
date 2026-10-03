export interface JwtPayload {
  userId: string;
  type: 'access' | 'refresh';
  // Identificador del refresh token guardado en base de datos (solo en refresh).
  jti?: string;
}
