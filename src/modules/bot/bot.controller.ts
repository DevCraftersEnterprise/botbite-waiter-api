import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiSecurity,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { InjectRepository } from '@nestjs/typeorm';
import type { Response } from 'express';
import { Repository } from 'typeorm';
import { BotBranchId } from '@/modules/bot/decorators/bot-branch-id.decorator';
import { AddBotRoundDto } from '@/modules/bot/dto/add-bot-round.dto';
import { BotBranchResponse } from '@/modules/bot/dto/bot-branch.response';
import { BotCustomerResponse } from '@/modules/bot/dto/bot-customer.response';
import { BotInvoiceResponse } from '@/modules/bot/dto/bot-invoice.response';
import {
  BotOrderResponse,
  BotRoundResponse,
} from '@/modules/bot/dto/bot-order.response';
import {
  BotDailyCloseResponse,
  BotPaymentResponse,
} from '@/modules/bot/dto/bot-payment.response';
import { CreateBotNotificationDto } from '@/modules/bot/dto/create-bot-notification.dto';
import { LookupBotCustomerDto } from '@/modules/bot/dto/lookup-bot-customer.dto';
import { OpenBotOrderDto } from '@/modules/bot/dto/open-bot-order.dto';
import { RecordBotInvoiceDto } from '@/modules/bot/dto/record-bot-invoice.dto';
import { RecordBotPaymentDto } from '@/modules/bot/dto/record-bot-payment.dto';
import { UpdateBotCustomerDto } from '@/modules/bot/dto/update-bot-customer.dto';
import { UpdateBotOrderDto } from '@/modules/bot/dto/update-bot-order.dto';
import { BotKeyGuard } from '@/modules/bot/guards/bot-key.guard';
import { BotConfigService } from '@/modules/bot/services/bot-config.service';
import { BOT_IP_LIMIT } from '@/modules/bot/utils/bot-throttle.util';
import { RestaurantCustomersService } from '@/modules/customers/services/restaurant-customers.service';
import { NotificationsService } from '@/modules/notifications/notifications.service';
import {
  AcceptingResponse,
  UpdateAcceptingDto,
} from '@/modules/ordering/dto/update-accepting.dto';
import { OrderingConfigService } from '@/modules/ordering/services/ordering-config.service';
import { Order } from '@/modules/orders/entities/order.entity';
import { OrderSource, OrderStatus } from '@/modules/orders/enums/order.enums';
import {
  OrderAccountsService,
  RoundResult,
} from '@/modules/orders/services/order-accounts.service';
import { OrderInvoicesService } from '@/modules/orders/services/order-invoices.service';
import { OrderPaymentsService } from '@/modules/orders/services/order-payments.service';
import {
  toOrderView,
  toRoundView,
} from '@/modules/orders/utils/order-view.util';

const toRoundResponse = ({ created, order, round }: RoundResult) => ({
  created,
  order: toOrderView(order),
  round: toRoundView(round),
});

/**
 * Rutas que consume el servicio del mesero. El límite que cuenta es por llave
 * (`THROTTLE_BOT_LIMIT`); el de IP solo frena a quien inventa llaves.
 */
@ApiTags('Bot')
@ApiSecurity('bot-key')
@ApiUnauthorizedResponse({ description: 'Llave faltante, inválida o revocada' })
@Controller('bot')
@UseGuards(BotKeyGuard)
@Throttle({ default: { limit: BOT_IP_LIMIT, ttl: 60_000 } })
export class BotController {
  constructor(
    private readonly botConfigService: BotConfigService,
    private readonly accounts: OrderAccountsService,
    private readonly payments: OrderPaymentsService,
    private readonly invoices: OrderInvoicesService,
    private readonly customers: RestaurantCustomersService,
    private readonly notificationsService: NotificationsService,
    private readonly orderingConfigService: OrderingConfigService,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  @Get('branch')
  @ApiOperation({
    summary: 'Configuración y catálogo de la sucursal de la llave',
    description:
      'Responde con ETag: al guardarla en caché, envía If-None-Match y la API contesta 304 si nada cambió.',
  })
  @ApiOkResponse({ type: BotBranchResponse })
  findBranch(@BotBranchId() branchId: string): Promise<BotBranchResponse> {
    return this.botConfigService.findBotBranch(branchId);
  }

  @Patch('ordering')
  @ApiOperation({
    summary: 'Pausa o reanuda los pedidos (recoger y domicilio)',
    description:
      'Lo que caja escribe en WhatsApp (*pausar* / *activar*) para que el panel lo muestre. Repetir el mismo valor no hace nada. 404 si la sucursal no tiene el modo pedidos activo.',
  })
  @ApiOkResponse({ type: AcceptingResponse })
  @ApiNotFoundResponse({ description: 'La sucursal no tiene pedidos activos' })
  updateOrdering(
    @BotBranchId() branchId: string,
    @Body() dto: UpdateAcceptingDto,
  ): Promise<AcceptingResponse> {
    return this.orderingConfigService.setAccepting(branchId, dto.accepting);
  }

  @Post('orders')
  @ApiOperation({
    summary: 'Abre la cuenta con su primera ronda',
    description:
      'Reenviar el mismo `code` no duplica nada: responde 200 con `created: false`. La API calcula precios y totales con el menú vigente.',
  })
  @ApiConflictResponse({
    description:
      'Algún platillo no está disponible: el platillo, su producto, su categoría o su menú están apagados. `unavailable` trae sus ids. No se crea nada.',
  })
  @ApiCreatedResponse({ type: BotRoundResponse })
  @ApiOkResponse({ type: BotRoundResponse, description: 'Era un reintento' })
  async openOrder(
    @BotBranchId() branchId: string,
    @Body() dto: OpenBotOrderDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.accounts.openAccount({
      ...dto,
      branchId,
      source: OrderSource.WHATSAPP,
    });

    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);

    return toRoundResponse(result);
  }

