/** Si el comensal aceptó recibir promociones por WhatsApp. */
export enum PromosStatus {
  PENDING = 'pending',
  ACCEPTED = 'accepted',
  DECLINED = 'declined',
}

export enum WalletMovementType {
  /** Lo ganó por pagar en línea. */
  CASHBACK = 'cashback',
  /** Lo usó como descuento en una cuenta. */
  USE = 'use',
  /** Saldo devuelto: se canceló la cuenta o una comanda. */
  ADJUSTMENT = 'adjustment',
}

/** Cuánto saldo quiere usar el comensal al pedir la cuenta. */
export enum WalletUse {
  ALL = 'all',
  AMOUNT = 'amount',
  NONE = 'none',
}
