import { FORMULA_START, toCsv } from '@/common/utils/csv.util';

/**
 * Formato del CSV del menú: lectura tolerante a como lo guarda Excel y
 * escritura que Excel abre bien. Funciones puras, sin acceso a la base.
 */

export const MENU_CSV_COLUMNS = [
  'nombre',
  'descripcion',
  'categoria',
  'precio',
  'familia',
  'recomendado',
  'activo',
  'foto_url',
] as const;

export type MenuCsvColumn = (typeof MENU_CSV_COLUMNS)[number];

export const REQUIRED_COLUMNS: MenuCsvColumn[] = [
  'nombre',
  'categoria',
  'precio',
];

export const MAX_ROWS = 1000;
export const MAX_NAME_LENGTH = 150;
export const MAX_DESCRIPTION_LENGTH = 1000;
export const MAX_CATEGORY_LENGTH = 100;
export const MAX_FAMILY_LENGTH = 100;
export const MAX_PHOTO_URL_LENGTH = 2048;
export const MAX_PRICE = 1_000_000;

const HEADER_ALIASES: Record<string, MenuCsvColumn> = {
  nombre: 'nombre',
  producto: 'nombre',
  name: 'nombre',
  descripcion: 'descripcion',
  description: 'descripcion',
  categoria: 'categoria',
  category: 'categoria',
  precio: 'precio',
  price: 'precio',
  familia: 'familia',
  variante: 'familia',
  recomendado: 'recomendado',
  activo: 'activo',
  disponible: 'activo',
  foto_url: 'foto_url',
  foto: 'foto_url',
  url_foto: 'foto_url',
  imagen: 'foto_url',
  imagen_url: 'foto_url',
};

const stripAccents = (value: string): string =>
  value.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Clave para comparar nombres: sin acentos, mayúsculas ni espacios de más. */
export const matchKey = (value: string): string =>
  stripAccents(value).toUpperCase().replace(/\s+/g, ' ').trim();

/** Quita espacios de más sin cambiar acentos ni mayúsculas. */
export const cleanText = (value: string): string =>
  value.replace(/\s+/g, ' ').trim();

export const normalizeHeader = (header: string): MenuCsvColumn | null => {
  const key = stripAccents(header)
    .toLowerCase()
    .trim()
    .replace(/[\s-]+/g, '_');
  return HEADER_ALIASES[key] ?? null;
};

/**
 * Excel guarda "CSV UTF-8" con BOM y "CSV" a secas en Windows-1252. Se acepta
 * cualquiera de los dos.
 */
export const decodeCsvBuffer = (buffer: Buffer): string => {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    text = new TextDecoder('windows-1252').decode(buffer);
  }
  return text.replace(/^\uFEFF/, '');
};

/** El separador más frecuente de la primera línea, fuera de comillas. */
export const detectSeparator = (text: string): ',' | ';' | '\t' => {
  const counts = { ',': 0, ';': 0, '\t': 0 };
  let quoted = false;

  for (const char of text) {
    if (char === '"') quoted = !quoted;
    else if (!quoted && (char === '\n' || char === '\r')) break;
    else if (!quoted && char in counts) counts[char as keyof typeof counts]++;
  }

  if (counts[';'] > counts[','] && counts[';'] >= counts['\t']) return ';';
  if (counts['\t'] > counts[',']) return '\t';
  return ',';
};

/** CSV con comillas dobles (RFC 4180): celdas con separadores y saltos de línea. */
export const parseCsv = (text: string, separator: string): string[][] => {
  const records: string[][] = [];
  let record: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (char === '"') {
        quoted = false;
      } else {
        cell += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === separator) {
      record.push(cell);
      cell = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i++;
      record.push(cell);
      records.push(record);
      record = [];
      cell = '';
    } else {
      cell += char;
    }
  }

  if (cell !== '' || record.length > 0) {
    record.push(cell);
    records.push(record);
  }

  return records;
};

/** La exportación antepone ' a lo que Excel tomaría por fórmula; aquí se quita. */
export const unescapeCell = (value: string): string =>
  value.startsWith("'") && FORMULA_START.test(value.slice(1))
    ? value.slice(1)
    : value;

export type ParseResult<T> = { value: T } | { error: string };

/**
 * Precio con punto o coma decimal: "120", "120.50", "120,50", "$1,200.00".
 * Una coma seguida de grupos de tres cifras ("1,200") se toma como miles.
 */
export const parsePrice = (raw: string): ParseResult<number> => {
  let value = raw.replace(/[$\s]/g, '').replace(/^MXN/i, '');
  if (!value) return { error: 'required' };

  const lastComma = value.lastIndexOf(',');
  const lastDot = value.lastIndexOf('.');

  if (lastComma >= 0 && lastDot >= 0) {
    value =
      lastComma > lastDot
        ? value.replace(/\./g, '').replace(',', '.')
        : value.replace(/,/g, '');
  } else if (lastComma >= 0) {
    value = /^\d{1,3}(,\d{3})+$/.test(value)
      ? value.replace(/,/g, '')
      : value.replace(',', '.');
  }

  if (!/^\d+(\.\d{1,2})?$/.test(value)) return { error: 'invalid' };

  const price = Number(value);
  if (price <= 0) return { error: 'not_positive' };
  if (price > MAX_PRICE) return { error: 'too_high' };

  return { value: price };
};

const YES = new Set(['si', 'yes', 'y', 's', 'x', '1', 'true', 'verdadero']);
const NO = new Set(['no', 'n', '0', 'false', 'falso']);

/** "sí"/"no" y sus variantes. Vacío = sin cambio. */
export const parseYesNo = (raw: string): ParseResult<boolean | null> => {
  const value = stripAccents(raw).toLowerCase().trim();
  if (!value) return { value: null };
  if (YES.has(value)) return { value: true };
  if (NO.has(value)) return { value: false };
  return { error: 'invalid' };
};

export const parsePhotoUrl = (raw: string): ParseResult<string | null> => {
  const value = raw.trim();
  if (!value) return { value: null };
  if (value.length > MAX_PHOTO_URL_LENGTH) return { error: 'too_long' };

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return { error: 'invalid' };
  }

  if (url.protocol !== 'https:') return { error: 'not_https' };
  return { value: url.toString() };
};

/** Distancia de edición, para avisar de nombres muy parecidos. */
export const editDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }

  return previous[b.length];
};

/**
 * Dos nombres (ya en `matchKey`) se parecen si difieren en una o dos letras
 * (en nombres de 5 o más) o en hasta el 20 % de su largo.
 */
export const areSimilarNames = (a: string, b: string): boolean => {
  if (a === b) return false;
  const distance = editDistance(a, b);
  return (
    (distance <= 2 && Math.min(a.length, b.length) >= 5) ||
    distance / Math.max(a.length, b.length) <= 0.2
  );
};

export interface MenuCsvExportRow {
  name: string;
  description: string | null;
  category: string;
  price: number;
  family: string | null;
  recommended: boolean;
  active: boolean;
  photoUrl: string | null;
}

/** UTF-8 con BOM y comas, para que Excel respete los acentos. */
export const toMenuCsv = (rows: MenuCsvExportRow[]): string =>
  toCsv([
    [...MENU_CSV_COLUMNS],
    ...rows.map((row) => [
      row.name,
      row.description ?? '',
      row.category,
      row.price.toFixed(2),
      row.family ?? '',
      row.recommended ? 'sí' : 'no',
      row.active ? 'sí' : 'no',
      row.photoUrl ?? '',
    ]),
  ]);