  @Post('orders/:code/rounds')
  @ApiOperation({
    summary: 'Agrega una ronda (comanda) a la cuenta',
    description:
      'Reenviar el mismo `number` no duplica la comanda: responde 200 con `created: false`. Solo se aceptan rondas con la cuenta en `open`.',
  })
  @ApiConflictResponse({
    description:
      'Algún platillo no está disponible: el platillo, su producto, su categoría o su menú están apagados. `unavailable` trae sus ids. No se crea nada.',
  })
  @ApiCreatedResponse({ type: BotRoundResponse })
  @ApiOkResponse({ type: BotRoundResponse, description: 'Era un reintento' })
  async addRound(
    @BotBranchId() branchId: string,
    @Param('code') code: string,
    @Body() dto: AddBotRoundDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.accounts.addBotRound(
      branchId,
      code,
      dto.number,
      dto.items,
    );

    response.status(result.created ? HttpStatus.CREATED : HttpStatus.OK);

    return toRoundResponse(result);
  }

  @Patch('orders/:code')
  @ApiOperation({
    summary: 'Avanza el estado de la cuenta o de la entrega',
    description:
      'Con `status`: avisa a caja al pedir la cuenta y al elegir pagar con el mesero. Con `bill_requested` aplica el monedero y con `payment_link` guarda la propina y la comisión con que se generó el link: toma de la respuesta los importes del link. En recoger y domicilio, `open` → `payment_link` aplica el monedero, y `cancelled` cancela un pedido sin pagar y devuelve el saldo usado. Con `fulfillmentStatus`: avanza la entrega de un pedido pagado. Se manda uno de los dos. Un cambio no permitido responde 409.',
  })
  @ApiOkResponse({ type: BotOrderResponse })
  async updateOrder(
    @BotBranchId() branchId: string,
    @Param('code') code: string,
    @Body() dto: UpdateBotOrderDto,
  ) {
    const { status, fulfillmentStatus, ...wallet } = dto;

    if (Boolean(status) === Boolean(fulfillmentStatus)) {
      throw new BadRequestException('Send either status or fulfillmentStatus');
    }

    if (
      dto.commissionPct !== undefined &&
      status !== OrderStatus.PAYMENT_LINK
    ) {
      throw new BadRequestException('commissionPct is only for payment_link');
    }

    if (fulfillmentStatus) {
      const order = await this.accounts.updateFulfillment(
        { code, branchId },
        fulfillmentStatus,
        'bot',
      );
      return {
        order: toOrderView(order),
        walletBalance: await this.customers.balanceOf(
          branchId,
          order.customerId,
        ),
        walletCapped: false,
      };
    }

    const { order, walletBalance, walletCapped } =
      await this.accounts.updateFromBot(branchId, code, {
        ...wallet,
        status: status!,
      });

    return { order: toOrderView(order), walletBalance, walletCapped };
  }

  @Post('payments')
  @ApiOperation({
    summary: 'Registra un pago aprobado por Mercado Pago',
    description:
      'Reenviar el mismo `providerPaymentId` no lo procesa dos veces: responde 200 con `created: false`. La API cierra la cuenta, abona el cashback y avisa a caja. Un pago que no cuadra se guarda igual: revisa `status`.',
  })
  @ApiCreatedResponse({ type: BotPaymentResponse })
  @ApiOkResponse({ type: BotPaymentResponse, description: 'Era un reintento' })
  async recordPayment(
    @BotBranchId() branchId: string,
    @Body() dto: RecordBotPaymentDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { created, payment, order } = await this.payments.record(
      branchId,
      dto,
    );

    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);

