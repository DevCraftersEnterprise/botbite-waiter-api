/** Helpers para leer valores capturados en `catch` (de tipo `unknown`). */
export const errorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export const errorStack = (error: unknown): string | undefined =>
  error instanceof Error ? error.stack : undefined;

export const errorCode = (error: unknown): string | undefined =>
  typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
