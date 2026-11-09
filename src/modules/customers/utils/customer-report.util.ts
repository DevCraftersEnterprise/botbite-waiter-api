import { toCsv } from '@/common/utils/csv.util';

/**
 * Nuevo (1 visita), ocasional (2), recurrente (3 o más) e inactivo (más de 30
 * días sin venir). Inactivo manda sobre los otros tres.
 */
export const CUSTOMER_STATUSES = [
  'new',
  'occasional',
  'recurring',
  'inactive',
] as const;
export type CustomerStatus = (typeof CUSTOMER_STATUSES)[number];

/** `unsubscribed`: escribió BAJA, aunque antes hubiera aceptado. */
export const CUSTOMER_PROMOS = [
  'accepted',
  'declined',
  'pending',
  'unsubscribed',
] as const;
export type CustomerPromos = (typeof CUSTOMER_PROMOS)[number];

export const INACTIVE_DAYS = 30;

const STATUS_LABELS: Record<CustomerStatus, string> = {
  new: 'nuevo',
  occasional: 'ocasional',
  recurring: 'recurrente',
  inactive: 'inactivo',
};

const PROMOS_LABELS: Record<CustomerPromos, string> = {
  accepted: 'aceptó',
  declined: 'rechazó',
  pending: 'sin respuesta',
  unsubscribed: 'se dio de baja',
};

/** El teléfono parcialmente oculto: "+521••••••••67". */
export const maskPhone = (phone: string): string =>
  phone.length <= 6
    ? '•'.repeat(phone.length)
    : `${phone.slice(0, 4)}${'•'.repeat(phone.length - 6)}${phone.slice(-2)}`;

/** Solo quienes aceptaron promociones y no se dieron de baja salen completos. */
export const canExportPhone = (promos: CustomerPromos): boolean =>
  promos === 'accepted';

/** Fecha en la zona horaria del restaurante, como la lee Excel: AAAA-MM-DD. */
export const localDate = (value: Date | null, timeZone: string): string =>
  value
    ? new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(value)
    : '';

export interface CustomerReportRow {
  id: string;
  name: string;
  phone: string;
  visits: number;
  firstVisitAt: Date | null;
  lastVisitAt: Date | null;
  spent: number;
  paidOrders: number;
  avgTicket: number;
  walletBalance: number;
  cashbackEarned: number;
  promos: CustomerPromos;
  promosAt: Date | null;
  status: CustomerStatus;
  favorites: string[];
}

export const CUSTOMERS_CSV_HEADER = [
  'nombre',
  'telefono',
  'visitas',
  'alta',
  'ultima_visita',
  'gasto_total',
  'cuentas_pagadas',
  'ticket_promedio',
  'monedero_saldo',
  'cashback_ganado',
  'promociones',
  'promociones_fecha',
  'estado',
  'favoritos',
];

/** Exportación: el teléfono completo solo de quien aceptó promociones. */
export const toCustomersCsv = (
  rows: CustomerReportRow[],
  timeZone: string,
): string =>
  toCsv([
    CUSTOMERS_CSV_HEADER,
    ...rows.map((row) => [
      row.name,
      canExportPhone(row.promos) ? row.phone : maskPhone(row.phone),
      String(row.visits),
      localDate(row.firstVisitAt, timeZone),
      localDate(row.lastVisitAt, timeZone),
      row.spent.toFixed(2),
      String(row.paidOrders),
      row.avgTicket.toFixed(2),
      row.walletBalance.toFixed(2),
      row.cashbackEarned.toFixed(2),
      PROMOS_LABELS[row.promos],
      localDate(row.promosAt, timeZone),
      STATUS_LABELS[row.status],
      row.favorites.join(' | '),
    ]),
  ]);
