import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { errorCode } from '@/common/utils/error.util';
import { RestaurantCustomersService } from '@/modules/customers/services/restaurant-customers.service';
import { NotificationType } from '@/modules/notifications/enums/notification-type.enum';
import { OrdersGateway } from '@/modules/notifications/gateways/orders.gateway';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import { Invoice } from '@/modules/orders/entities/invoice.entity';
import { Order } from '@/modules/orders/entities/order.entity';
import {
  invoiceMessage,
  repeatedInvoiceMessage,
} from '@/modules/orders/utils/order-messages.util';

const UNIQUE_VIOLATION = '23505';
const PROVIDER = 'facturapi';

export interface RecordInvoiceInput {
  orderCode: string;
  providerInvoiceId: string;
  uuid: string;
  folio: string;
  total: number;
  paymentForm: string;
  cfdiUse: string;
  issuedAt?: string;
  emailSent?: boolean;
  customer: {
    rfc: string;
    legalName: string;
    zip: string;
    taxRegime: string;
  };
  /** Solo si el comensal eligió guardar sus datos. */
  saveTaxProfile?: { email: string; taxRegimes?: string[] };
}

export interface InvoiceResult {
  invoice: Invoice;
  order: Order;
  /** false: era un reintento y no se procesó de nuevo. */
  created: boolean;
  /** La factura que la cuenta ya tenía, si se timbró otra. */
  previous: Invoice | null;
  hasTaxProfile: boolean;
}

/**
 * La API no timbra: registra lo que el servicio del mesero ya timbró en
 * FacturAPI. Por eso nunca rechaza una factura válida de la sucursal: si algo
 * no cuadra, la guarda igual y avisa a caja.
 */
@Injectable()
export class OrderInvoicesService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly customers: RestaurantCustomersService,
    private readonly notificationsService: NotificationsService,
    private readonly ordersGateway: OrdersGateway,
  ) {}

  /** Reenviar la misma factura no la registra dos veces. */
  async record(
    branchId: string,
    input: RecordInvoiceInput,
  ): Promise<InvoiceResult> {
    const process = () =>
      this.dataSource.transaction((manager) =>
        this.apply(manager, branchId, input),
      );

    let result: InvoiceResult;
    try {
      result = await process();
    } catch (error) {
      if (errorCode(error) !== UNIQUE_VIOLATION) throw error;
      // Otro reintento ganó la carrera: ahora sí se encuentra la factura.
      result = await process();
    }

    if (result.created) await this.announce(result);

    return result;
  }

  private async apply(
    manager: EntityManager,
    branchId: string,
    input: RecordInvoiceInput,
  ): Promise<InvoiceResult> {
    const order = await manager.findOne(Order, {
      where: { code: input.orderCode, branchId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!order) throw new NotFoundException('Account not found');

    const existing = await manager.findOneBy(Invoice, {
      provider: PROVIDER,
      providerInvoiceId: input.providerInvoiceId,
    });

    if (existing) {
      if (existing.branchId !== branchId) {
        throw new ConflictException('The invoice belongs to another branch');
      }
      if (existing.orderId !== order.id) {
        throw new ConflictException('The invoice belongs to another account');
      }
      return {
        invoice: existing,
        order,
        created: false,
        previous: null,
        hasTaxProfile: await this.customers.hasTaxProfile(
          manager,
          branchId,
          order.customerId,
        ),
      };
    }

    const previous = await manager.findOne(Invoice, {
      where: { orderId: order.id },
      order: { issuedAt: 'DESC' },
    });

    const { customer, saveTaxProfile } = input;
    const invoice = await manager.save(
      manager.create(Invoice, {
        branchId,
        orderId: order.id,
        provider: PROVIDER,
        providerInvoiceId: input.providerInvoiceId,
        uuid: input.uuid,
        folio: input.folio,
        total: input.total,
        paymentForm: input.paymentForm,
        cfdiUse: input.cfdiUse,
        rfc: customer.rfc,
        legalName: customer.legalName,
        zip: customer.zip,
        taxRegime: customer.taxRegime,
        emailSent: input.emailSent ?? false,
        issuedAt: input.issuedAt ? new Date(input.issuedAt) : new Date(),
      }),
    );

    if (saveTaxProfile && order.customerId) {
      await this.customers.saveTaxProfile(manager, branchId, order.customerId, {
        ...customer,
        cfdiUse: input.cfdiUse,
        email: saveTaxProfile.email,
        taxRegimes: [
          ...new Set([
            ...(saveTaxProfile.taxRegimes ?? []),
            customer.taxRegime,
          ]),
        ],
      });
    }

    return {
      invoice,
      order,
      created: true,
      previous,
      hasTaxProfile: await this.customers.hasTaxProfile(
        manager,
        branchId,
        order.customerId,
      ),
    };
  }

  private async announce({
    invoice,
    order,
    previous,
  }: InvoiceResult): Promise<void> {
    await this.notificationsService.create({
      branchId: invoice.branchId,
      orderId: order.id,
      phoneNumber:
        (await this.customers.phoneOf(order.customerId)) ?? undefined,
      ...(previous
        ? {
            type: NotificationType.ALERT,
            message: repeatedInvoiceMessage(order, invoice, previous),
          }
        : {
            type: NotificationType.INVOICE,
            message: invoiceMessage(order, invoice),
          }),
    });

    this.ordersGateway.emitOrderUpdate(invoice.branchId);
  }
}
