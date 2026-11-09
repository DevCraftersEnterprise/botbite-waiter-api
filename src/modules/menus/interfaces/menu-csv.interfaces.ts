import { MenuCsvColumn } from '@/modules/menus/csv/menu-csv.format';

/**
 * Qué pasa con cada fila: `create` crea el producto, `add` agrega al menú un
 * producto que ya tiene el restaurante y `update` actualiza el que ya está.
 */
export type MenuImportAction = 'create' | 'add' | 'update';

export interface MenuImportIssue {
  /** Fila como la numera Excel (la 1 son los encabezados); null = el archivo. */
  row: number | null;
  column: MenuCsvColumn | null;
  message: string;
}

export interface MenuImportRow {
  row: number;
  name: string;
  category: string;
  price: number;
  action: MenuImportAction;
  /** `copy`: se sube a Cloudinary; `keep`: ya es de BotBite. */
  photo: 'copy' | 'keep' | null;
}

export interface MenuImportSummary {
  rows: number;
  categoriesToCreate: number;
  productsToCreate: number;
  productsToAdd: number;
  productsToUpdate: number;
  photosToCopy: number;
}

export interface MenuImportPreview {
  summary: MenuImportSummary;
  categoriesToCreate: string[];
  rows: MenuImportRow[];
  errors: MenuImportIssue[];
  warnings: MenuImportIssue[];
}

export interface MenuImportResult {
  message: string;
  summary: MenuImportSummary;
  warnings: MenuImportIssue[];
  /** Fotos que no se pudieron copiar: el producto se guardó sin ellas. */
  photoErrors: MenuImportIssue[];
}
