import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Not, Repository } from 'typeorm';
import { AccessControlService } from '@/core/access/access-control.service';
import { BotOrdering } from '@/modules/bot/dto/bot-branch.response';
import { Branch } from '@/modules/branches/entities/branch.entity';
import {
  ADMIN_ONLY_ORDERING_FIELDS,
  NoDeliveryZoneDto,
  OrderingHoursDto,
  UpdateOrderingDto,
} from '@/modules/ordering/dto/update-ordering.dto';
import { BranchOrdering } from '@/modules/ordering/entities/branch-ordering.entity';
import {
  DEFAULT_SCHEDULING,
  NoDeliveryZone,
  OrderingHours,
} from '@/modules/ordering/interfaces/ordering.interfaces';
import { toOrderingView } from '@/modules/ordering/utils/ordering-view.util';
import { ORDERING_TYPES, OrderType } from '@/modules/orders/enums/order.enums';
import { User } from '@/modules/users/entities/user.entity';

/** Los DTO traen como undefined lo que no se envió: copiarlo borraría valores. */
const definedOnly = <T extends object>(value: T): Partial<T> =>
  Object.fromEntries(
    Object.entries(value).filter(([, field]) => field !== undefined),
  ) as Partial<T>;

const toZone = (zone: NoDeliveryZoneDto): NoDeliveryZone => {
  const from = zone.from ?? null;
  const to = zone.to ?? null;

  if ((from === null) !== (to === null) || (from !== null && from === to)) {
    throw new BadRequestException(
      `Zone "${zone.name}" needs a different from and to, or neither`,
    );
  }

  return {
    name: zone.name.trim(),
    latitude: zone.latitude,
    longitude: zone.longitude,
    radiusMeters: zone.radiusMeters,
    days: [...(zone.days ?? [])].sort((a, b) => a - b),
    from,
    to,
  };
};

const toHours = (hours: OrderingHoursDto[]): OrderingHours[] => {
  if (hours.some((window) => window.opens === window.closes)) {
    throw new BadRequestException('opens and closes must be different');
  }
  return hours.map((window) => ({
    days: [...window.days].sort((a, b) => a - b),
    opens: window.opens,
    closes: window.closes,
  }));
};

/** El envío se combina campo por campo; las listas se reemplazan completas. */
const applyChanges = (ordering: BranchOrdering, dto: UpdateOrderingDto) => {
  const {
    delivery,
    noDeliveryZones,
    hours,
    scheduling,
    phoneNumber,
    ...changes
  } = dto;

  Object.assign(ordering, definedOnly(changes));

  // WhatsApp lo muestra sin "+"; el 1 de los celulares mexicanos se respeta.
  if (phoneNumber !== undefined) {
    ordering.phoneNumber = phoneNumber?.replace(/^\+/, '') ?? null;
  }
  if (delivery) {
    Object.assign(
      ordering,
      definedOnly({
        deliveryBaseFee: delivery.baseFee,
        deliveryIncludedKm: delivery.includedKm,
        deliveryExtraPer100m: delivery.extraPer100m,
        deliveryMaxKm: delivery.maxKm,
      }),
    );
  }
  if (noDeliveryZones) ordering.noDeliveryZones = noDeliveryZones.map(toZone);
  if (hours) ordering.hours = toHours(hours);
  if (scheduling) {
    ordering.scheduling = {
      ...DEFAULT_SCHEDULING,
      ...ordering.scheduling,
      ...definedOnly(scheduling),
    };
  }
};

@Injectable()
export class OrderingConfigService {
  private readonly logger = new Logger(OrderingConfigService.name);

  constructor(
    @InjectRepository(BranchOrdering)
    private readonly orderingRepository: Repository<BranchOrdering>,
    @InjectRepository(Branch)
    private readonly branchRepository: Repository<Branch>,
  ) {}

  /** null: la sucursal nunca configuró pedidos. */
  async find(branchId: string): Promise<BotOrdering | null> {
    const ordering = await this.orderingRepository.findOne({
      where: { branchId },
    });
    return ordering ? toOrderingView(ordering) : null;
  }