    return {
      created,
      status: payment.status,
      cashback: Number(payment.cashbackEarned),
      walletBalance: await this.customers.balanceOf(
        branchId,
        order?.customerId ?? null,
      ),
      order: order && toOrderView(order),
    };
  }

  @Post('invoices')
  @ApiOperation({
    summary: 'Registra una factura que FacturAPI ya timbró',
    description:
      'Reenviar el mismo `providerInvoiceId` no la registra dos veces: responde 200 con `created: false`. La API avisa a caja. Con `saveTaxProfile` guarda los datos fiscales del comensal, que solo se escriben junto con una factura timbrada. Una factura con error no se manda aquí: avisa a caja con POST /bot/notifications.',
  })
  @ApiCreatedResponse({ type: BotInvoiceResponse })
  @ApiOkResponse({ type: BotInvoiceResponse, description: 'Era un reintento' })
  async recordInvoice(
    @BotBranchId() branchId: string,
    @Body() dto: RecordBotInvoiceDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { created, invoice, order, previous, hasTaxProfile } =
      await this.invoices.record(branchId, dto);

    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);

    return {
      created,
      repeated: Boolean(previous),
      hasTaxProfile,
      invoice: {
        id: invoice.id,
        providerInvoiceId: invoice.providerInvoiceId,
        uuid: invoice.uuid,
        folio: invoice.folio,
        total: Number(invoice.total),
        issuedAt: invoice.issuedAt,
        orderCode: order.code,
      },
    };
  }

  @Post('daily-close')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cierra las cuentas de WhatsApp que nadie pidió',
    description:
      'Pasan a `auto_closed`, sin cashback. Solo toca cuentas en `open`: las que ya tienen un cobro en curso y las del personal las cierra caja. Repetirlo no hace nada.',
  })
  @ApiOkResponse({ type: BotDailyCloseResponse })
  async dailyClose(@BotBranchId() branchId: string) {
    const orders = await this.accounts.closeDay(branchId);

    return { closed: orders.map((order) => order.code) };
  }

  // El teléfono va en el cuerpo: en la URL quedaría en los logs de Render.
  @Post('customers/lookup')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Visitas, promociones y saldo del comensal en este restaurante',
    description:
      'Si nunca ha venido responde 200 con `known: false` y el saldo en cero. Los datos fiscales solo vienen con `includeTaxProfile: true`.',
  })
  @ApiOkResponse({ type: BotCustomerResponse })
  findCustomer(
    @BotBranchId() branchId: string,
    @Body() dto: LookupBotCustomerDto,
  ) {
    return this.customers.findProfile(
      branchId,
      dto.phone,
      dto.includeTaxProfile,
    );
  }

  @Patch('customers')
  @ApiOperation({
    summary: 'Guarda el nombre y la respuesta a promociones del comensal',
    description:
      'Con `unsubscribed: true` queda dado de baja de las promociones y con `deleteTaxProfile: true` se borran sus datos fiscales. Si no existe, lo crea.',
  })
  @ApiOkResponse({ type: BotCustomerResponse })
  updateCustomer(
    @BotBranchId() branchId: string,
    @Body() dto: UpdateBotCustomerDto,
  ) {
    return this.customers.updateProfile(branchId, dto);
  }

  @Post('notifications')
  @ApiOperation({
    summary: 'Aviso para caja que no sale de una cuenta',
    description:
      'Con `eventId`, reenviar el mismo aviso no lo duplica en caja: responde 200 con `created: false`.',
  })
  @ApiCreatedResponse({ description: 'Aviso creado' })
  @ApiOkResponse({ description: 'Era un reintento con el mismo `eventId`' })
  async createNotification(
    @BotBranchId() branchId: string,
    @Body() dto: CreateBotNotificationDto,
    @Res({ passthrough: true }) response: Response,
  ) {
    let orderId: string | null = null;

    if (dto.orderCode) {
      const order = await this.orderRepository.findOne({
        where: { code: dto.orderCode, branchId },
        select: { id: true },
      });
      if (!order) throw new NotFoundException('Account not found');
      orderId = order.id;
    }

    const { notification, created } =
      await this.notificationsService.createOnce({
        branchId,
        type: dto.type,
        message: dto.message,
        orderId,
        eventId: dto.eventId ?? null,
      });

    response.status(created ? HttpStatus.CREATED : HttpStatus.OK);

    return { id: notification.id, created };
  }
}
