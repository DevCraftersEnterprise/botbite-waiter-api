/** Formatos del SAT. La API no valida contra el SAT: eso lo hace el timbrado. */
export const RFC_PATTERN = /^[A-ZÑ&]{3,4}\d{6}[A-Z\d]{3}$/;
export const ZIP_PATTERN = /^\d{5}$/;
export const TAX_REGIME_PATTERN = /^\d{3}$/;
/** G03, S01, CP01… */
export const CFDI_USE_PATTERN = /^[A-Z]{1,2}\d{2}$/;
export const PAYMENT_FORM_PATTERN = /^\d{2}$/;
export const SAT_UUID_PATTERN =
  /^[\dA-F]{8}-[\dA-F]{4}-[\dA-F]{4}-[\dA-F]{4}-[\dA-F]{12}$/;

/** Como viene de la constancia: mayúsculas, sin espacios ni guiones. */
export const normalizeRfc = (rfc: string): string =>
  rfc.trim().toUpperCase().replace(/[\s-]/g, '');
