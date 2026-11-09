/** Lo que Excel toma por fórmula si una celda empieza así. */
export const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Celda de CSV: antepone ' a lo que Excel tomaría por fórmula y pone entre
 * comillas lo que trae comas, comillas o saltos de línea.
 */
export const csvCell = (value: string): string => {
  // Un teléfono, completo u oculto ("+521••••••••67"), no es una fórmula.
  const isPhone = /^\+[\d•]{6,15}$/.test(value);
  const safe = FORMULA_START.test(value) && !isPhone ? `'${value}` : value;
  return /[",\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

const BOM = String.fromCharCode(0xfeff);

/** UTF-8 con BOM, comas y CRLF: así Excel respeta los acentos. */
export const toCsv = (rows: string[][]): string =>
  `${BOM}${rows.map((row) => row.map(csvCell).join(',')).join('\r\n')}\r\n`;