  async update(
    branchId: string,
    dto: UpdateOrderingDto,
    user: User,
  ): Promise<BotOrdering> {
    this.assertCanChange(dto, user);

    const branch = await this.branchRepository.findOne({
      where: { id: branchId },
      relations: { ordering: true },
    });
    if (!branch) throw new NotFoundException('Branch not found');

    const ordering = branch.ordering ?? this.newOrdering(branchId);
    applyChanges(ordering, dto);

    this.assertReady(ordering, branch);
    await this.assertAvailable(ordering);

    const { id } = await this.orderingRepository.save(ordering);

    this.logger.log(`Ordering updated: ${branchId} by user: ${user.id}`);

    // Se relee para responder con los tipos de la base (numeric como número).
    return toOrderingView(
      await this.orderingRepository.findOneByOrFail({ id }),
    );
  }

  private newOrdering(branchId: string): BranchOrdering {
    return this.orderingRepository.create({
      branchId,
      enabled: false,
      accepting: true,
      phoneNumberId: null,
      phoneNumber: null,
      types: [...ORDERING_TYPES],
      deliveryBaseFee: 0,
      deliveryIncludedKm: 0,
      deliveryExtraPer100m: 0,
      deliveryMaxKm: null,
      noDeliveryZones: [],
      hours: [],
      scheduling: { ...DEFAULT_SCHEDULING },
      commissionPct: 0,
      paymentLinkMinutes: 60,
      prepMinutes: 20,
    });
  }

  /** *pausar* / *activar*: lo usan caja desde el panel y el bot. */
  async setAccepting(
    branchId: string,
    accepting: boolean,
  ): Promise<{ accepting: boolean }> {
    const ordering = await this.orderingRepository.findOne({
      where: { branchId },
    });
    if (!ordering?.enabled) {
      throw new NotFoundException('Ordering is not enabled for this branch');
    }

    if (ordering.accepting !== accepting) {
      await this.orderingRepository.update({ id: ordering.id }, { accepting });
    }

    return { accepting };
  }

  private assertCanChange(dto: UpdateOrderingDto, user: User): void {
    if (AccessControlService.isPrivileged(user)) return;

    const forbidden = ADMIN_ONLY_ORDERING_FIELDS.filter(
      (field) => dto[field] !== undefined,
    );

    if (forbidden.length > 0) {
      throw new ForbiddenException(
        `Only administrators can change: ${forbidden.join(', ')}`,
      );
    }
  }

  /** Sin número no hay a quién escribirle; sin coordenadas no hay envío. */
  private assertReady(ordering: BranchOrdering, branch: Branch): void {
    if (!ordering.enabled) return;

    if (!ordering.phoneNumberId || !ordering.phoneNumber) {
      throw new BadRequestException(
        'phoneNumberId and phoneNumber are required to enable ordering',
      );
    }

    if (
      ordering.types.includes(OrderType.DELIVERY) &&
      (branch.latitude === null || branch.longitude === null)
    ) {
      throw new BadRequestException(
        'The branch needs latitude and longitude for delivery',
      );
    }
  }

  /** Un número de WhatsApp atiende a una sola sucursal y a un solo modo. */
  private async assertAvailable(ordering: BranchOrdering): Promise<void> {
    const { phoneNumberId } = ordering;
    if (!phoneNumberId) return;

    const [takenByOrdering, takenByWaiter] = await Promise.all([
      this.orderingRepository.exists({
        where: ordering.id
          ? { phoneNumberId, id: Not(ordering.id) }
          : { phoneNumberId },
      }),
      this.branchRepository.exists({
        where: { whatsappPhoneNumberId: phoneNumberId },
        withDeleted: true,
      }),
    ]);

    if (takenByOrdering) {
      throw new ConflictException(
        'phoneNumberId is already used by another branch',
      );
    }
    if (takenByWaiter) {
      throw new ConflictException(
        'phoneNumberId is already used by a waiter number',
      );
    }
  }
}
