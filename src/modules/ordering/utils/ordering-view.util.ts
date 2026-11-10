import { BotOrdering } from '@/modules/bot/dto/bot-branch.response';
import { BranchOrdering } from '@/modules/ordering/entities/branch-ordering.entity';
import { DEFAULT_SCHEDULING } from '@/modules/ordering/interfaces/ordering.interfaces';

/** Postgres entrega `numeric` como texto. */
const toNumber = (value: number | string): number => Number(value);

/** Ajustes de pedidos tal como los leen el bot y el panel. */
export const toOrderingView = (ordering: BranchOrdering): BotOrdering => ({
  enabled: ordering.enabled,
  accepting: ordering.accepting,
  phoneNumberId: ordering.phoneNumberId,
  phoneNumber: ordering.phoneNumber,
  types: ordering.types,
  delivery: {
    baseFee: toNumber(ordering.deliveryBaseFee),
    includedKm: toNumber(ordering.deliveryIncludedKm),
    extraPer100m: toNumber(ordering.deliveryExtraPer100m),
    maxKm:
      ordering.deliveryMaxKm === null ? null : toNumber(ordering.deliveryMaxKm),
  },
  noDeliveryZones: ordering.noDeliveryZones,
  hours: ordering.hours,
  // Un ajuste nuevo vale su valor por defecto hasta que se guarde.
  scheduling: { ...DEFAULT_SCHEDULING, ...ordering.scheduling },
  commissionPct: toNumber(ordering.commissionPct),
  paymentLinkMinutes: ordering.paymentLinkMinutes,
  prepMinutes: ordering.prepMinutes,
});
