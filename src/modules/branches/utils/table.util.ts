/** Las mesas se comparan sin distinguir mayúsculas ni espacios: "terraza  2" es "TERRAZA 2". */
export const normalizeTable = (table: string): string =>
  table.trim().replace(/\s+/g, ' ').toUpperCase();

/**
 * Limpia la lista de la sucursal: sin vacíos ni repetidas, aunque cambien las
 * mayúsculas. Se queda con la primera forma en que se escribió cada mesa.
 */
export const cleanTables = (tables: string[]): string[] => {
  const byKey = new Map<string, string>();

  for (const raw of tables) {
    const table = raw.trim().replace(/\s+/g, ' ');
    const key = normalizeTable(table);
    if (table && !byKey.has(key)) byKey.set(key, table);
  }

  return [...byKey.values()];
};

/**
 * La mesa tal como está configurada en la sucursal, o `null` si no la acepta.
 * Sin lista configurada se acepta cualquiera.
 */
export const acceptedTable = (
  table: string,
  validTables: string[],
): string | null => {
  const clean = table.trim().replace(/\s+/g, ' ');
  if (validTables.length === 0) return clean;

  const wanted = normalizeTable(clean);
  return validTables.find((valid) => normalizeTable(valid) === wanted) ?? null;
};
