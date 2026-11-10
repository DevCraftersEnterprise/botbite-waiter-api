/** Círculo donde no se entrega. Sin días ni horario aplica siempre. */
export interface NoDeliveryZone {
  name: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  /** 0 = domingo. Vacío: todos los días. */
  days: number[];
  /** HH:mm; puede cruzar la medianoche. null con `to` null: todo el día. */
  from: string | null;
  to: string | null;
}

/** Ventana en que se reciben pedidos "para ahora". */
export interface OrderingHours {
  /** 0 = domingo. */
  days: number[];
  opens: string;
  /** Si es menor que `opens`, cierra al día siguiente. */
  closes: string;
}

export interface OrderingScheduling {
  enabled: boolean;
  /** 1 = hoy y mañana. */
  maxDays: number;
  minLeadMinutes: number;
  stepMinutes: number;
  /** Cuánto antes de la hora programada se le recuerda a caja. */
  reminderMinutes: number;
  /** Hasta cuántos minutos antes puede cancelar el cliente. */
  cancelUntilMinutes: number;
}

export const DEFAULT_SCHEDULING: OrderingScheduling = {
  enabled: false,
  maxDays: 1,
  minLeadMinutes: 45,
  stepMinutes: 30,
  reminderMinutes: 30,
  cancelUntilMinutes: 60,
};
